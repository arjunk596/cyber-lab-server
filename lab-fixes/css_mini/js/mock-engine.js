/* ==========================================================================
   mock-engine.js — OWNER: Manvith Karkera
   DEV ONLY. Not shipped: build.js excludes this file from dist/script.js.
   Purpose: a fake Lab.Engine so Pranav/Yash/Sanika can build the visuals,
   dashboard and styling before the real engine (engine.js) is ready.
   It replaces Lab.Engine.create ONLY when the URL contains ?mock=1 and
   implements the full CONTRACT §5.2 API with plausible, non-modelled numbers:
   the queue fills over ~10 ticks toward a target set by the attack level, and
   every enabled mitigation shrinks that target so the server recovers.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  if (!/[?&]mock=1(&|$)/.test(window.location.search)) return;

  var TICK_MS = 500;
  var CAPACITY = 100;
  var RATES = { low: 4, medium: 15, high: 50 };
  var TARGET_PENDING = { baseline: 5, low: 62, medium: 88, high: 100 }; // queue level the attack drives toward
  var MITIGATION_FACTOR = 0.6;                                          // each defence shrinks the target by 40%

  function create() {
    var timer = null;
    var handlers = {};
    var state, summary, lastSummary = null, notifiedLevels, ticksLeft, duration;

    function freshState() {
      return {
        t: 0, running: false, mode: 'idle', level: null, params: { tickMs: TICK_MS },
        mitigation: { synCookies: false, rateLimit: false, shortTimeout: false, firewall: false },
        queue: { capacity: CAPACITY, legit: 0, attack: 0 },
        metrics: {
          synIncoming: 0, synTotal: 0, pending: 0, legitAttempted: 0, legitCompleted: 0,
          rejected: 0, timedOut: 0, filtered: 0, queueUtil: 0, cpu: 0, responseTimeMs: 40, availability: 100
        },
        serverState: 'Healthy', history: []
      };
    }

    function emit(name, payload) {
      (handlers[name] || []).slice().forEach(function (h) { h(payload); });
    }

    function log(level, message) { emit('log', { t: state.t, level: level, message: message }); }

    function mitigationCount() {
      var m = state.mitigation;
      return (m.synCookies ? 1 : 0) + (m.rateLimit ? 1 : 0) + (m.shortTimeout ? 1 : 0) + (m.firewall ? 1 : 0);
    }

    function deriveServerState(m) {
      if (m.availability < 15) return 'Unavailable';
      if (m.availability < 70 || m.queueUtil > 95) return 'Degraded';
      if (m.availability < 95 || m.queueUtil >= 60 || m.cpu >= 70) return 'Under Pressure';
      return 'Healthy';
    }

    function step() {
      var m = state.metrics;
      state.t += 1;

      var key = state.mode === 'baseline' ? 'baseline' : state.level;
      var target = TARGET_PENDING[key] * Math.pow(MITIGATION_FACTOR, mitigationCount());
      var pending = m.pending + (target - m.pending) * 0.25; // approaches the target in ~10 ticks
      pending = Math.max(0, Math.min(CAPACITY, pending));

      var legitIn = 5;
      var attackIn = state.mode === 'attack' ? RATES[state.level] : 0;
      m.synIncoming = legitIn + attackIn;
      m.synTotal += m.synIncoming;
      m.legitAttempted += legitIn;

      m.pending = Math.round(pending);
      m.queueUtil = Math.round((m.pending / CAPACITY) * 100);
      m.availability = m.pending <= 60 ? 100 : Math.max(0, Math.round(100 - (m.pending - 60) * 2.5));
      m.legitCompleted += Math.round(legitIn * m.availability / 100);
      m.rejected += legitIn - Math.round(legitIn * m.availability / 100);
      m.cpu = Math.min(100, Math.round(8 + 0.5 * m.pending + 0.3 * m.synIncoming));
      m.responseTimeMs = Math.round(40 + 1500 * Math.pow(m.queueUtil / 100, 3));

      var attackShare = state.mode === 'attack' ? Math.round(m.pending * attackIn / (attackIn + legitIn)) : 0;
      state.queue.attack = attackShare;
      state.queue.legit = m.pending - attackShare;

      var from = state.serverState;
      state.serverState = deriveServerState(m);

      state.history.push({
        t: state.t, pending: m.pending, queueUtil: m.queueUtil, cpu: m.cpu,
        responseTimeMs: m.responseTimeMs, availability: m.availability
      });

      emit('tick', JSON.parse(JSON.stringify(state)));

      // A few sampled packets so the animation has something to show.
      var types = ['completed', 'queued', 'rejected', 'filtered', 'cookie'];
      for (var i = 0; i < Math.min(6, m.synIncoming); i++) {
        var attack = state.mode === 'attack' && i % 2 === 0;
        emit('packet', {
          id: state.t * 100 + i, type: 'syn', source: attack ? 'attack' : 'legit',
          outcome: m.queueUtil >= 100 ? 'rejected' : (attack ? 'queued' : 'completed')
        });
      }

      if (from !== state.serverState) {
        emit('serverStateChange', { from: from, to: state.serverState, t: state.t });
        log(state.serverState === 'Healthy' ? 'success' : (state.serverState === 'Unavailable' ? 'danger' : 'warn'),
            'Server state changed to ' + state.serverState);
      }
      [50, 90, 100].forEach(function (lvl) {
        if (m.queueUtil >= lvl && notifiedLevels.indexOf(lvl) === -1) {
          notifiedLevels.push(lvl);
          log(lvl === 100 ? 'danger' : 'warn', 'Queue reached ' + lvl + '%');
        }
      });

      ticksLeft -= 1;
      if (ticksLeft <= 0) finish(false);
    }

    function finish(stoppedEarly) {
      clearInterval(timer);
      timer = null;
      state.running = false;
      var h = state.history;
      var sum = function (k) { return h.reduce(function (a, r) { return a + r[k]; }, 0); };
      var m = state.metrics;
      summary = {
        mode: state.mode, level: state.level, mitigation: JSON.parse(JSON.stringify(state.mitigation)),
        duration: state.t,
        peakPending: h.reduce(function (a, r) { return Math.max(a, r.pending); }, 0),
        avgQueueUtil: h.length ? Math.round(sum('queueUtil') / h.length) : 0,
        peakCpu: h.reduce(function (a, r) { return Math.max(a, r.cpu); }, 0),
        avgResponseTimeMs: h.length ? Math.round(sum('responseTimeMs') / h.length) : 40,
        legitSuccessRate: m.legitAttempted ? Math.round(m.legitCompleted / m.legitAttempted * 100) : 100,
        minAvailability: h.reduce(function (a, r) { return Math.min(a, r.availability); }, 100),
        avgAvailability: h.length ? Math.round(sum('availability') / h.length) : 100,
        finalServerState: state.serverState, stoppedEarly: stoppedEarly
      };
      lastSummary = summary;
      log('info', stoppedEarly ? 'Run stopped by the student' : 'Run finished');
      emit('runEnded', JSON.parse(JSON.stringify(summary)));
    }

    function start(mode, level, seconds) {
      if (state.running) return;
      var mitigation = state.mitigation;
      state = freshState();
      state.mitigation = mitigation;
      state.running = true;
      state.mode = mode;
      state.level = level;
      notifiedLevels = [];
      ticksLeft = duration = seconds;
      log('info', mode === 'baseline' ? 'Baseline traffic started' : 'SYN flood started at level ' + level);
      clearInterval(timer);
      timer = setInterval(step, TICK_MS);
    }

    state = freshState();

    return {
      runBaseline: function () { start('baseline', null, 20); },
      runAttack: function (level) { start('attack', RATES[level] ? level : 'medium', 40); },
      stop: function () {
        if (timer) { finish(true); } // stopping when idle is a harmless no-op
      },
      reset: function () {
        clearInterval(timer);
        timer = null;
        state = freshState();
        lastSummary = null;
      },
      setMitigation: function (m) {
        if (state.running) { console.warn('[mock-engine] setMitigation ignored while running'); return; }
        Object.keys(state.mitigation).forEach(function (k) {
          if (m && typeof m[k] === 'boolean') state.mitigation[k] = m[k];
        });
      },
      isRunning: function () { return state.running; },
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      getSummary: function () { return lastSummary ? JSON.parse(JSON.stringify(lastSummary)) : null; },
      on: function (name, handler) {
        (handlers[name] = handlers[name] || []).push(handler);
        return function () {
          handlers[name] = (handlers[name] || []).filter(function (h) { return h !== handler; });
        };
      }
    };
  }

  Lab.Engine = Lab.Engine || {};
  Lab.Engine.create = create;
  console.info('[Lab] MOCK ENGINE active (?mock=1) — dev only');
})(window.Lab);
