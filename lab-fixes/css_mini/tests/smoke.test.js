/* Smoke test (plain Node, no packages): run `node tests/smoke.test.js` after `node build.js`.
   1. dist/script.js loads in a stubbed browser without throwing and exposes the full API.
   2. index.html contains every CONTRACT §5.5 id exactly once.
   3. The mock engine (?mock=1) implements the §5.2 API, runs, and ends. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

function sandbox(search) {
  const listeners = [];
  const win = {
    location: { search: search || '' },
    console: { log() {}, info() {}, warn() {}, error() {} }
  };
  win.window = win;
  win.document = { addEventListener: (n, fn) => listeners.push([n, fn]) };
  win.setInterval = setInterval; win.clearInterval = clearInterval;
  win.setTimeout = setTimeout; win.clearTimeout = clearTimeout;
  return { win, listeners, ctx: vm.createContext(win) };
}

// 1. final bundle loads with no errors
const { win, listeners, ctx } = sandbox('');
let loadError = null;
try { vm.runInContext(fs.readFileSync(path.join(root, 'dist/script.js'), 'utf8'), ctx); } catch (e) { loadError = e; }
check(!loadError, 'dist/script.js loads without throwing' + (loadError ? ': ' + loadError.message : ''));
const Lab = win.Lab || {};
const api = {
  Engine: ['create'], Visuals: ['init', 'playHandshakeDemo', 'reset'],
  Dashboard: ['init', 'notify', 'renderComparison', 'reset'], Log: ['add', 'clear'], Quiz: ['init', 'reset'], Workshop: ['init', 'reset', 'getSummary', 'isComplete']
};
for (const [ns, fns] of Object.entries(api)) {
  check(Lab[ns] && fns.every((f) => typeof Lab[ns][f] === 'function'), `Lab.${ns} exposes ${fns.join(', ')}`);
}
const engine = Lab.Engine.create();
const engineApi = ['runBaseline', 'runAttack', 'stop', 'reset', 'setMitigation', 'isRunning', 'getState', 'getSummary', 'on'];
check(engineApi.every((f) => typeof engine[f] === 'function'), 'stub engine has every §5.2 method');
check(typeof engine.on('tick', () => {}) === 'function', 'engine.on returns an unsubscribe function');
check(!!Lab.Content.workshop && Lab.Content.workshop.modules.length === 5, 'Lab.Content.workshop defines the five modules');
check(['title', 'objective', 'disclaimer', 'guidelines', 'theory', 'components', 'steps', 'serverStates', 'mitigations', 'quiz', 'completion']
  .every((k) => k in Lab.Content), 'Lab.Content has every §5.7 key');
check(Lab.Content.guidelines.length === 9 && Lab.Content.steps.length === 9 && Lab.Content.quiz.length === 12,
  'Lab.Content has 9 guidelines, 9 steps, 12 quiz questions');
check(['client', 'generator', 'server', 'queue', 'status', 'shield'].every((k) => k in Lab.Icons), 'Lab.Icons has every key');
check(listeners.length === 1 && listeners[0][0] === 'DOMContentLoaded', 'only workflow.js registers a DOMContentLoaded listener');
// (workflow.js needs a real DOM: it is exercised end to end by tests/e2e.js)

// 2. every contract id exactly once
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = ['lab-header', 'btn-theory', 'btn-stop', 'btn-reset', 'btn-restart', 'screen-guidelines', 'lab-objective',
  'guidelines-list', 'ack-checkbox', 'btn-start', 'btn-view-theory', 'section-theory', 'theory-content', 'handshake-demo',
  'btn-play-handshake', 'stepper', 'step-list', 'step-panel', 'step-title', 'step-instructions', 'step-actions', 'topology',
  'topology-svg', 'component-info', 'btn-baseline', 'attack-level', 'btn-start-flood', 'btn-stop-sim', 'dashboard',
  'server-state', 'notifications', 'chart-history', 'mitigation', 'mit-syn-cookies', 'mit-rate-limit', 'mit-short-timeout',
  'mit-firewall', 'btn-run-mitigated', 'comparison', 'compare-table', 'compare-explanation', 'quiz', 'quiz-container',
  'quiz-score', 'workshop', 'workshop-content', 'complete-hardened', 'log', 'log-list', 'modal-complete', 'complete-baseline', 'complete-attack', 'complete-mitigated',
  'complete-score', 'complete-status', 'btn-review', 'btn-restart-lab', 'modal-confirm', 'confirm-message',
  'btn-confirm-yes', 'btn-confirm-no'];
const count = (id) => (html.match(new RegExp(`\\sid="${id}"`, 'g')) || []).length;
const badIds = ids.filter((id) => count(id) !== 1);
check(badIds.length === 0, `all ${ids.length} contract ids appear exactly once` + (badIds.length ? ': ' + badIds.join(', ') : ''));
const steps = (html.match(/<li [^>]*data-step="[1-8]"[^>]*data-status="locked"/g) || []).length;
check(steps === 8, '8 step <li> elements with data-step and data-status="locked"');
const metrics = ['syn-incoming', 'pending', 'completed', 'rejected', 'queue-util', 'cpu', 'response-time', 'availability'];
check(metrics.every((m) => html.includes(`data-metric="${m}"`)), '8 dashboard cards with data-metric');
check(/<option value="low">/.test(html) && /<option value="medium"/.test(html) && /<option value="high">/.test(html), 'attack-level has low/medium/high');

// 3. mock engine
const mock = sandbox('?mock=1');
for (const f of ['js/content.js', 'js/icons.js', 'js/engine.js', 'js/mock-engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), mock.ctx);
}
const m = mock.win.Lab.Engine.create();
check(engineApi.every((f) => typeof m[f] === 'function'), 'mock engine has every §5.2 method');
const seen = {};
['tick', 'packet', 'serverStateChange', 'log', 'runEnded'].forEach((e) => m.on(e, () => { seen[e] = (seen[e] || 0) + 1; }));
m.setMitigation({ synCookies: false });
m.runAttack('medium');
m.runAttack('high'); // second start while running must not create a second timer
check(m.isRunning(), 'mock engine reports running');

setTimeout(() => {
  m.stop();
  m.stop();
  check(!m.isRunning(), 'stop() halts the run (and repeated stop() is harmless)');
  const t = m.getState().t;
  setTimeout(() => {
    check(m.getState().t === t, 'state does not change after stop()');
    check(['tick', 'packet', 'serverStateChange', 'log', 'runEnded'].every((e) => seen[e] > 0), 'mock emits all five event types: ' + JSON.stringify(seen));
    check(seen.runEnded === 1, 'runEnded emitted exactly once');
    const s = m.getSummary();
    check(s && s.mode === 'attack' && s.level === 'medium' && s.stoppedEarly === true, 'getSummary returns the stopped medium run');
    m.reset();
    check(m.getSummary() === null && m.getState().t === 0, 'reset() clears summary and state');
    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll smoke checks passed');
    process.exit(failures ? 1 : 0);
  }, 1200);
}, 3200);
