/* ==========================================================================
   engine.js — OWNER: Manvith Karkera
   Purpose: the simulation model (Lab.Engine, CONTRACT §5.2-5.4).

   The server becomes unavailable BECAUSE the simulated half-open queue fills,
   never because code sets a label: every second ("tick") the engine moves real
   connection records through a queue and derives all metrics from it.

   Per tick, in this order (the cause-and-effect chain from CONTRACT §5.4):
     1. expire half-open entries whose timeout has passed
     2. generate arrivals (legitimate + attack) with the seeded PRNG
     3. apply the firewall, then the rate limit
     4. each surviving SYN takes a free slot; if the queue is full it becomes a
        stateless SYN cookie (when enabled) or is rejected
     5. legitimate handshakes that have run for 1 s complete and free their slot
     6. recompute metrics from the queue, derive the server state, emit events

   Everything numeric lives in DEFAULTS below. All numbers are simulated
   educational estimates, not benchmarks.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  // ---- tunable constants ---------------------------------------------------
  var DEFAULTS = {
    tickMs: 500,               // real time per tick; one tick = 1 simulated second
    seed: 1337,                // mulberry32 seed: same settings => same result
    capacity: 100,             // half-open slots. More capacity = a longer fight before the queue is full
    legitRate: 5,              // legitimate SYN/s
    legitHandshakeSec: 1,      // a legit client completes its handshake after 1 s, then frees its slot
    legitRetries: 1,           // a legit SYN rejected because the queue is full is retransmitted once (as real TCP does)
    retryDelaySec: 1,          //   after this many seconds. More retries = a flood hurts legit users less
    timeoutSec: 30,            // how long a half-open entry waits for the final ACK. Longer = attack slots stay occupied longer
    shortTimeoutSec: 5,        // "Shorter timeouts" defence: attack entries are dropped much sooner
    timeoutJitter: 0.5,        // timeouts vary +/-50% around timeoutSec (retransmit back-off, client differences), so expiries are spread out
    levels: {                  // attack strength: SYN/s and the share that NEVER sends the final ACK
      low:    { rate: 4,  incompleteFrac: 0.5 },
      medium: { rate: 15, incompleteFrac: 0.8 },
      high:   { rate: 50, incompleteFrac: 0.95 }
    },
    rateLimitPerSec: 8,        // rate limiting: at most this many generator SYNs/s are accepted, the rest are 'filtered'
    firewallAttackDrop: 0.7,   // firewall: share of attack SYNs dropped. Higher = fewer slots wasted
    firewallLegitDrop: 0.02,   // firewall: legitimate SYNs wrongly dropped (a defence is never free)
    cpuBase: 8,                // cpu = min(100, base + perPending*pending + perSyn*synIncoming + perCookie*cookies)
    cpuPerPending: 0.5,        // every half-open entry costs memory and bookkeeping
    cpuPerSyn: 0.3,            // every arriving SYN costs processing
    cpuPerCookie: 0.4,         // SYN cookies avoid slots but cost extra hashing
    respBaseMs: 40,            // response time = base + queue term + overload term
    respQueueMs: 1500,         //   queue term: respQueueMs * (queueUtil/100)^3  (grows sharply near full)
    respCpuMsPerPct: 6,        //   overload term: ms per cpu% above the knee
    cpuKnee: 60,
    availabilityWindow: 5,     // availability = legit success over the last N simulated seconds
    baselineSeconds: 20,
    attackSeconds: 40
  };

  var MITIGATION_KEYS = ['synCookies', 'rateLimit', 'shortTimeout', 'firewall'];
  var MITIGATION_LABELS = {
    synCookies: 'SYN cookies', rateLimit: 'rate limiting', shortTimeout: 'shorter timeouts', firewall: 'firewall filtering'
  };
  var MAX_PACKETS_PER_TICK = 12;
  var MAX_LEGIT_PACKETS = 4;       // keep the animation readable: legit traffic is never drowned out

  // ---- helpers -------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function round1(n) { return Math.round(n * 10) / 10; }

  function mergeParams(overrides) {
    var p = clone(DEFAULTS);
    if (overrides) {
      Object.keys(overrides).forEach(function (k) {
        if (k === 'levels' && overrides.levels) {
          Object.keys(overrides.levels).forEach(function (l) { p.levels[l] = Object.assign({}, p.levels[l], overrides.levels[l]); });
        } else {
          p[k] = overrides[k];
        }
      });
    }
    return p;
  }

  function deriveServerState(m) {
    if (m.availability < 15) return 'Unavailable';
    if (m.availability < 70 || m.queueUtil > 95) return 'Degraded';
    if (m.availability < 95 || m.queueUtil >= 60 || m.cpu >= 70) return 'Under Pressure';
    return 'Healthy';
  }

  function create(overrides) {
    var params = mergeParams(overrides);
    var handlers = {};
    var timer = null;
    var rng = mulberry32(params.seed);
    var state, summary = null;

    // per-run bookkeeping (not part of State)
    var entries, retries, cohortAttempted, cohortOk, nextId, nextPacketId;
    var crossed, firstLegitRejected, effects, duration;

    function freshState() {
      return {
        t: 0, running: false, mode: 'idle', level: null,
        params: clone(params),
        mitigation: { synCookies: false, rateLimit: false, shortTimeout: false, firewall: false },
        queue: { capacity: params.capacity, legit: 0, attack: 0 },
        metrics: {
          synIncoming: 0, synTotal: 0, pending: 0,
          legitAttempted: 0, legitCompleted: 0,
          rejected: 0, timedOut: 0, filtered: 0,
          queueUtil: 0, cpu: 0, responseTimeMs: params.respBaseMs, availability: 100
        },
        serverState: 'Healthy',
        history: []
      };
    }

    function resetRunData() {
      entries = []; retries = []; cohortAttempted = {}; cohortOk = {}; nextId = 1; nextPacketId = 1;
      crossed = { 50: false, 90: false, 100: false };
      firstLegitRejected = false;
      effects = { cookies: 0, firewall: 0, rateLimit: 0, shortTimeout: 0 };
    }

    state = freshState();
    resetRunData();

    // ---- events ------------------------------------------------------------
    function emit(name, payload) {
      (handlers[name] || []).slice().forEach(function (h) {
        try { h(payload); } catch (e) { if (window.console) console.error('[Lab.Engine] handler for "' + name + '" threw:', e); }
      });
    }
    function log(level, message) { emit('log', { t: state.t, level: level, message: message }); }

    // ---- one simulated second ----------------------------------------------
    function step() {
      var m = state.metrics;
      var mit = state.mitigation;
      var t = ++state.t;
      var packets = { legit: [], attack: [] };   // candidates for animation

      // 1. expire timed-out half-open entries
      var kept = [], expired = 0;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.expiresAt !== null && e.expiresAt <= t) {
          expired++;
          if (packets.attack.length < 40) packets.attack.push({ type: 'rst', source: e.source, outcome: 'timeout' });
        } else {
          kept.push(e);
        }
      }
      entries = kept;
      m.timedOut += expired;
      if (mit.shortTimeout) effects.shortTimeout += expired;

      // 2. generate arrivals (random order, so legit and attack SYNs compete for free slots fairly)
      var arrivals = [];
      var lvl = state.mode === 'attack' ? params.levels[state.level] : null;
      var legitCount = params.legitRate;
      for (i = 0; i < legitCount; i++) arrivals.push({ source: 'legit', cohort: t, retriesLeft: params.legitRetries });
      var due = [];
      retries = retries.filter(function (r) { if (r.due <= t) { due.push(r); return false; } return true; });
      due.forEach(function (r) { arrivals.push({ source: 'legit', cohort: r.cohort, retriesLeft: r.left }); });   // retransmitted SYNs
      if (lvl) for (i = 0; i < lvl.rate; i++) arrivals.push({ source: 'attack', incomplete: rng() < lvl.incompleteFrac });
      for (i = arrivals.length - 1; i > 0; i--) {
        var j = Math.floor(rng() * (i + 1));
        var tmp = arrivals[i]; arrivals[i] = arrivals[j]; arrivals[j] = tmp;
      }
      m.synIncoming = arrivals.length;
      m.synTotal += arrivals.length;
      m.legitAttempted += legitCount;                       // retries are not new attempts
      cohortAttempted[t] = legitCount;
      cohortOk[t] = 0;

      // 3 + 4. firewall, rate limit, then slot / cookie / reject
      var attackAccepted = 0, cookiesThisSecond = 0;
      for (i = 0; i < arrivals.length; i++) {
        var a = arrivals[i];
        var isAttack = a.source === 'attack';
        var outcome;

        if (mit.firewall && rng() < (isAttack ? params.firewallAttackDrop : params.firewallLegitDrop)) {
          outcome = 'filtered';
          if (isAttack) effects.firewall++;
        } else if (isAttack && mit.rateLimit && attackAccepted >= params.rateLimitPerSec) {
          outcome = 'filtered';
          effects.rateLimit++;
        } else {
          if (isAttack) attackAccepted++;
          if (entries.length < params.capacity) {
            var timeout = mit.shortTimeout ? params.shortTimeoutSec : params.timeoutSec;
            var spread = 1 + params.timeoutJitter * (rng() * 2 - 1);
            var entry = { id: nextId++, source: a.source, createdAt: t, expiresAt: null, completesAt: null, cohort: a.cohort };
            if (isAttack && a.incomplete) entry.expiresAt = t + Math.max(1, Math.round(timeout * spread));
            else entry.completesAt = t + params.legitHandshakeSec;
            entries.push(entry);
            outcome = 'queued';
          } else if (mit.synCookies) {
            // queue full: a stateless SYN-ACK costs CPU but no slot. Legit clients still finish the handshake.
            outcome = 'cookie';
            cookiesThisSecond++;
            effects.cookies++;
            if (!isAttack) { m.legitCompleted++; cohortOk[a.cohort]++; }
          } else {
            outcome = 'rejected';
            if (!isAttack && a.retriesLeft > 0) retries.push({ cohort: a.cohort, due: t + params.retryDelaySec, left: a.retriesLeft - 1 });
            if (!isAttack && !firstLegitRejected) {
              firstLegitRejected = true;
              log('danger', 'The queue is full: the first legitimate connection was just rejected');
            }
          }
        }

        if (outcome === 'filtered') m.filtered++;
        if (outcome === 'rejected') m.rejected++;
        // animation candidates: all attack SYNs, plus every legit SYN that did not simply queue
        if (isAttack) packets.attack.push({ type: 'syn', source: 'attack', outcome: outcome });
        else if (outcome !== 'queued') packets.legit.push({ type: 'syn', source: 'legit', outcome: outcome });
      }

      // 5. handshakes that have run long enough complete and free their slots
      kept = [];
      for (i = 0; i < entries.length; i++) {
        var en = entries[i];
        if (en.completesAt !== null && en.completesAt <= t) {
          if (en.source === 'legit') {
            m.legitCompleted++;
            cohortOk[en.cohort]++;
            packets.legit.push({ type: 'ack', source: 'legit', outcome: 'completed' });
          }
        } else {
          kept.push(en);
        }
      }
      entries = kept;

      // 6. metrics from the queue
      var legitIn = 0, attackIn = 0;
      for (i = 0; i < entries.length; i++) { if (entries[i].source === 'legit') legitIn++; else attackIn++; }
      state.queue.legit = legitIn;
      state.queue.attack = attackIn;
      m.pending = entries.length;
      m.queueUtil = round1(m.pending / params.capacity * 100);
      m.cpu = round1(Math.min(100, params.cpuBase + params.cpuPerPending * m.pending +
        params.cpuPerSyn * m.synIncoming + params.cpuPerCookie * cookiesThisSecond));
      m.responseTimeMs = Math.round(params.respBaseMs + params.respQueueMs * Math.pow(m.queueUtil / 100, 3) +
        params.respCpuMsPerPct * Math.max(0, m.cpu - params.cpuKnee));

      // availability: only fully resolved seconds count. A legit SYN may be retried once and then needs 1 s to
      // finish its handshake, so the window ends 2 s ago: [t-window-1 .. t-2].
      var att = 0, ok = 0;
      for (var w = t - params.availabilityWindow - 1; w <= t - 2; w++) {
        if (cohortAttempted[w]) { att += cohortAttempted[w]; ok += cohortOk[w]; }
      }
      m.availability = att === 0 ? 100 : round1(ok / att * 100);

      var from = state.serverState;
      state.serverState = deriveServerState(m);

      state.history.push({
        t: t, pending: m.pending, queueUtil: m.queueUtil, cpu: m.cpu,
        responseTimeMs: m.responseTimeMs, availability: m.availability
      });

      // events
      if (from !== state.serverState) {
        emit('serverStateChange', { from: from, to: state.serverState, t: t });
        log(state.serverState === 'Healthy' ? 'success' : (state.serverState === 'Unavailable' ? 'danger' : 'warn'),
          'Server state changed: ' + from + ' → ' + state.serverState);
      }
      [50, 90, 100].forEach(function (lvlPct) {
        var reached = lvlPct === 100 ? m.pending >= params.capacity : m.queueUtil >= lvlPct;
        if (reached && !crossed[lvlPct]) {
          crossed[lvlPct] = true;
          log(lvlPct === 100 ? 'danger' : 'warn', lvlPct === 100
            ? 'The connection queue is full (' + params.capacity + '/' + params.capacity + ')'
            : 'The connection queue passed ' + lvlPct + '% (' + m.pending + '/' + params.capacity + ')');
        }
      });
      if (t % 10 === 0) flushEffects();
      emitPackets(packets);
      emit('tick', clone(state));

      if (t >= duration) { finish(false); return false; }
      return true;
    }

    // Aggregate mitigation effects into occasional log lines (never a fixed script).
    function flushEffects() {
      if (effects.cookies) log('success', 'SYN cookies answered ' + effects.cookies + ' SYNs without using queue slots');
      if (effects.firewall) log('info', 'The firewall dropped ' + effects.firewall + ' attack SYNs before they reached the queue');
      if (effects.rateLimit) log('info', 'Rate limiting filtered ' + effects.rateLimit + ' excess SYNs from the traffic generator');
      if (effects.shortTimeout) log('info', 'Shorter timeouts freed ' + effects.shortTimeout + ' half-open slots early');
      effects = { cookies: 0, firewall: 0, rateLimit: 0, shortTimeout: 0 };
    }

    // At most 12 packets per tick, sampled between legit and attack so the animation never floods.
    function emitPackets(packets) {
      function pick(list, n) {
        var copy = list.slice(), out = [];
        while (copy.length && out.length < n) out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
        return out;
      }
      var legit = pick(packets.legit, MAX_LEGIT_PACKETS);
      var attack = pick(packets.attack, MAX_PACKETS_PER_TICK - legit.length);
      legit.concat(attack).forEach(function (p) {
        emit('packet', { id: nextPacketId++, type: p.type, source: p.source, outcome: p.outcome });
      });
    }

    // ---- run lifecycle -----------------------------------------------------
    function begin(mode, level, seconds, useTimer) {
      if (state.running) return false;                       // never two runs, never two timers
      var mitigation = state.mitigation;
      state = freshState();
      state.mitigation = mitigation;
      state.running = true;
      state.mode = mode;
      state.level = level;
      rng = mulberry32(params.seed);                        // same settings => identical numbers on every run
      resetRunData();
      duration = seconds;
      summary = null;

      var enabled = MITIGATION_KEYS.filter(function (k) { return mitigation[k]; }).map(function (k) { return MITIGATION_LABELS[k]; });
      var defence = enabled.length ? ' Defences on: ' + enabled.join(', ') + '.' : ' No defences enabled.';
      if (mode === 'baseline') {
        log('info', 'Baseline traffic started: ' + params.legitRate + ' legitimate SYN/s (simulated).' + defence);
      } else {
        var l = params.levels[level];
        log('warn', 'SYN flood started at ' + level + ' level: ' + l.rate + ' SYN/s, ' + Math.round(l.incompleteFrac * 100) +
          '% never complete (simulated).' + defence);
      }
      clearInterval(timer);
      timer = null;
      if (useTimer) timer = setInterval(step, params.tickMs);
      return true;
    }

    function finish(stoppedEarly) {
      clearInterval(timer);
      timer = null;
      if (!state.running) return;
      state.running = false;

      // handshakes already in flight finish rather than being cut off mid-way
      var m = state.metrics;
      entries.forEach(function (en) {
        if (en.source === 'legit' && en.completesAt !== null && en.completesAt <= state.t + params.legitHandshakeSec) {
          m.legitCompleted++;
          cohortOk[en.cohort]++;
          en.completesAt = state.t;
        }
      });
      flushEffects();

      var h = state.history, n = h.length;
      var sum = function (k) { return h.reduce(function (acc, r) { return acc + r[k]; }, 0); };
      summary = {
        mode: state.mode, level: state.level, mitigation: clone(state.mitigation),
        duration: state.t,
        peakPending: h.reduce(function (a, r) { return Math.max(a, r.pending); }, 0),
        avgQueueUtil: n ? round1(sum('queueUtil') / n) : 0,
        peakCpu: h.reduce(function (a, r) { return Math.max(a, r.cpu); }, 0),
        avgResponseTimeMs: n ? Math.round(sum('responseTimeMs') / n) : params.respBaseMs,
        legitSuccessRate: m.legitAttempted ? round1(m.legitCompleted / m.legitAttempted * 100) : 100,
        minAvailability: n ? h.reduce(function (a, r) { return Math.min(a, r.availability); }, 100) : 100,
        avgAvailability: n ? round1(sum('availability') / n) : 100,
        finalServerState: state.serverState,
        stoppedEarly: !!stoppedEarly
      };
      log('info', stoppedEarly
        ? 'Run stopped at t = ' + state.t + ' s. The state is kept so you can study it.'
        : 'Run finished after ' + state.t + ' simulated seconds.');
      emit('runEnded', clone(summary));
    }

    // ---- public API --------------------------------------------------------
    return {
      runBaseline: function () { begin('baseline', null, params.baselineSeconds, true); },
      runAttack: function (level) {
        if (!params.levels[level]) { if (window.console) console.warn('[Lab.Engine] unknown attack level:', level); return; }
        begin('attack', level, params.attackSeconds, true);
      },
      stop: function () { if (state.running) finish(true); },
      reset: function () {
        clearInterval(timer);
        timer = null;
        state = freshState();
        summary = null;
        rng = mulberry32(params.seed);
        resetRunData();
      },
      setMitigation: function (m) {
        if (state.running) { if (window.console) console.warn('[Lab.Engine] setMitigation ignored while a run is active'); return; }
        MITIGATION_KEYS.forEach(function (k) { if (m && typeof m[k] === 'boolean') state.mitigation[k] = m[k]; });
      },
      isRunning: function () { return state.running; },
      getState: function () { return clone(state); },
      getSummary: function () { return summary ? clone(summary) : null; },
      on: function (name, handler) {
        (handlers[name] = handlers[name] || []).push(handler);
        return function () { handlers[name] = (handlers[name] || []).filter(function (h) { return h !== handler; }); };
      },

      // test hooks (used by tests/engine.test.js): run without timers
      _beginForTests: function (mode, level) {
        return begin(mode, level, mode === 'baseline' ? params.baselineSeconds : params.attackSeconds, false);
      },
      _stepForTests: function () { return state.running ? step() : false; }
    };
  }

  Lab.Engine = { create: create, DEFAULTS: DEFAULTS };
})(window.Lab);
