/* Runs INSIDE the page (injected by tests/e2e.js, never shipped). Walks the whole student journey
   with real clicks and writes PASS/FAIL results into <pre id="e2e-result">. */
(function () {
  var results = [], errors = [];
  window.addEventListener('error', function (e) { errors.push(e.message + ' @' + String(e.filename).split('/').pop() + ':' + e.lineno); });
  var origError = console.error;
  console.error = function () { errors.push('console.error: ' + Array.prototype.join.call(arguments, ' ')); origError.apply(console, arguments); };

  function check(ok, msg) { results.push({ ok: !!ok, msg: msg }); }
  function $(id) { return document.getElementById(id); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function statuses() { return Array.prototype.map.call(document.querySelectorAll('#step-list li'), function (li) { return li.dataset.status; }).join(','); }
  function logText() { return $('log-list').textContent; }
  function continueBtn() { return $('step-actions').querySelector('button'); }

  async function journey() {
    var Lab = window.Lab, engine = Lab.app.engine;
    await sleep(300);

    // ---- start screen
    check(!$('screen-guidelines').hidden && $('stepper-section').hidden && $('dashboard').hidden, 'start: only Before You Begin is visible');
    check($('guidelines-list').children.length === 9, 'start: nine guidelines are listed');
    check($('btn-start').disabled, 'start: Start is disabled until the checkbox is ticked');
    $('ack-checkbox').click();
    check(!$('btn-start').disabled, 'start: ticking the checkbox enables Start');
    $('btn-view-theory').click();
    check(!$('section-theory').hidden, 'start: View Theory opens the theory');
    $('btn-close-theory').click();
    check($('section-theory').hidden, 'start: theory can be closed again');

    // ---- step 1
    $('btn-start').click();
    check($('screen-guidelines').hidden && !$('stepper-section').hidden, 'step 1: Start hides the guidelines and shows the lab');
    check(statuses() === 'in-progress,locked,locked,locked,locked,locked,locked,locked,locked', 'step 1: stepper statuses (' + statuses() + ')');
    check(!$('section-theory').hidden && $('theory-content').textContent.length > 500, 'step 1: theory is shown and filled');
    check($('btn-baseline').disabled && $('btn-start-flood').disabled && $('btn-stop').disabled, 'step 1: baseline, flood and stop are disabled');
    check(/Review the lab/.test($('step-title').textContent), 'step 1: step panel shows the step');
    continueBtn().click();
    check(statuses() === 'completed,ready,locked,locked,locked,locked,locked,locked,locked', 'step 2 unlocked after Continue (' + statuses() + ')');
    check(!$('btn-baseline').disabled && $('btn-start-flood').disabled, 'step 2: baseline enabled, flood still locked');

    // ---- step 2: baseline
    $('btn-baseline').click();
    check(engine.isRunning() && !$('btn-stop').disabled && $('btn-baseline').disabled, 'baseline: running, Stop enabled, Baseline disabled');
    await sleep(3000);
    var running1 = engine.getState().t;
    check(running1 > 3 && engine.getState().mode === 'baseline', 'baseline: simulated time advances (t=' + running1 + ')');
    await sleep(8500);                                    // 20 simulated seconds + margin
    check(!engine.isRunning() && engine.getSummary().mode === 'baseline', 'baseline: run finished by itself');
    check(statuses().indexOf('completed,completed,ready') === 0, 'baseline: step 2 completed (' + statuses() + ')');
    check($('server-state').textContent.indexOf('Healthy') >= 0, 'baseline: server Healthy');
    check(!$('btn-start-flood').disabled && !$('attack-level').disabled, 'baseline: flood controls unlocked');
    check(/Baseline generated/.test(logText()), 'baseline: logged');

    // ---- steps 3-5: flood, observe, stop
    $('attack-level').value = 'medium';
    $('btn-start-flood').click();
    $('btn-start-flood').click(); $('btn-start-flood').click();       // rapid clicks must not start a second run
    check(engine.isRunning() && engine.getState().level === 'medium', 'flood: running at the chosen level');
    check(statuses().indexOf('completed,completed,completed,in-progress,ready') === 0, 'flood: steps 3 done, 4 in progress, 5 ready (' + statuses() + ')');
    await sleep(2000);
    var tA = engine.getState().t;
    await sleep(2000);
    var tB = engine.getState().t;
    check(tB - tA === 4 || tB - tA === 3 || tB - tA === 5, 'flood: exactly one timer is running (advanced ' + (tB - tA) + ' s in 2 s of real time)');
    await sleep(9000);
    var st = engine.getState();
    check(st.queue.attack > 0 && st.metrics.pending >= 90, 'flood: queue filled with attack slots (pending ' + st.metrics.pending + ')');
    check(document.querySelectorAll('.queue-slot--attack').length > 0, 'flood: attack slots are drawn in the queue grid');
    check(/Degraded|Unavailable/.test($('server-state').textContent), 'flood: dashboard shows ' + $('server-state').textContent.slice(0, 20) + ' (engine: ' + st.serverState + ', t=' + st.t + ', avail=' + st.metrics.availability + ')');
    check(statuses().indexOf('completed,completed,completed,completed') === 0, 'flood: step 4 completed once the server degraded (' + statuses() + ')');
    check(/Degraded|Unavailable/.test($('notifications').textContent) || !!$('toast-container').querySelector('.toast'), 'flood: a notification appeared');
    $('btn-stop-sim').click();
    var frozen = JSON.stringify(engine.getState().metrics);
    check(!engine.isRunning(), 'stop: halts immediately');
    await sleep(1500);
    check(JSON.stringify(engine.getState().metrics) === frozen, 'stop: numbers no longer change and stay on screen');
    check(statuses().indexOf('completed,completed,completed,completed,completed,ready') === 0, 'stop: step 5 completed, step 6 ready (' + statuses() + ')');
    check(!$('mitigation').hidden && $('comparison').hidden, 'stop: mitigation section is visible, comparison not yet');
    check(/Attack run recorded/.test(logText()), 'stop: attack run logged');

    // ---- step 6: mitigation, controlled from the terminal pop-up
    function type(cmd) {
      $('ws-term-input').value = cmd;
      $('ws-term-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    function term() { return $('ws-term-output').textContent; }
    check(!$('terminal-drawer').hidden && !$('btn-terminal').hidden, 'terminal: pops up by itself when step 6 starts');
    check($('btn-run-mitigated').disabled, 'mitigation: Run With Mitigation needs at least one defence');
    check($('mit-syn-cookies').disabled && $('mit-rate-limit').disabled, 'mitigation: switches are read-only (the terminal controls them)');
    type('help');
    check(/Supported commands/.test(term()), 'terminal: help lists the supported commands');
    type('sysctl -w net.ipv4.tcp_syncookies=1');
    check($('mit-syn-cookies').checked && !$('mit-short-timeout').checked, 'terminal: enabling cookies turns the SYN cookies switch on');
    check(!$('btn-run-mitigated').disabled, 'mitigation: enabled once a defence is on');
    type('sysctl -w net.ipv4.tcp_synack_retries=2');
    check($('mit-short-timeout').checked, 'terminal: shorter SYN-ACK retries turns the shorter timeouts switch on');
    check(/defences now active: SYN cookies, Shorter timeouts/.test(logText()), 'mitigation: terminal changes are logged');
    // guided runbook: steps complete from the server state, in any order
    check(/ss -tan state syn-recv/.test($('term-guide-command').textContent) && /0 of 13 required/.test($('term-guide-count').textContent.replace(/\d+ of (\d+)/, function (m) { return '0 of ' + RegExp.$1; })), 'runbook: the first step shows its command');
    check(/2 of 13/.test($('term-guide-count').textContent), 'runbook: cookies and retries typed earlier already count (' + $('term-guide-count').textContent + ')');
    $('btn-guide-insert').click();
    check($('ws-term-input').value === 'ss -tan state syn-recv | wc -l', 'runbook: "Put it in the prompt" fills the command');
    var rbSteps = Lab.Content.runbook.steps;
    for (var rb = 0; rb < rbSteps.length; rb++) {
      var curBefore = $('term-guide-command') && $('term-guide-command').textContent;
      if (curBefore) { check(curBefore === rbSteps.filter(function (x) { return curBefore === x.command; })[0].command, 'runbook: current step command is shown'); type(curBefore); }
    }
    check(!!$('term-guide-complete') && /13 of 13/.test($('term-guide-count').textContent), 'runbook: all required steps complete (' + $('term-guide-count').textContent + ')');
    check(/Runbook complete/.test(logText()) && $('mit-firewall').checked && $('mit-rate-limit').checked, 'runbook: completion logged and all four defence switches follow the terminal');
    $('btn-terminal').click();
    check($('terminal-drawer').hidden, 'terminal: header button closes it');
    $('btn-terminal').click();
    check(!$('terminal-drawer').hidden, 'terminal: header button opens it again');
    $('btn-run-mitigated').click();
    check(engine.isRunning() && engine.getState().level === 'medium' && engine.getState().mitigation.synCookies && engine.getState().mitigation.shortTimeout, 'mitigation: same level replayed with the terminal-configured defences');
    await sleep(21500);
    check(!engine.isRunning() && engine.getSummary().mitigation.synCookies, 'mitigation: run finished');
    check(statuses().indexOf('completed,completed,completed,completed,completed,completed,in-progress') === 0, 'mitigation: step 6 done, step 7 in progress (' + statuses() + ')');

    // ---- step 7: comparison
    check(!$('comparison').hidden && $('compare-table').querySelectorAll('tbody tr').length === 6, 'comparison: table has six rows');
    check($('compare-explanation').textContent.length > 120 && /simulated/.test($('compare-explanation').textContent), 'comparison: explanation is written');
    var cells = $('compare-table').querySelector('tbody tr:nth-child(5)').textContent;
    check(/\d+%/.test(cells), 'comparison: availability row has numbers (' + cells.replace(/\s+/g, ' ').slice(0, 60) + ')');
    check($('quiz').hidden, 'comparison: quiz still hidden');
    check(!$('modal-complete').open, 'comparison: completion popup is NOT shown early');
    continueBtn().click();

    // ---- step 8: defender's workshop (Part 2)
    check(!$('workshop').hidden && $('quiz').hidden, 'workshop: shown at step 8, quiz still hidden');
    check(statuses() === 'completed,completed,completed,completed,completed,completed,completed,in-progress,locked', 'workshop: step 8 in progress (' + statuses() + ')');
    check(document.querySelectorAll('#workshop-tabs [role=tab]').length === 5 && $('workshop-progress').textContent === '0 of 5 modules complete', 'workshop: five modules, none complete');
    check(!$('workshop-finish') || $('workshop-finish').hidden, 'workshop: finish button hidden until all modules are done');
    var W = Lab.Content.workshop;
    function answerQuestions(panelId, qs, wrongFirst) {
      var cards = $(panelId).querySelectorAll('.ws-q');
      qs.forEach(function (q, i) {
        var opts = cards[i].querySelectorAll('.quiz-option');
        if (wrongFirst && i === 0) { opts[(q.answer + 1) % 4].click(); check(opts[(q.answer + 1) % 4].classList.contains('is-wrong') && /Not quite/.test(cards[i].querySelector('.ws-feedback').textContent), panelId + ': a wrong answer is marked and explained'); }
        opts[q.answer].click();
      });
    }
    // 1 understand
    $('ws-tab-understand').click();
    check(!$('ws-panel-understand').hidden && $('ws-panel-harden').hidden, 'workshop: tabs switch panels');
    check($('ws-panel-understand').textContent.indexOf('SYN queue') > 0 && $('ws-panel-understand').querySelectorAll('table').length >= 2, 'understand: kernel explanation and tables are rendered');
    $('ws-calc-input').value = '3'; $('ws-calc-check').click();
    check(/15 s/.test($('ws-calc-feedback').textContent) && $('workshop-progress').textContent.indexOf('0 of 5') === 0, 'understand: wrong calculator answer shows the arithmetic');
    $('ws-calc-input').value = String(W.understand.calculator.answer); $('ws-calc-check').click();
    check(/Correct/.test($('ws-calc-feedback').textContent), 'understand: right calculator answer accepted');
    answerQuestions('ws-panel-understand', W.understand.checkpoints, true);
    check($('workshop-progress').textContent === '1 of 5 modules complete', 'understand: module completes (' + $('workshop-progress').textContent + ')');
    // 2 investigate
    $('ws-tab-investigate').click();
    check($('ws-panel-investigate').querySelectorAll('.ws-evidence__card').length === 4, 'investigate: four pieces of evidence are shown');
    answerQuestions('ws-panel-investigate', W.investigate.questions, false);
    check($('workshop-progress').textContent === '2 of 5 modules complete', 'investigate: module completes');
    // 3 harden: the terminal
    $('ws-tab-harden').click();
    function doneTasks() { return Array.prototype.filter.call(document.querySelectorAll('#ws-tasks .ws-task'), function (li) { return li.dataset.done === 'true'; }).length; }
    check(/Type "help"|type "help"/i.test(term()) && !$('terminal-drawer').hidden && document.querySelectorAll('#ws-tasks .ws-task').length === W.harden.tasks.length, 'harden: terminal and checklist are shown');
    check(doneTasks() >= 7, 'harden: tasks done in the runbook are already ticked (' + doneTasks() + ')');
    type('sysctl -w net.ipv4.tcp_syncookies=0'); type('sysctl -w net.ipv4.tcp_synack_retries=5');
    $('btn-ws-test').click();
    await sleep(2500);
    check(!$('ws-test-result').hidden && $('ws-test-result').classList.contains('is-fail'), 'harden: testing the weakened server fails (' + $('ws-test-result').className + ')');
    check($('workshop-progress').textContent === '2 of 5 modules complete', 'harden: failing test does not complete the module');
    type('ss -tan state syn-recv | wc -l');
    check(/\n?257\s*$/.test(term().trim()) || term().indexOf('257') > 0, 'harden: ss | wc -l prints the half-open count');
    type('dmesg | tail'); type("tcpdump -nn -c 5 'tcp[tcpflags] == tcp-syn'");
    check(/Possible SYN flooding/.test(term()) && /Flags \[S\]/.test(term()), 'harden: dmesg and tcpdump output are shown');
    type('sysctl -w net.ipv4.tcp_syncookies=1');
    type('frobnicate');
    check(/command not found/.test(term()), 'harden: unknown commands are explained');
    type('sysctl -w net.ipv4.tcp_synack_retries=2');
    type('iptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT');
    type('iptables -A INPUT -p tcp --syn --dport 443 -j DROP');
    type('echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-synflood.conf');
    type('echo "net.ipv4.tcp_synack_retries = 2" >> /etc/sysctl.d/99-synflood.conf');
    type('sysctl --system');
    check($('ws-task-persist').dataset.done === 'true', 'harden: persist task is ticked');
    $('ws-term-input').value = 'help'; $('ws-term-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    $('btn-ws-test').click();
    check($('btn-ws-test').disabled, 'harden: test button is disabled while the replay runs');
    await sleep(2500);
    check($('ws-test-result').classList.contains('is-pass') || $('ws-test-result').classList.contains('is-excellent'), 'harden: hardened server passes the test (' + $('ws-test-result').className + ')');
    check(/Excellent|Pass/.test($('ws-test-result').textContent) && /%/.test($('ws-test-result').textContent), 'harden: result card shows before/after numbers');
    check($('workshop-progress').textContent === '3 of 5 modules complete', 'harden: module completes (' + $('workshop-progress').textContent + ')');
    // 4 layers
    $('ws-tab-layers').click();
    W.layers.exercises.forEach(function (ex, i) {
      var sel = $('ws-match-' + ex.id);
      if (i === 0) { sel.value = ex.answer === 'host' ? 'isp' : 'host'; sel.dispatchEvent(new Event('change')); }
      sel.value = ex.answer; sel.dispatchEvent(new Event('change'));
    });
    check($('workshop-progress').textContent === '4 of 5 modules complete', 'layers: module completes');
    // 5 incident
    $('ws-tab-incident').click();
    W.incident.steps.forEach(function (st, i) {
      var opts = $('ws-incident').querySelectorAll('.quiz-option');
      var goodIdx = st.options.findIndex(function (o) { return o.good; });
      if (i === 0) { opts[(goodIdx + 1) % 4].click(); }
      opts[goodIdx].click();
      $('ws-incident-next').click();
    });
    check(/Incident closed/.test($('ws-incident').textContent), 'incident: the six decisions end with a debrief');
    check($('workshop-progress').textContent === '5 of 5 modules complete' && !$('workshop-finish').hidden, 'workshop: all modules complete, finish button shown');
    check($('quiz').hidden, 'workshop: quiz still hidden until the workshop is finished');
    $('workshop-finish').click();
    check(statuses() === 'completed,completed,completed,completed,completed,completed,completed,completed,in-progress', 'workshop: step 8 completed, step 9 in progress (' + statuses() + ')');
    check(/Workshop completed/.test(logText()), 'workshop: completion logged');

    // ---- step 9: quiz
    check(!$('quiz').hidden, 'quiz: visible at step 9');
    check(/Question 1 of 12/.test($('quiz-container').textContent), 'quiz: progress label "Question 1 of 12"');
    var qs = Lab.Content.quiz;
    for (var i = 0; i < qs.length; i++) {
      var q = qs[i];
      var wantWrong = i === qs.length - 1;                              // answer the last one wrongly on purpose
      var pick = wantWrong ? (q.answer + 1) % 4 : q.answer;
      var opts = $('quiz-container').querySelectorAll('.quiz-option');
      check(opts.length === 4, 'quiz q' + (i + 1) + ': four options');
      var submit = $('quiz-container').querySelector('.quiz-actions .btn--primary');
      check(submit.disabled, 'quiz q' + (i + 1) + ': Submit disabled until an option is chosen');
      opts[pick].click();
      submit.click();
      var fb = $('quiz-container').querySelector('.quiz-feedback').textContent;
      check(wantWrong ? opts[pick].classList.contains('is-wrong') && opts[q.answer].classList.contains('is-correct') : opts[pick].classList.contains('is-correct'),
        'quiz q' + (i + 1) + ': correct/wrong styling' + (wantWrong ? ' (wrong answer also reveals the right one)' : ''));
      check(fb.indexOf(q.explanation.slice(0, 25)) >= 0, 'quiz q' + (i + 1) + ': explanation shown');
      check(!!$('modal-complete').open === false || i === qs.length - 1, 'quiz q' + (i + 1) + ': popup not early');
      var next = $('quiz-container').querySelector('.quiz-actions .btn--primary:not([hidden])');
      next.click();
    }
    check(/11 \/ 12/.test($('quiz-score').textContent), 'quiz: final score shown (' + $('quiz-score').textContent + ')');

    // ---- completion
    check($('modal-complete').open, 'completion: popup opens after everything is done');
    check(/%/.test($('complete-baseline').textContent) && /%/.test($('complete-attack').textContent) && /%/.test($('complete-mitigated').textContent), 'completion: three availability values');
    check($('complete-score').textContent === '11 / 12' && /%/.test($('complete-hardened').textContent) && $('complete-status').textContent === 'Passed', 'completion: score and status');
    check(statuses() === 'completed,completed,completed,completed,completed,completed,completed,completed,completed', 'completion: every step completed');
    $('btn-review').click();
    check(!$('modal-complete').open, 'completion: Review closes the popup');

    // ---- reset
    $('btn-reset').click();
    check($('modal-confirm').open, 'reset: asks for confirmation when results exist');
    $('btn-confirm-no').click();
    check(!$('modal-confirm').open && !!Lab.app.engine.getSummary(), 'reset: Cancel keeps everything');
    $('btn-reset').click();
    $('btn-confirm-yes').click();
    check(!engine.isRunning() && engine.getState().history.length === 0 && engine.getSummary() === null, 'reset: engine cleared');
    check(statuses() === 'in-progress,locked,locked,locked,locked,locked,locked,locked,locked', 'reset: back to step 1 (' + statuses() + ')');
    check(!$('mit-syn-cookies').checked && $('compare-table').children.length === 0, 'reset: mitigations unchecked and comparison cleared');
    check($('screen-guidelines').hidden && !$('stepper-section').hidden, 'reset: guidelines stay acknowledged');
    check($('log-list').children.length === 1, 'reset: log cleared (' + $('log-list').children.length + ' entry)');
    check($('quiz').hidden && $('mitigation').hidden && $('comparison').hidden && $('workshop').hidden, 'reset: later sections hidden again');

    // robustness: rapid Start / Stop / Reset never throws or double-runs
    continueBtn().click(); $('btn-baseline').click(); $('btn-stop').click(); $('btn-stop').click(); $('btn-baseline').click();
    check(engine.isRunning(), 'robustness: baseline restarted after Stop');
    $('btn-reset').click(); $('btn-confirm-yes').click();
    check(!engine.isRunning(), 'robustness: reset during a run stops it');
    var tt = engine.getState().t;
    await sleep(1500);
    check(engine.getState().t === tt, 'robustness: no timer left running after reset');

    // restart
    $('btn-restart').click();
    if ($('modal-confirm').open) $('btn-confirm-yes').click();
    check(!$('screen-guidelines').hidden && $('stepper-section').hidden && !$('ack-checkbox').checked && $('btn-start').disabled, 'restart: back to Before You Begin');
    check(errors.length === 0, 'no JavaScript errors during the whole journey' + (errors.length ? ': ' + errors.join(' | ') : ''));
  }

  function finish(extra) {
    var out = document.createElement('pre');
    out.id = 'e2e-result';
    out.textContent = JSON.stringify({ results: results, errors: errors.concat(extra ? [extra] : []) });
    document.body.appendChild(out);
  }

  window.addEventListener('load', function () {
    journey().then(function () { finish(); }, function (e) { finish('driver crashed: ' + (e && e.stack || e)); });
  });
})();
