/* Engine tests (plain Node, no libraries): node tests/engine.test.js
   Loads js/engine.js in a vm with a fake window, runs every scenario synchronously through
   engine._beginForTests / engine._stepForTests and checks the CONTRACT §5.4 target outcomes. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
function loadEngine() {
  const win = { console, setInterval, clearInterval, setTimeout, clearTimeout };
  win.window = win;
  vm.runInNewContext(src, vm.createContext(win));
  return win.Lab.Engine;
}
const Engine = loadEngine();

function run(mode, level, mitigation, overrides) {
  const e = Engine.create(overrides);
  e.setMitigation(mitigation || {});
  let ended = null;
  e.on('runEnded', (s) => { ended = s; });
  e._beginForTests(mode, level);
  while (e._stepForTests()) { /* run to the end */ }
  return { summary: ended, state: e.getState() };
}

const ALL = { synCookies: true, rateLimit: true, shortTimeout: true, firewall: true };
const scenarios = [
  ['Baseline',                 'baseline', null,     {}],
  ['Low',                      'attack',   'low',    {}],
  ['Medium',                   'attack',   'medium', {}],
  ['High',                     'attack',   'high',   {}],
  ['Medium + SYN cookies',     'attack',   'medium', { synCookies: true }],
  ['Medium + rate limiting',   'attack',   'medium', { rateLimit: true }],
  ['Medium + shorter timeout', 'attack',   'medium', { shortTimeout: true }],
  ['Medium + firewall',        'attack',   'medium', { firewall: true }],
  ['Medium + all four',        'attack',   'medium', ALL],
  ['High + all four',          'attack',   'high',   ALL]
];

const results = {};
// "steady" availability = mean over t >= 10. The availability metric is a 5-second window, so the first
// seconds of a run still contain pre-attack traffic; steady-state is what a student sees once the attack bites.
const steady = (r) => {
  const h = r.state.history.filter((x) => x.t >= 10);
  return Math.round(h.reduce((a, x) => a + x.availability, 0) / h.length * 10) / 10;
};
const rows = scenarios.map(([name, mode, level, mit]) => {
  const r = run(mode, level, mit);
  results[name] = r;
  r.steady = steady(r);
  const s = r.summary;
  return {
    scenario: name, finalState: s.finalServerState, finalAvail: r.state.metrics.availability, steadyAvail: r.steady,
    avgAvail: s.avgAvailability, minAvail: s.minAvailability, peakPending: s.peakPending,
    peakCpu: s.peakCpu, legitSuccess: s.legitSuccessRate, avgRespMs: s.avgResponseTimeMs
  };
});
console.table(rows);

let failures = 0;
function check(ok, msg) { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; }
const fin = (n) => results[n].state.metrics.availability;
const ss = (n) => results[n].steady;
const st = (n) => results[n].summary.finalServerState;

check(st('Baseline') === 'Healthy' && fin('Baseline') === 100 && ss('Baseline') === 100, 'Baseline: Healthy, ~100% availability');
check(st('Low') === 'Under Pressure' && fin('Low') >= 90 && ss('Low') >= 90, 'Low: Under Pressure, availability >= 90%');
check(st('Medium') === 'Degraded' && fin('Medium') >= 15 && fin('Medium') <= 60 && ss('Medium') >= 15 && ss('Medium') <= 60,
  'Medium: Degraded, availability between 15% and 60%');
check(st('High') === 'Unavailable' && fin('High') < 15 && ss('High') < 15, 'High: Unavailable, availability < 15%');
['Medium + SYN cookies', 'Medium + rate limiting', 'Medium + shorter timeout', 'Medium + firewall'].forEach((n) => {
  check(ss(n) >= ss('Medium') + 8, n + ': availability clearly better than Medium without (' + ss(n) + '% vs ' + ss('Medium') + '%)');
});
check(['Healthy', 'Under Pressure'].includes(st('Medium + all four')) && fin('Medium + all four') >= 90 && ss('Medium + all four') >= 90,
  'Medium + all four defences: Healthy or Under Pressure, availability >= 90%');
check(results['Medium + all four'].summary.legitSuccessRate < 100 && results['High + all four'].summary.legitSuccessRate < 100,
  'No configuration claims 100% protection (the firewall still drops some legitimate SYNs)');

// determinism: same settings twice -> identical summaries
const a = run('attack', 'medium', { synCookies: true, rateLimit: true });
const b = run('attack', 'medium', { synCookies: true, rateLimit: true });
check(JSON.stringify(a.summary) === JSON.stringify(b.summary), 'Determinism: the same settings twice give identical summaries');
const c = run('attack', 'medium', {}, { seed: 7 });
check(JSON.stringify(c.summary) !== JSON.stringify(results['Medium'].summary), 'A different seed changes the result');

// stop() halts state changes immediately and keeps the state for study
{
  const e = Engine.create();
  let ended = 0;
  e.on('runEnded', () => { ended++; });
  e._beginForTests('attack', 'high');
  for (let i = 0; i < 6; i++) e._stepForTests();
  e.stop();
  const frozen = JSON.stringify(e.getState());
  check(!e.isRunning() && !e._stepForTests(), 'stop(): not running and further steps do nothing');
  check(JSON.stringify(e.getState()) === frozen, 'stop(): state frozen');
  e.stop(); e.stop();
  check(ended === 1, 'stop() called repeatedly emits runEnded exactly once');
  check(e.getSummary().stoppedEarly === true && e.getSummary().duration === 6, 'stop(): summary has stoppedEarly=true and the stop time');
  e.reset();
  check(e.getSummary() === null && e.getState().t === 0 && e.getState().history.length === 0 &&
    e.getState().queue.attack === 0 && !e.getState().mitigation.firewall, 'reset(): clears queue, metrics, history, summary and mitigation');
}

// API guards
{
  const e = Engine.create({ capacity: 50 });
  check(e.getState().queue.capacity === 50 && e.getState().params.capacity === 50, 'create(overrides): overrides merge into DEFAULTS');
  e._beginForTests('baseline');
  e.setMitigation({ firewall: true });
  check(e.getState().mitigation.firewall === false, 'setMitigation is ignored while running');
  check(e._beginForTests('attack', 'low') === false, 'a second run cannot start while one is running');
  const s1 = e.getState(); s1.metrics.pending = 999;
  check(e.getState().metrics.pending !== 999, 'getState() returns a deep copy');
  let n = 0; const off = e.on('tick', () => { n++; }); e._stepForTests(); off(); e._stepForTests();
  check(n === 1, 'engine.on returns a working unsubscribe function');
}

// events: packets are capped at 12 per tick and the right event types appear
{
  const e = Engine.create();
  const perTick = []; let cur = 0; const seen = {};
  e.on('packet', (p) => { cur++; seen[p.outcome] = true; });
  e.on('tick', () => { perTick.push(cur); cur = 0; });
  e.on('log', () => { seen.log = true; });
  e.on('serverStateChange', () => { seen.state = true; });
  e._beginForTests('attack', 'high');
  while (e._stepForTests()) { /* run */ }
  check(Math.max.apply(null, perTick) <= 12, 'at most 12 packet events per tick (max ' + Math.max.apply(null, perTick) + ')');
  check(seen.queued && seen.rejected && seen.timeout && seen.log && seen.state, 'packet outcomes, logs and serverStateChange are emitted');
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll engine checks passed');
process.exit(failures ? 1 : 0);
