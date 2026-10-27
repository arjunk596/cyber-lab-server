# CONTRACT.md — SYN Flood Virtual Lab

Source of truth for every id, class, function name, event and data shape.
Nobody renames anything here without telling Manvith. If something must
change, Manvith updates this file and announces it in the group.

## 5.1 JavaScript namespaces

No ES modules and no libraries (the page must open via `file://`). Every JS
file uses this wrapper and only adds its own key to `window.Lab`:

```js
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';
  // private helpers here
  Lab.Engine = { /* public API */ };
})(window.Lab);
```

Load order: `content.js`, `icons.js`, `engine.js`, `mock-engine.js` (dev only),
`visuals.js`, `dashboard.js`, `quiz.js`, `workflow.js`. Only `workflow.js`
runs code on `DOMContentLoaded`; every other file only defines functions.

## 5.2 Engine API (Lab.Engine, owner: Manvith)

```js
const engine = Lab.Engine.create(overrides?);  // overrides merge into DEFAULTS (5.4)
engine.runBaseline();            // legitimate traffic only, 20 simulated seconds
engine.runAttack(level);         // 'low' | 'medium' | 'high'; 40 simulated seconds; uses current mitigation
engine.stop();                   // clears the timer immediately; keeps all state for study
engine.reset();                  // stops, clears queue/metrics/history/mitigation, reseeds RNG
engine.setMitigation({ synCookies, rateLimit, shortTimeout, firewall }); // booleans; only while not running
engine.isRunning();              // boolean
engine.getState();               // deep copy of State (5.3)
engine.getSummary();             // RunSummary of the most recent run, or null
engine.on(eventName, handler);   // returns an unsubscribe function
```

| Event              | Payload                              | Emitted when                                          |
|--------------------|--------------------------------------|-------------------------------------------------------|
| `tick`             | State                                | Every simulated second while running                  |
| `packet`           | `{ id, type, source, outcome }`      | A simulated packet worth animating (max 12 per tick, sampled) |
| `serverStateChange`| `{ from, to, t }`                    | Server state changes (5.4 thresholds)                 |
| `log`              | `{ t, level, message }`              | Meaningful model changes, e.g. queue passes 50/90/100% |
| `runEnded`         | RunSummary                           | Run reaches its duration or `stop()` is called        |

Packet fields: `type` is `'syn' | 'synack' | 'ack' | 'rst'`; `source` is
`'legit' | 'attack'`; `outcome` is
`'queued' | 'completed' | 'rejected' | 'timeout' | 'filtered' | 'cookie'`.
Log `level` is `'info' | 'success' | 'warn' | 'danger'`.

## 5.3 Data shapes

```js
State = {
  t: 0,                          // simulated seconds since run start
  running: false,
  mode: 'idle',                  // 'idle' | 'baseline' | 'attack'
  level: null,                   // 'low' | 'medium' | 'high' | null
  params: { ...DEFAULTS },
  mitigation: { synCookies: false, rateLimit: false, shortTimeout: false, firewall: false },
  queue: { capacity: 100, legit: 0, attack: 0 },   // occupied half-open slots by source
  metrics: {
    synIncoming: 0,              // SYNs that arrived this second
    synTotal: 0,
    pending: 0,                  // half-open connections right now
    legitAttempted: 0, legitCompleted: 0,          // cumulative for this run
    rejected: 0, timedOut: 0, filtered: 0,         // cumulative
    queueUtil: 0,                // % 0-100
    cpu: 0,                      // % 0-100
    responseTimeMs: 40,
    availability: 100            // % legit success over the last 5 simulated seconds
  },
  serverState: 'Healthy',        // 'Healthy' | 'Under Pressure' | 'Degraded' | 'Unavailable'
  history: []                    // [{ t, pending, queueUtil, cpu, responseTimeMs, availability }]
};

RunSummary = {
  mode, level, mitigation,       // what was run
  duration, peakPending, avgQueueUtil, peakCpu, avgResponseTimeMs,
  legitSuccessRate,              // % legitCompleted / legitAttempted for the whole run
  minAvailability, avgAvailability, finalServerState, stoppedEarly
};
```

## 5.4 Simulation model

All numbers are educational estimates and must be labelled **Simulated data**
in the UI.

| Parameter          | Default                                                                  |
|--------------------|--------------------------------------------------------------------------|
| Tick               | 500 ms real time = 1 simulated second                                    |
| Queue capacity     | 100 half-open slots                                                      |
| Legitimate traffic | 5 SYN/s, every one completes its handshake after 1 s (if it got a slot)  |
| Pending timeout    | 30 s (5 s with *Shorter timeouts*)                                       |
| Attack Low         | 4 SYN/s, 50% never complete                                              |
| Attack Medium      | 15 SYN/s, 80% never complete                                             |
| Attack High        | 50 SYN/s, 95% never complete                                             |
| Rate limiting      | Accept at most 8 SYN/s from the traffic generator; the rest are `filtered` |
| Firewall filtering | Drops 70% of attack SYNs (`filtered`); wrongly drops 2% of legit SYNs    |
| SYN cookies        | When the queue is full, new SYNs get a stateless SYN-ACK (`cookie`) instead of being rejected: no slot used, legit still completes, extra CPU cost |
| Randomness         | Seeded PRNG (mulberry32, seed 1337) so every run with the same settings gives the same result |

**Cause and effect per tick:** expire timed-out entries -> generate arrivals ->
apply firewall and rate limit -> each remaining SYN takes a free slot, else
becomes a cookie (if enabled) or is `rejected` -> legit entries complete after
1 s and free their slot -> recompute metrics -> derive server state.

**Formulas (starting point; Manvith may tune constants):**

- `queueUtil = pending / capacity * 100`
- `cpu = min(100, 8 + 0.5 * pending + 0.3 * synIncoming + 0.4 * cookiesThisSecond)`
- `responseTimeMs = 40 + 1500 * (queueUtil / 100)^3 + 6 * max(0, cpu - 60)`
- `availability` = legit completed / legit attempted over the last 5 s * 100 (100 if no attempts)

**Server state (checked top to bottom):** Unavailable if availability < 15 ·
Degraded if availability < 70 or queueUtil > 95 · Under Pressure if
availability < 95 or queueUtil >= 60 or cpu >= 70 · otherwise Healthy.

**Target outcomes the engine must reproduce:** Baseline -> Healthy, ~100%
availability. Low -> Under Pressure, availability >= 90%. Medium -> Degraded,
availability between 15% and 60%. High -> Unavailable, availability < 15%.
Medium with any single defence -> availability clearly better than Medium
without. Medium with all four defences -> Healthy or Under Pressure with
availability >= 90%. No configuration claims 100% protection.

## 5.5 HTML ids (owner: Manvith's skeleton)

| Area            | ids |
|-----------------|-----|
| Header          | `lab-header`, `btn-theory`, `btn-stop`, `btn-reset`, `btn-restart` |
| Before You Begin| `screen-guidelines`, `lab-objective`, `guidelines-list`, `ack-checkbox`, `btn-start`, `btn-view-theory` |
| Theory          | `section-theory`, `theory-content`, `handshake-demo`, `btn-play-handshake` |
| Stepper         | `stepper`, `step-list` (8 `li` with `data-step="1..8"` and `data-status`), `step-panel`, `step-title`, `step-instructions`, `step-actions` |
| Topology        | `topology`, `topology-svg`, `component-info` |
| Controls        | `btn-baseline`, `attack-level` (select: low/medium/high), `btn-start-flood`, `btn-stop-sim` |
| Dashboard       | `dashboard`, `server-state`, `notifications` (aria-live), `chart-history` (canvas); 8 cards with `data-metric="syn-incoming"`, `"pending"`, `"completed"`, `"rejected"`, `"queue-util"`, `"cpu"`, `"response-time"`, `"availability"` |
| Mitigation      | `mitigation`, `mit-syn-cookies`, `mit-rate-limit`, `mit-short-timeout`, `mit-firewall`, `btn-run-mitigated` |
| Comparison      | `comparison`, `compare-table`, `compare-explanation` |
| Quiz            | `quiz`, `quiz-container`, `quiz-score` |
| Log             | `log`, `log-list` |
| Modals          | `modal-complete` (dialog) with `complete-baseline`, `complete-attack`, `complete-mitigated`, `complete-score`, `complete-status`, `btn-review`, `btn-restart-lab`; `modal-confirm` (dialog) with `confirm-message`, `btn-confirm-yes`, `btn-confirm-no` |

`data-status` values on steps: `locked | ready | in-progress | completed`.

## 5.6 CSS tokens and classes

Yash defines every token in `:root` in `base.css`; everyone else only uses them.

```
--color-bg  --color-surface  --color-surface-2  --color-text  --color-muted  --color-border
--color-primary  --color-primary-contrast  --color-focus
--color-legit  --color-attack  --color-pending  --color-rejected  --color-completed
--color-healthy  --color-pressure  --color-degraded  --color-unavailable
--font-sans  --font-mono  --radius  --radius-sm  --shadow
--space-1 --space-2 --space-3 --space-4 --space-5 --space-6
```

| Owner               | Classes |
|---------------------|---------|
| Yash (`base.css`)   | `.container`, `.section`, `.card`, `.btn`, `.btn--primary`, `.btn--danger`, `.btn--ghost`, `.field`, `.checkbox`, `.toggle`, `.stepper`, `.step`, `.step--locked/--ready/--in-progress/--completed`, `.theory`, `.guidelines`, `.modal`, `.toast`, `.sim-badge`, `.visually-hidden` |
| Sanika (`lab.css`)  | `.topology`, `.node`, `.node--client/--generator/--server/--queue/--status`, `.node.is-selected`, `.link`, `.packet`, `.packet--legit/--attack/--synack/--ack/--rejected/--filtered/--cookie`, `.queue-grid`, `.queue-slot`, `.queue-slot--free/--legit/--attack`, `.metric`, `.metric__label`, `.metric__value`, `.progress`, `.progress__bar`, `.server-badge`, `.server-badge--healthy/--pressure/--degraded/--unavailable`, `.chart`, `.log-entry`, `.log-entry--info/--success/--warn/--danger`, `.compare-table`, `.quiz-question`, `.quiz-option`, `.quiz-option.is-correct`, `.quiz-option.is-wrong`, `.quiz-feedback`, `.component-info`, `.mitigation-item` |

## 5.7 Content and icon shapes

```js
Lab.Content = {
  title, objective, disclaimer,           // strings
  guidelines: [ /* the 9 strings from the brief */ ],
  theory: { tcp, handshake: [{ name: 'SYN', text }, { name: 'SYN-ACK', text }, { name: 'ACK', text }],
            synFlood, availability, analogy },
  components: { client, generator, server, queue, status },   // each { title, text }
  steps: [ { id: 1, title, instructions } /* ...8 steps */ ],
  serverStates: { Healthy, 'Under Pressure', Degraded, Unavailable },  // one-line explanations
  mitigations: { synCookies, rateLimit, shortTimeout, firewall },     // each { title, text, limitation }
  quiz: [ { id, question, options: [4 strings], answer: 0, explanation } /* 6 questions */ ],
  completion: { title, message }
};
Lab.Icons = { client, generator, server, queue, status, shield };  // each an inline SVG string, 24x24 viewBox, stroke="currentColor"
```

## 5.8 Frontend module APIs

`workflow.js` is the only file that wires buttons; the modules below only render.

```js
// Pranav: visuals.js
Lab.Visuals.init(engine);            // draw topology into #topology-svg, subscribe to tick/packet events
Lab.Visuals.playHandshakeDemo();     // animate SYN -> SYN-ACK -> ACK inside #handshake-demo
Lab.Visuals.reset();                 // remove packets, empty queue grid, clear selection

// Pranav: dashboard.js
Lab.Dashboard.init(engine);          // subscribe to tick/serverStateChange/log; render cards, badge, chart
Lab.Dashboard.notify(message, level);// toast + #notifications aria-live text
Lab.Dashboard.renderComparison(runs);// runs = { baseline, attack, mitigated } RunSummaries (any may be null)
Lab.Dashboard.reset();
Lab.Log.add(message, level);         // timestamped entry in #log-list; level as in 5.2
Lab.Log.clear();

// Manvith: quiz.js
Lab.Quiz.init(containerEl, questions, onFinished);   // onFinished({ score, total })
Lab.Quiz.reset();
```

## 5.9 Additions made after the first draft

New ids (all in `index.html` unless noted): `lab-disclaimer`, `run-status`, `run-status-label`, `complete-message`,
`lab-footer-note`, `btn-close-theory` (created by `workflow.js`), `toast-container` (created by `dashboard.js`).
New wrapper classes: `.hero`, `.topology-scroll`, `.controls-row`, `.metrics-grid`, `.run-status`, `.disclaimer`.

Classes that JS creates (styled in `base.css` / `lab.css`): `.compare-change` (`--good/--bad/--up/--down`),
`.log-entry__time/__sim/__level/__message`, `.server-state__name/__desc`, `.toast--info/success/warn/danger`,
`.handshake-caption`, `.handshake-list`, `.analogy`, `.quiz-progress`, `.quiz-options`, `.quiz-option__key/__text`,
`.quiz-actions`, `.quiz-result`, `.mitigation-text`, `.limitation`, `.is-next` (soft highlight on the recommended control).

Sections `section-theory`, `stepper-section`, `topology`, `controls`, `dashboard`, `mitigation`, `comparison`, `quiz`, `log`
start with the `hidden` attribute; `workflow.js` reveals them as the student progresses.

Engine additions: `Lab.Engine.DEFAULTS`, `engine._beginForTests(mode, level)` and `engine._stepForTests()` (test hooks),
DEFAULTS `legitRetries`, `retryDelaySec`, `timeoutJitter`. Test hooks must never be used by the UI.

### 5.10 Part 2 additions (workshop)
New files: `js/workshop-content.js` (`Lab.Content.workshop`, appends 6 questions to `Lab.Content.quiz`), `js/workshop.js` (`Lab.Workshop`: `init(root, {getLevel,onFinished})`, `reset`, `isComplete`, `getSummary`, pure `shell`), `css/workshop.css`.
Steps are now 9 (8 = workshop, 9 = quiz). New ids: `workshop`, `workshop-content`, `complete-hardened`, `workshop-finish`, `btn-ws-test`, `ws-term-input`. Load order: content, workshop-content, icons, engine, visuals, dashboard, quiz, workshop, workflow.
