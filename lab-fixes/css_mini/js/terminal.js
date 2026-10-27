/* ==========================================================================
   terminal.js — OWNER: Manvith Karkera
   Purpose: the pop-up Linux terminal (Lab.Terminal). A drawer docked to the bottom
   of the page, opened from the header "Terminal" button. It runs commands through
   the pure simulated shell in js/workshop.js and owns the one shared host
   configuration. Whatever the student configures here (sysctl, iptables, nft) is
   evaluated into the four defences the simulation engine understands, which is how
   the terminal controls the mitigations in step 6.
   Nothing here touches the real machine.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  var host = null, listeners = [];
  var drawer, out, input, form, openBtn;
  var history = [], historyPos = 0;
  var tall = false;
  var wired = false;
  var cmds = [], curlOk = false;         // everything typed so far (the guide checks against it)
  var guideDone = {}, guideListeners = [];

  function $(id) { return document.getElementById(id); }
  function shell() { return Lab.Workshop.shell; }

  function print(text, cls) {
    var d = document.createElement('div');
    d.className = cls || 'ws-line';
    d.textContent = text;
    out.appendChild(d);
  }

  function motd() {
    var m = (Lab.Content.workshop && Lab.Content.workshop.harden.motd) || [];
    m.forEach(function (l) { print(l, 'ws-line ws-line--dim'); });
    print('Tip: type "help" for commands, or click a suggestion below.', 'ws-line ws-line--dim');
  }

  function notify(line, result) {
    listeners.slice().forEach(function (fn) { fn(host, line, result); });
  }

  function exec(line, silentEcho) {
    if (line.trim()) { history.push(line); historyPos = history.length; }
    if (!silentEcho) print('root@web01:~# ' + line, 'ws-line ws-line--cmd');
    var r = shell().run(host, line);
    cmds.push(line);
    if (/^\s*(sudo\s+)?curl\b/.test(line)) curlOk = r.lines.length > 0 && !/timed out/.test(r.lines.join(' '));
    if (r.clear) out.textContent = '';
    r.lines.forEach(function (l) { print(l); });
    out.scrollTop = out.scrollHeight;
    updateGuide();
    notify(line, r);
    return r;
  }


  // ---- guided runbook ---------------------------------------------------------------------
  function ranMatch(re) { return cmds.some(function (c) { return re.test(c.replace(/^\s*sudo\s+/, '')); }); }

  function stepSatisfied(key) {
    var ev = shell().evaluate(host), st = ev.status;
    var conf = shell().parseConf(host.files['/etc/sysctl.d/99-synflood.conf']);
    switch (key) {
      case 'count': return host.ran.count;
      case 'klog': return host.ran.klog;
      case 'capture': return host.ran.capture;
      case 'readcookies': return ranMatch(/^sysctl\s+(-n\s+)?net\.ipv4\.tcp_syncookies\s*$/);
      case 'cookies': return st.cookies >= 1;
      case 'retries': return st.retries >= 1 && st.retries <= 3;
      case 'rateAccept': return !!st.globalLimit || st.incomplete;
      case 'rateDrop': return !!st.globalLimit && !st.lowLimit;
      case 'listRules': return ranMatch(/^(iptables\s+(-S|-L)|nft\s+list)/);
      case 'persistCookies': return conf['net.ipv4.tcp_syncookies'] >= 1;
      case 'persistRetries': return conf['net.ipv4.tcp_synack_retries'] >= 1 && conf['net.ipv4.tcp_synack_retries'] <= 3;
      case 'load': return host.loadedVersion === host.fileVersion && conf['net.ipv4.tcp_syncookies'] >= 1 && conf['net.ipv4.tcp_synack_retries'] >= 1;
      case 'curl': return curlOk;
      case 'loose': return st.loose === 0;
      case 'notrack': return st.rawNotrack;
      case 'synproxy': return st.synproxyRule;
    }
    return false;
  }

  function guideSteps() { return (Lab.Content.runbook && Lab.Content.runbook.steps) || []; }

  function guideCurrent() {
    var steps = guideSteps();
    for (var i = 0; i < steps.length; i++) if (!guideDone[steps[i].id]) return i;
    return -1;
  }

  function requiredDone() { return guideSteps().every(function (st) { return !st.required || guideDone[st.id]; }); }

  function updateGuide() {
    var steps = guideSteps(), wasRequired = requiredDone(), fresh = [];
    steps.forEach(function (st, i) {
      if (!guideDone[st.id] && stepSatisfied(st.check)) { guideDone[st.id] = true; fresh.push(i); }
    });
    renderGuide(fresh);
    fresh.forEach(function (i) {
      guideListeners.slice().forEach(function (fn) { fn(steps[i], i, !wasRequired && requiredDone()); });
    });
  }

  function renderGuide(fresh) {
    var g = $('term-guide');
    if (!g) return;
    var R = Lab.Content.runbook, steps = guideSteps();
    if (!R) return;
    g.textContent = '';
    var doneCount = steps.filter(function (st) { return guideDone[st.id]; }).length;
    var reqTotal = steps.filter(function (st) { return st.required; }).length;
    var reqDone = steps.filter(function (st) { return st.required && guideDone[st.id]; }).length;

    var head = document.createElement('div'); head.className = 'term-guide__head';
    var h = document.createElement('strong'); h.textContent = R.title; head.appendChild(h);
    var cnt = document.createElement('span'); cnt.id = 'term-guide-count'; cnt.className = 'term-guide__count';
    cnt.textContent = reqDone + ' of ' + reqTotal + ' required steps done'; head.appendChild(cnt);
    g.appendChild(head);
    var track = document.createElement('div'); track.className = 'term-guide__track'; track.setAttribute('aria-hidden', 'true');
    var bar = document.createElement('div'); bar.className = 'term-guide__bar'; bar.style.width = (reqDone / reqTotal * 100) + '%'; track.appendChild(bar);
    g.appendChild(track);

    var live = document.createElement('div'); live.className = 'term-guide__live'; live.setAttribute('role', 'status'); live.id = 'term-guide-live';
    if (fresh && fresh.length) {
      var last = steps[fresh[fresh.length - 1]];
      live.textContent = 'Step complete: ' + last.title + '. ' + last.learned;
    }
    var allReq = requiredDone();
    if (allReq) { var okb = document.createElement('div'); okb.className = 'term-guide__done'; okb.id = 'term-guide-complete'; okb.textContent = R.complete; g.appendChild(okb); }
    if (live.textContent) g.appendChild(live);

    var cur = guideCurrent();
    if (cur >= 0) {
      var st = steps[cur];
      var card = document.createElement('div'); card.className = 'term-guide__card'; card.id = 'term-guide-card';
      var tag = document.createElement('p'); tag.className = 'term-guide__tag';
      tag.textContent = (st.required ? 'Step ' : 'Bonus ') + (cur + 1) + ' of ' + steps.length; card.appendChild(tag);
      var t = document.createElement('h3'); t.className = 'term-guide__title'; t.textContent = st.title; card.appendChild(t);
      var why = document.createElement('p'); why.className = 'term-guide__why'; why.textContent = st.why; card.appendChild(why);
      var lbl = document.createElement('p'); lbl.className = 'term-guide__label'; lbl.textContent = 'Run this command:'; card.appendChild(lbl);
      var pre = document.createElement('pre'); pre.className = 'term-guide__cmd'; pre.id = 'term-guide-command';
      var code = document.createElement('code'); code.textContent = st.command; pre.appendChild(code); card.appendChild(pre);
      var ins = document.createElement('button'); ins.type = 'button'; ins.id = 'btn-guide-insert'; ins.className = 'term-drawer__btn';
      ins.textContent = 'Put it in the prompt';
      ins.addEventListener('click', function () { input.value = st.command; input.focus(); });
      card.appendChild(ins);
      g.appendChild(card);
    }

    var det = document.createElement('details'); det.className = 'term-guide__all';
    var sum = document.createElement('summary'); sum.textContent = 'All steps (' + doneCount + '/' + steps.length + ')'; det.appendChild(sum);
    var ol = document.createElement('ol');
    steps.forEach(function (st, i) {
      var li = document.createElement('li');
      li.className = guideDone[st.id] ? 'is-done' : (i === cur ? 'is-current' : '');
      li.textContent = (guideDone[st.id] ? '✓ ' : '') + st.title + (st.required ? '' : ' (bonus)');
      ol.appendChild(li);
    });
    det.appendChild(ol); g.appendChild(det);
  }

  function setOpen(open, focus) {
    if (!drawer) return;
    drawer.hidden = !open;
    document.body.classList.toggle('has-terminal', open);
    if (openBtn) { openBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); openBtn.classList.toggle('is-open', open); }
    if (open && focus !== false) input.focus({ preventScroll: true });
  }

  function wire() {
    if (wired) return;
    wired = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var cmd = input.value;
      input.value = '';
      exec(cmd);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); historyPos = Math.max(0, historyPos - 1); input.value = history[historyPos]; }
      else if (e.key === 'ArrowDown' && history.length) { e.preventDefault(); historyPos = Math.min(history.length, historyPos + 1); input.value = history[historyPos] || ''; }
      else if (e.key === 'Escape') { setOpen(false); if (openBtn) openBtn.focus(); }
    });
    out.addEventListener('click', function () { var sel = window.getSelection && window.getSelection(); if (!sel || sel.isCollapsed) input.focus(); });
    $('btn-term-close').addEventListener('click', function () { setOpen(false); if (openBtn) openBtn.focus(); });
    $('btn-term-clear').addEventListener('click', function () { out.textContent = ''; input.focus(); });
    $('btn-term-size').addEventListener('click', function () {
      tall = !tall;
      drawer.classList.toggle('is-tall', tall);
      $('btn-term-size').setAttribute('aria-label', tall ? 'Make the terminal shorter' : 'Make the terminal taller');
    });
    var maxBtn = $('btn-term-max');
    if (maxBtn) {
      maxBtn.addEventListener('click', function () {
        var isFs = drawer.classList.toggle('is-fullscreen');
        maxBtn.innerHTML = isFs ? '&#x26F6; Restore' : '&#x26F6; Fullscreen';
        maxBtn.setAttribute('aria-label', isFs ? 'Restore terminal size' : 'Make terminal full screen');
        if (isFs) {
          drawer.style.left = '';
          drawer.style.top = '';
          drawer.style.right = '';
          drawer.style.bottom = '';
          drawer.style.transform = '';
        }
      });
    }
    var bar = drawer ? drawer.querySelector('.term-drawer__bar') : null;
    if (bar) {
      var isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
      bar.addEventListener('mousedown', function (e) {
        if (e.target.closest('button')) return;
        if (drawer.classList.contains('is-fullscreen')) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        var rect = drawer.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        drawer.classList.add('is-dragging');

        function onMove(ev) {
          if (!isDragging) return;
          var dx = ev.clientX - startX;
          var dy = ev.clientY - startY;
          var newLeft = Math.max(8, Math.min(window.innerWidth - rect.width - 8, startLeft + dx));
          var newTop = Math.max(8, Math.min(window.innerHeight - 60, startTop + dy));
          drawer.style.left = newLeft + 'px';
          drawer.style.top = newTop + 'px';
          drawer.style.right = 'auto';
          drawer.style.bottom = 'auto';
          drawer.style.transform = 'none';
          drawer.style.margin = '0';
        }

        function onUp() {
          isDragging = false;
          drawer.classList.remove('is-dragging');
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        }

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    }
    if (openBtn) openBtn.addEventListener('click', function () { setOpen(drawer.hidden, true); });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === '`' || e.code === 'Backquote') && openBtn && !openBtn.hidden) { e.preventDefault(); setOpen(drawer.hidden, true); }
    });
    var chips = $('term-chips');
    if (chips) {
      var lab = document.createElement('span'); lab.className = 'ws-chips__label'; lab.textContent = 'Try:'; chips.appendChild(lab);
      ['help', 'ss -tan state syn-recv | wc -l', 'dmesg | tail', 'sysctl -a | grep syn', 'sysctl -w net.ipv4.tcp_syncookies=1', 'iptables -S'].forEach(function (c) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = c;
        b.addEventListener('click', function () { input.value = c; input.focus(); });
        chips.appendChild(b);
      });
    }
  }

  Lab.Terminal = {
    init: function () {
      drawer = $('terminal-drawer'); out = $('ws-term-output'); input = $('ws-term-input'); form = $('ws-term-form'); openBtn = $('btn-terminal');
      host = shell().createHost();
      if (!drawer || !out || !input || !form) return;
      wire();
      out.textContent = '';
      motd();
      cmds = []; curlOk = false; guideDone = {};
      renderGuide();
    },
    reset: function () {
      host = shell().createHost();
      history = []; historyPos = 0; cmds = []; curlOk = false; guideDone = {};
      if (out) { out.textContent = ''; motd(); }
      renderGuide();
      setOpen(false, false);
    },
    getHost: function () { return host; },
    getDefences: function () { return shell().evaluate(host); },
    setLevel: function (level) { if (host) host.level = level; },
    onGuide: function (fn) { guideListeners.push(fn); },
    guideProgress: function () { var st = guideSteps(); return { done: st.filter(function (x) { return guideDone[x.id]; }).length, total: st.length, requiredDone: requiredDone() }; },
    on: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    open: function (focus) { setOpen(true, focus); },
    close: function () { setOpen(false, false); },
    isOpen: function () { return !!drawer && !drawer.hidden; },
    exec: function (line) { return exec(line, false); }       // runs a command as if typed (used by tests)
  };
})(window.Lab);
