/* ==========================================================================
   workflow.js — OWNER: Manvith Karkera
   Purpose: boots the app, renders Lab.Content into the page, runs the 8-step
   state machine, wires every button, handles Stop / Reset / Restart and the
   completion popup. This is the ONLY file that runs code on DOMContentLoaded
   and the only one that wires buttons; the other modules just render.

   The journey (CONTRACT/brief):
     Before You Begin -> Theory -> 1 Review -> 2 Baseline -> 3 Flood -> 4 Observe
     -> 5 Stop -> 6 Mitigation -> 7 Comparison -> 8 Quiz -> Completion popup

   How gating works: every step has a status (locked | ready | in-progress |
   completed) kept in `status[]`. updateControls() derives which buttons are
   enabled from the current step and from engine.isRunning(), so a control that
   makes no sense in the current state is always disabled.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  var STEP_COUNT = 9;
  var NO_DEFENCES = { synCookies: false, rateLimit: false, shortTimeout: false, firewall: false };
  var MIT_INPUTS = {                     // checkbox id -> key in engine.setMitigation / Lab.Content.mitigations
    'mit-syn-cookies': 'synCookies',
    'mit-rate-limit': 'rateLimit',
    'mit-short-timeout': 'shortTimeout',
    'mit-firewall': 'firewall'
  };
  var LAB_SECTIONS = ['stepper-section', 'topology', 'controls', 'dashboard', 'log'];   // visible once the lab starts
  var PASS_PERCENT = 67;

  var C;                                 // Lab.Content
  var engine;
  var started = false;
  var status = [];                       // status[0] is step 1
  var runs = { baseline: null, attack: null, mitigated: null };
  var currentRunKind = null;             // 'baseline' | 'attack' | 'mitigated' while a run is active
  var quiz = { initialised: false, done: false, score: 0, total: 0 };
  var workshop = { initialised: false, done: false, summary: null };
  var shownStep = 0;                     // the step the panel currently shows
  var pendingConfirm = null;
  var terminalPopped = false;            // the terminal opens by itself once, when step 6 starts
  var lastDefences = '';

  // ---- small helpers -------------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function show(el, visible) { if (el) el.hidden = !visible; }
  function setDisabled(id, disabled) { var e = $(id); if (e) e.disabled = !!disabled; }
  function reducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function focusEl(el) { if (el) el.focus({ preventScroll: true }); }
  function scrollToEl(el) {
    if (el) el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function log(message, level) { Lab.Log.add(message, level || 'info'); }
  function notify(message, level) { Lab.Dashboard.notify(message, level || 'info'); }

  function mitigationNames(summaryOrMap) {
    var map = summaryOrMap || {};
    return Object.keys(MIT_INPUTS).map(function (id) { return MIT_INPUTS[id]; })
      .filter(function (k) { return map[k]; })
      .map(function (k) { return C.mitigations[k].title; });
  }

  function selectedMitigation() {
    var m = {};
    Object.keys(MIT_INPUTS).forEach(function (id) { var el = $(id); m[MIT_INPUTS[id]] = !!(el && el.checked); });
    return m;
  }

  function anyMitigationSelected() {
    var m = selectedMitigation();
    return Object.keys(m).some(function (k) { return m[k]; });
  }

  function resultsExist() {
    if (!started) return false;
    return !!(runs.baseline || runs.attack || runs.mitigated || engine.isRunning() ||
      engine.getState().history.length || quiz.initialised || workshop.initialised);
  }

  // ---- rendering Lab.Content -----------------------------------------------
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function renderContent() {
    var h1 = document.querySelector('#lab-header h1');
    if (h1) h1.textContent = C.title;

    var obj = $('lab-objective');
    if (obj) { obj.textContent = ''; obj.appendChild(el('strong', null, 'Objective: ')); obj.appendChild(document.createTextNode(C.objective)); }
    if ($('lab-disclaimer')) $('lab-disclaimer').textContent = C.disclaimer;
    if ($('lab-footer-note')) $('lab-footer-note').textContent = C.disclaimer;

    var list = $('guidelines-list');
    if (list) { list.textContent = ''; C.guidelines.forEach(function (g) { list.appendChild(el('li', null, g)); }); }

    // Theory: TCP, the handshake, simulation, SYN flood, availability, analogy with animated pizza shop illustration.
    var t = $('theory-content');
    if (t) {
      t.textContent = '';
      t.appendChild(el('h3', null, 'What is TCP?'));
      t.appendChild(el('p', null, C.theory.tcp));
      t.appendChild(el('h3', null, 'The three-way handshake'));
      var steps = el('ol', 'handshake-list');
      C.theory.handshake.forEach(function (h) {
        var li = el('li');
        li.appendChild(el('strong', 'handshake-list__name', h.name));
        li.appendChild(document.createTextNode(' ' + h.text));
        steps.appendChild(li);
      });
      t.appendChild(steps);

      // Mount the Handshake Demo directly below the handshake explanation for seamless narrative flow
      var demoHost = $('handshake-demo');
      var replayBtn = $('btn-play-handshake');
      var controlsHost = $('handshake-controls');
      if (demoHost) {
        var demoCard = el('div', 'theory-demo-card');
        demoCard.appendChild(demoHost);
        if (controlsHost) demoCard.appendChild(controlsHost);
        else if (replayBtn) demoCard.appendChild(replayBtn);
        t.appendChild(demoCard);
      }

      t.appendChild(el('h3', null, 'What is a SYN flood?'));
      t.appendChild(el('p', null, C.theory.synFlood));
      t.appendChild(el('h3', null, 'Why availability matters'));
      t.appendChild(el('p', null, C.theory.availability));
      
      var analogy = el('aside', 'analogy');
      analogy.appendChild(el('strong', 'analogy__title', 'An analogy: The Pizza Counter'));
      analogy.appendChild(el('p', null, C.theory.analogy));

      // Visual Pizza Counter Analogy Graphic / Micro-Simulation with Interactive Scenario Stepper
      var pizzaArt = el('div', 'pizza-analogy');
      pizzaArt.setAttribute('aria-label', 'Interactive illustration of how a SYN flood exhausts server queue');
      pizzaArt.innerHTML = 
        '<div class="pizza-art-header">' +
          '<div class="pizza-art-badge"><span>\uD83C\uDF55</span> Visual Analogy: How SYN Flood Starves Availability</div>' +
          '<div class="pizza-art-controls">' +
            '<button type="button" class="btn btn--sm pizza-btn--sim" id="btn-pizza-flood">Simulate SYN Flood</button>' +
            '<button type="button" class="btn btn--sm pizza-btn--reset" id="btn-pizza-reset">Reset Counter</button>' +
          '</div>' +
        '</div>' +
        '<div class="pizza-art-stage" id="pizza-stage">' +
          '<div class="pizza-art-actor pizza-art-actor--attacker">' +
            '<div class="pizza-actor-icon">\uD83D\uDCDE</div>' +
            '<div class="pizza-actor-title">Spoofed Attackers</div>' +
            '<div class="pizza-actor-sub">Phone in 100s of fake orders and hang up (Spoofed SYN packets)</div>' +
            '<div class="pizza-actor-feed" id="pizza-feed-attack">' +
              '<div class="pizza-order-ticket is-flood">\u26A0 Fake Call #1042 \u2192 (Never collects)</div>' +
              '<div class="pizza-order-ticket is-flood">\u26A0 Fake Call #1043 \u2192 (Never collects)</div>' +
            '</div>' +
          '</div>' +
          '<div class="pizza-art-counter-bay">' +
            '<div class="pizza-counter-top">' +
              '<strong>Order Holding Counter (Capacity: 100)</strong>' +
              '<span class="pizza-counter-counter" id="pizza-counter-status">Counter Full: 100 / 100 Slots Held</span>' +
            '</div>' +
            '<div class="pizza-shelf" id="pizza-shelf">' +
              '<div class="pizza-box is-fake">\uD83D\uDCE6 Unclaimed Order (Slot 1)</div>' +
              '<div class="pizza-box is-fake">\uD83D\uDCE6 Unclaimed Order (Slot 2)</div>' +
              '<div class="pizza-box is-fake">\uD83D\uDCE6 Unclaimed Order (Slot 3)</div>' +
              '<div class="pizza-box is-fake">\uD83D\uDCE6 ... 97 more slots occupied</div>' +
              '<div class="pizza-shelf-alert" id="pizza-alert">\u26D4 Counter Queue Exhausted! No slots remain for new orders.</div>' +
            '</div>' +
            '<div class="pizza-counter-expl">' +
              'Each uncollected pizza sits taking space for 30s (half-open connection). The server is healthy, but the queue has zero empty space.' +
            '</div>' +
          '</div>' +
          '<div class="pizza-art-actor pizza-art-actor--victim">' +
            '<div class="pizza-actor-icon">\uD83D\uDEB6\u200D\u2642\uFE0F</div>' +
            '<div class="pizza-actor-title">Legitimate Customer</div>' +
            '<div class="pizza-actor-sub">Walks in to buy food (Genuine SYN handshake)</div>' +
            '<div class="pizza-victim-outcome is-blocked" id="pizza-victim-card">' +
              '<strong class="pizza-outcome-head">\u2715 Connection Dropped (0% Available)</strong>' +
              '<p class="pizza-outcome-msg">"Sorry! Counter is completely full of unpaid orders. We cannot take your order!"</p>' +
            '</div>' +
          '</div>' +
        '</div>';
      analogy.appendChild(pizzaArt);
      t.appendChild(analogy);

      // Wire interactive buttons for the analogy
      setTimeout(function () {
        var floodBtn = document.getElementById('btn-pizza-flood');
        var resetBtn = document.getElementById('btn-pizza-reset');
        var stage = document.getElementById('pizza-stage');
        var status = document.getElementById('pizza-counter-status');
        var alert = document.getElementById('pizza-alert');
        var victim = document.getElementById('pizza-victim-card');
        if (floodBtn && resetBtn && stage) {
          floodBtn.onclick = function () {
            stage.classList.add('is-flooded');
            if (status) status.textContent = 'Counter Full: 100 / 100 Slots Held (100% Full)';
            if (alert) alert.style.display = 'block';
            if (victim) {
              victim.className = 'pizza-victim-outcome is-blocked';
              victim.innerHTML = '<strong class="pizza-outcome-head">\u2715 Connection Dropped (0% Available)</strong>' +
                '<p class="pizza-outcome-msg">"Sorry! Counter is completely full of unpaid orders. We cannot take your order!"</p>';
            }
          };
          resetBtn.onclick = function () {
            stage.classList.remove('is-flooded');
            if (status) status.textContent = 'Normal: 2 / 100 Slots Active (Plenty of Room)';
            if (alert) alert.style.display = 'none';
            if (victim) {
              victim.className = 'pizza-victim-outcome is-served';
              victim.innerHTML = '<strong class="pizza-outcome-head" style="color:var(--color-healthy)">\u2713 Order Accepted (100% Available)</strong>' +
                '<p class="pizza-outcome-msg">"Welcome! We have open counter space. Pizza is ready to serve!"</p>';
            }
          };
        }
      }, 0);
    }

    // Mitigations: title, explanation and limitation next to each switch.
    Object.keys(MIT_INPUTS).forEach(function (id) {
      var input = $(id);
      if (!input) return;
      var m = C.mitigations[MIT_INPUTS[id]];
      var item = input.closest('.mitigation-item');
      var label = item.querySelector('label');
      if (label) label.textContent = m.title;
      item.appendChild(el('p', 'mitigation-text', m.text));
      var lim = el('p', 'limitation');
      lim.appendChild(el('strong', null, 'Limitation: '));
      lim.appendChild(document.createTextNode(m.limitation));
      item.appendChild(lim);
      if (m.command) { var cmd = el('pre', 'mitigation-command'); cmd.appendChild(el('code', null, m.command)); item.appendChild(cmd); }
    });

    // Step list titles.
    document.querySelectorAll('#step-list li').forEach(function (li, i) { li.textContent = C.steps[i].title; });

    // Extra control on the theory section: back to the lab / guidelines.
    var theory = $('section-theory');
    if (theory && !$('btn-close-theory')) {
      var close = el('button', 'btn btn--primary', 'Close theory');
      close.type = 'button';
      close.id = 'btn-close-theory';
      theory.appendChild(close);
    }
  }

  // ---- stepper -------------------------------------------------------------
  function setStatus(n, s) {
    status[n - 1] = s;
    var li = document.querySelector('#step-list li[data-step="' + n + '"]');
    if (!li) return;
    li.setAttribute('data-status', s);
    li.className = 'step step--' + s;
    if (s === 'in-progress') li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    var label = { locked: 'locked', ready: 'ready', 'in-progress': 'in progress', completed: 'completed' }[s];
    li.setAttribute('aria-label', 'Step ' + n + ': ' + C.steps[n - 1].title + ', ' + label);
  }

  function currentStep() {
    for (var i = 0; i < STEP_COUNT; i++) if (status[i] !== 'completed') return i + 1;
    return STEP_COUNT + 1;                                    // everything done
  }

  function completeStep(n) {
    if (status[n - 1] === 'completed') return;
    setStatus(n, 'completed');
    // unlock the following step: steps that need a button press are "ready", reading steps are "in progress"
    var next = n + 1;
    if (next <= STEP_COUNT && status[next - 1] === 'locked') setStatus(next, next >= 7 ? 'in-progress' : 'ready');
  }

  function renderStepPanel() {
    var cur = currentStep();
    var title = $('step-title'), instr = $('step-instructions'), actions = $('step-actions');
    if (!title) return;
    actions.textContent = '';
    if (cur > STEP_COUNT) {
      title.textContent = C.completion.title;
      instr.textContent = C.completion.message;
      var again = el('button', 'btn btn--ghost', 'Restart the lab');
      again.type = 'button';
      again.addEventListener('click', function () { requestReset(true); });
      actions.appendChild(again);
      return;
    }
    title.textContent = 'Step ' + cur + ' of ' + STEP_COUNT + ': ' + C.steps[cur - 1].title;
    instr.textContent = C.steps[cur - 1].instructions;
    if (cur === 1 || cur === 7) {
      var go = el('button', 'btn btn--primary', 'Continue');
      go.type = 'button';
      go.addEventListener('click', cur === 1 ? finishStep1 : finishStep7);
      actions.appendChild(go);
    }
  }

  // Sections unlock as the journey advances; the panel text and focus follow the current step.
  function refresh(moveFocus) {
    var cur = currentStep();
    show($('mitigation'), started && cur >= 6);
    show($('comparison'), started && cur >= 7 && !!runs.mitigated);
    show($('workshop'), started && cur >= 8);
    if (started && cur >= 8 && !workshop.initialised) initWorkshop();
    show($('quiz'), started && cur >= 9);
    if (started && cur === 9 && !quiz.initialised) initQuiz();
    if (started && cur >= 6 && !terminalPopped) { terminalPopped = true; Lab.Terminal.open(true); log('Terminal opened: configure the server\'s defences with Linux commands.', 'info'); }
    renderStepPanel();
    updateControls();
    if (moveFocus && cur !== shownStep) focusEl($('step-title'));
    shownStep = cur;
    if (started && cur > STEP_COUNT) maybeComplete();
  }

  // ---- controls ------------------------------------------------------------
  function updateControls() {
    var running = engine.isRunning();
    var cur = currentStep();
    var baselineDone = !!runs.baseline;
    var attackAllowed = started && baselineDone && !running && !runs.mitigated && cur >= 3 && cur <= 6;
    var mitigationAllowed = started && !running && !!runs.attack && (cur === 6 || cur === 7);

    setDisabled('btn-start', !($('ack-checkbox') && $('ack-checkbox').checked));
    setDisabled('btn-baseline', !(started && !running && cur === 2));
    setDisabled('btn-start-flood', !attackAllowed);
    setDisabled('attack-level', !attackAllowed);
    setDisabled('btn-stop-sim', !running);
    setDisabled('btn-stop', !running);
    Object.keys(MIT_INPUTS).forEach(function (id) { setDisabled(id, true); });   // read-only: the terminal controls them
    setDisabled('btn-run-mitigated', !(mitigationAllowed && anyMitigationSelected()));

    var runBtn = $('btn-run-mitigated');
    if (runBtn) runBtn.title = (mitigationAllowed && !anyMitigationSelected()) ? 'Switch on at least one defence first' : '';

    // Guide the student: softly highlight the one control that is the natural next action.
    var next = null;
    if (started && running) next = (cur === 4 || cur === 5) ? 'btn-stop-sim' : null;
    else if (cur === 2) next = 'btn-baseline';
    else if (cur === 3) next = 'btn-start-flood';
    else if (mitigationAllowed && cur === 6 && anyMitigationSelected()) next = 'btn-run-mitigated';
    ['btn-baseline', 'btn-start-flood', 'btn-stop-sim', 'btn-run-mitigated', 'btn-start'].forEach(function (id) {
      var b = $(id);
      if (b) b.classList.toggle('is-next', id === next || (id === 'btn-start' && !b.disabled && !started));
    });
    var rs = $('run-status');
    if (rs) rs.classList.toggle('is-running', running);
  }

  function updateRunStatus(state) {
    var label = $('run-status-label');
    var bar = document.querySelector('#run-status .progress__bar');
    var track = document.querySelector('#run-status .progress');
    if (!label) return;
    if (state && state.running) {
      var total = state.mode === 'baseline' ? (state.params.baselineSeconds || 20) : (state.params.attackSeconds || 40);
      var what = currentRunKind === 'baseline' ? 'Baseline traffic'
        : (currentRunKind === 'mitigated' ? 'SYN flood with defences (' + state.level + ')' : 'SYN flood (' + state.level + ')');
      label.textContent = what + ' — ' + state.t + ' / ' + total + ' simulated seconds';
      var pct = Math.min(100, state.t / total * 100);
      if (bar) bar.style.width = pct + '%';
      if (track) track.setAttribute('aria-valuenow', Math.round(pct));
    }
  }

  function resetRunStatus(text) {
    var label = $('run-status-label');
    var bar = document.querySelector('#run-status .progress__bar');
    if (label) label.textContent = text || 'No simulation running';
    if (bar) bar.style.width = '0%';
  }

  // The terminal is the control panel: whatever the Linux configuration enables is shown on the four switches.
  function onTerminalCommand() {
    var ev = Lab.Terminal.getDefences();
    Object.keys(MIT_INPUTS).forEach(function (id) { var c = $(id); if (c) c.checked = !!ev.defences[MIT_INPUTS[id]]; });
    var now = mitigationNames(ev.defences).join(', ');
    if (now !== lastDefences) {
      lastDefences = now;
      log('Terminal: defences now active: ' + (now || 'none') + '.', 'info');
      if (engine.isRunning()) notify('Defence changes apply to the next run.', 'info');
    }
    updateControls();
  }

  // ---- journey actions -------------------------------------------------------
  function startLab() {
    started = true;
    show($('screen-guidelines'), false);
    LAB_SECTIONS.forEach(function (id) { show($(id), true); });
    show($('section-theory'), true);
    show($('btn-terminal'), true);
    for (var n = 1; n <= STEP_COUNT; n++) setStatus(n, 'locked');
    setStatus(1, 'in-progress');
    shownStep = 0;
    log('Lab initialised. Step 1: review the theory.', 'info');
    refresh(false);
    window.scrollTo(0, 0);
    focusEl($('step-title'));
    Lab.Visuals.playHandshakeDemo();
  }

  function finishStep1() {
    completeStep(1);
    show($('section-theory'), false);
    refresh(true);
    scrollToEl($('stepper-section'));
  }

  function finishStep7() {
    completeStep(7);
    refresh(true);
    scrollToEl($('workshop'));
  }

  function clearVisuals() { Lab.Visuals.reset(); Lab.Dashboard.reset(); }

  function startBaseline() {
    if (engine.isRunning()) return;
    engine.setMitigation(NO_DEFENCES);
    currentRunKind = 'baseline';
    clearVisuals();
    setStatus(2, 'in-progress');
    engine.runBaseline();
    refresh(false);
  }

  function startFlood() {
    if (engine.isRunning() || !runs.baseline) return;
    var level = $('attack-level').value;
    engine.setMitigation(NO_DEFENCES);
    currentRunKind = 'attack';
    clearVisuals();
    Lab.Terminal.setLevel(level);
    engine.runAttack(level);
    // Step 3 (launch) is done the moment the flood starts; steps 4 and 5 follow its progress.
    completeStep(3);
    if (status[3] !== 'completed') setStatus(4, 'in-progress');
    if (status[4] === 'locked') setStatus(5, 'ready');
    refresh(true);
  }

  function startMitigated() {
    if (engine.isRunning() || !runs.attack || !anyMitigationSelected()) return;
    var chosen = selectedMitigation();
    var level = runs.attack.level;
    $('attack-level').value = level;                     // the same attack as before, so the comparison is fair
    engine.setMitigation(chosen);
    currentRunKind = 'mitigated';
    clearVisuals();
    setStatus(6, 'in-progress');
    Lab.Terminal.setLevel(level);
    engine.runAttack(level);
    refresh(false);
  }

  function stopRun() {
    if (engine.isRunning()) engine.stop();               // engine emits runEnded, which does the bookkeeping
  }

  function onRunEnded(summary) {
    var kind = currentRunKind;
    currentRunKind = null;
    resetRunStatus(summary.stoppedEarly ? 'Simulation stopped' : 'Simulation finished');
    if (!summary.stoppedEarly) { var fullBar = document.querySelector('#run-status .progress__bar'); if (fullBar) fullBar.style.width = '100%'; }
    var pct = Math.round(summary.avgAvailability);

    if (kind === 'baseline') {
      if (summary.stoppedEarly) {
        setStatus(2, 'ready');
        log('Baseline stopped early and discarded. Run it again to finish step 2.', 'warn');
        notify('Baseline stopped early. Run it again to record a full baseline.', 'warn');
      } else {
        runs.baseline = summary;
        completeStep(2);
        log('Baseline generated: average availability ' + pct + '%, server ' + summary.finalServerState + '.', 'success');
        notify('Baseline recorded. You can now launch the SYN flood.', 'success');
      }
    } else if (kind === 'attack') {
      runs.attack = summary;
      [3, 4, 5].forEach(completeStep);
      log('Attack run recorded (' + summary.level + '): average availability ' + pct + '%, server ' + summary.finalServerState + '.', 'warn');
      notify('Attack run recorded. Next: enable some defences.', 'info');
    } else if (kind === 'mitigated') {
      if (summary.stoppedEarly) {
        setStatus(6, 'ready');
        log('Mitigated run stopped early and discarded. Run it again to finish step 6.', 'warn');
        notify('Mitigated run stopped early. Run it again to compare fairly.', 'warn');
      } else {
        runs.mitigated = summary;
        completeStep(6);
        var names = mitigationNames(summary.mitigation).join(', ');
        log('Mitigated run recorded (' + names + '): average availability ' + pct + '%, server ' + summary.finalServerState + '.', 'success');
        Lab.Dashboard.renderComparison(runs);
        log('Comparison ready.', 'info');
        notify('Comparison ready. Review the table below.', 'success');
      }
    }
    refresh(true);
    if (kind === 'mitigated' && runs.mitigated && !summary.stoppedEarly) scrollToEl($('comparison'));
  }

  function onServerStateChange(e) {
    if (currentRunKind === 'attack' && (e.to === 'Degraded' || e.to === 'Unavailable') && status[3] !== 'completed') {
      completeStep(4);
      if (status[4] === 'locked') setStatus(5, 'ready');
      refresh(true);
    }
  }

  // ---- quiz and completion -----------------------------------------------------
  function initWorkshop() {
    workshop.initialised = true;
    Lab.Workshop.init($('workshop-content'), {
      getLevel: function () { return runs.attack ? runs.attack.level : 'medium'; },
      onFinished: onWorkshopFinished
    });
  }

  function onWorkshopFinished(summary) {
    workshop.done = true;
    workshop.summary = summary;
    var h = summary.hardening;
    log('Workshop completed' + (h ? ': hardened server ' + Math.round(h.after) + '% available (' + h.state + ') against ' + h.level + ' attack' : '') + '.', 'success');
    completeStep(8);
    refresh(true);
    scrollToEl($('quiz'));
  }

  function initQuiz() {
    quiz.initialised = true;
    setStatus(9, 'in-progress');
    Lab.Quiz.init($('quiz-container'), C.quiz, onQuizFinished);
  }

  function onQuizFinished(result) {
    quiz.done = true;
    quiz.score = result.score;
    quiz.total = result.total;
    log('Quiz finished: ' + result.score + ' / ' + result.total + '.', 'success');
    completeStep(9);
    refresh(false);
  }

  function maybeComplete() {
    if (!(runs.baseline && runs.attack && runs.mitigated && status[6] === 'completed' && workshop.done && quiz.done)) return;
    var dlg = $('modal-complete');
    if (!dlg || dlg.open) return;
    var pct = (n) => (n === null || n === undefined ? '—' : Math.round(n) + '%');
    $('complete-message').textContent = C.completion.message;
    $('complete-baseline').textContent = pct(runs.baseline.avgAvailability);
    $('complete-attack').textContent = pct(runs.attack.avgAvailability);
    $('complete-mitigated').textContent = pct(runs.mitigated.avgAvailability);
    var hs = workshop.summary && workshop.summary.hardening;
    $('complete-hardened').textContent = hs ? Math.round(hs.after) + '% available, ' + hs.state + ' (was ' + Math.round(hs.before) + '%)' : '—';
    $('complete-score').textContent = quiz.score + ' / ' + quiz.total;
    var passed = quiz.total && quiz.score / quiz.total * 100 >= PASS_PERCENT;
    $('complete-status').textContent = passed ? 'Passed' : 'Completed — review recommended';
    $('modal-complete').querySelector('h2').textContent = C.completion.title;
    log('Experiment completed.', 'success');
    dlg.showModal();
    focusEl($('btn-review'));
  }

  // ---- theory -------------------------------------------------------------------
  function openTheory() {
    show($('section-theory'), true);
    var close = $('btn-close-theory');
    if (close) close.textContent = started ? 'Close theory' : 'Back to the guidelines';
    scrollToEl($('section-theory'));
    focusEl($('theory-heading'));
    Lab.Visuals.playHandshakeDemo();
  }

  function closeTheory() {
    show($('section-theory'), false);
    if (!started) { scrollToEl($('screen-guidelines')); focusEl($('guidelines-heading')); }
    else { scrollToEl($('stepper-section')); focusEl($('step-title')); }
  }

  // ---- reset / restart ------------------------------------------------------------
  function openConfirm(message, onYes) {
    var dlg = $('modal-confirm');
    if (!dlg || !dlg.showModal) { onYes(); return; }
    $('confirm-message').textContent = message;
    pendingConfirm = onYes;
    dlg.showModal();
    focusEl($('btn-confirm-no'));
  }

  function closeConfirm(accepted) {
    var dlg = $('modal-confirm');
    var action = pendingConfirm;
    pendingConfirm = null;
    if (dlg && dlg.open) dlg.close();
    if (accepted && action) action();
  }

  function requestReset(toStart) {
    if (resultsExist()) {
      openConfirm(toStart
        ? 'Restart the lab from the beginning? Your results, log and quiz progress will be cleared.'
        : 'Reset the experiment? Your results, log and quiz progress will be cleared and you will return to Step 1.',
      function () { doReset(toStart); });
    } else {
      doReset(toStart);
    }
  }

  function doReset(toStart) {
    var done = $('modal-complete');
    if (done && done.open) done.close();
    engine.reset();                                      // stops any timer and clears queue, metrics, history, mitigation
    Lab.Visuals.reset();
    Lab.Dashboard.reset();
    Lab.Log.clear();
    Lab.Quiz.reset();
    Lab.Terminal.reset();
    terminalPopped = false;
    lastDefences = '';
    if (workshop.initialised) Lab.Workshop.reset();
    Object.keys(MIT_INPUTS).forEach(function (id) { var c = $(id); if (c) c.checked = false; });
    runs = { baseline: null, attack: null, mitigated: null };
    quiz = { initialised: false, done: false, score: 0, total: 0 };
    workshop = { initialised: false, done: false, summary: null };
    currentRunKind = null;
    pendingConfirm = null;
    if ($('attack-level')) $('attack-level').value = 'medium';
    resetRunStatus();
    for (var n = 1; n <= STEP_COUNT; n++) setStatus(n, 'locked');
    shownStep = 0;

    if (toStart) {
      started = false;
      show($('btn-terminal'), false);
      if ($('ack-checkbox')) $('ack-checkbox').checked = false;
      LAB_SECTIONS.concat(['section-theory', 'mitigation', 'comparison', 'workshop', 'quiz']).forEach(function (id) { show($(id), false); });
      show($('screen-guidelines'), true);
      refresh(false);
      window.scrollTo(0, 0);
      focusEl($('guidelines-heading'));
    } else {
      setStatus(1, 'in-progress');
      show($('section-theory'), true);
      log('Experiment reset. Back at Step 1.', 'info');
      refresh(true);
      window.scrollTo(0, 0);
    }
  }

  // ---- theme ----------------------------------------------------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = $('btn-theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('title', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
      var label = btn.querySelector('.theme-toggle__label');
      if (label) label.textContent = theme === 'dark' ? 'Light' : 'Dark';
      var icon = btn.querySelector('.theme-toggle__icon');
      if (icon) icon.textContent = theme === 'dark' ? '☀' : '☾';
    }
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('synlab-theme'); } catch (e) {}
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var current = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(current);

    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', function (e) {
          try {
            if (!localStorage.getItem('synlab-theme')) {
              applyTheme(e.matches ? 'dark' : 'light');
            }
          } catch (err) {}
        });
      }
    }
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('synlab-theme', next); } catch (e) {}
  }

  // ---- boot -----------------------------------------------------------------------
  function wire() {
    var ack = $('ack-checkbox');
    ack.addEventListener('change', updateControls);
    $('btn-start').addEventListener('click', startLab);
    $('btn-view-theory').addEventListener('click', openTheory);
    $('btn-theory').addEventListener('click', openTheory);
    $('btn-close-theory').addEventListener('click', closeTheory);
    $('btn-play-handshake').addEventListener('click', function () { Lab.Visuals.replayHandshakeDemo(); });
    var btnPlay = $('btn-handshake-play');
    if (btnPlay) btnPlay.addEventListener('click', function () { Lab.Visuals.playHandshakeDemo(); });
    var btnPause = $('btn-handshake-pause');
    if (btnPause) btnPause.addEventListener('click', function () { Lab.Visuals.pauseHandshakeDemo(); });

    $('btn-baseline').addEventListener('click', startBaseline);
    $('btn-start-flood').addEventListener('click', startFlood);
    $('btn-stop-sim').addEventListener('click', stopRun);
    $('btn-stop').addEventListener('click', stopRun);
    $('btn-run-mitigated').addEventListener('click', startMitigated);

    $('btn-open-terminal-mit').addEventListener('click', function () { Lab.Terminal.open(true); });

    var themeBtn = $('btn-theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    $('btn-reset').addEventListener('click', function () { requestReset(false); });
    $('btn-restart').addEventListener('click', function () { requestReset(true); });
    $('btn-restart-lab').addEventListener('click', function () { doReset(true); });
    $('btn-confirm-yes').addEventListener('click', function () { closeConfirm(true); });
    $('btn-confirm-no').addEventListener('click', function () { closeConfirm(false); });
    $('modal-confirm').addEventListener('cancel', function () { pendingConfirm = null; });
    $('btn-review').addEventListener('click', function () {
      $('modal-complete').close();
      show($('comparison'), true);
      scrollToEl($('comparison'));
      focusEl($('comparison-heading'));
    });

    engine.on('runEnded', onRunEnded);
    engine.on('serverStateChange', onServerStateChange);
    engine.on('tick', updateRunStatus);
  }

  function boot() {
    initTheme();
    C = Lab.Content;
    engine = Lab.Engine.create();
    Lab.Visuals.init(engine);
    Lab.Dashboard.init(engine);
    Lab.Terminal.init();
    Lab.Terminal.on(onTerminalCommand);
    Lab.Terminal.onGuide(function (step, i, allRequired) {
      log('Runbook step done: ' + step.title + '.', 'success');
      if (allRequired) { log('Runbook complete. Run the mitigated simulation to measure it.', 'success'); notify('Runbook complete. Press Run With Mitigation.', 'success'); }
    });
    renderContent();
    for (var n = 1; n <= STEP_COUNT; n++) setStatus(n, 'locked');
    wire();
    updateControls();
    Lab.app = { engine: engine };                        // handy in the console while developing
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window.Lab);
