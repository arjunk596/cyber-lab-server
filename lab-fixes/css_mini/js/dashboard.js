/* ==========================================================================
   dashboard.js — OWNER: Pranav Koradiya
   Purpose: live metric cards, server-state badge, history chart, toasts,
   experiment log and the comparison table (Lab.Dashboard and Lab.Log,
   CONTRACT §5.8). Renders only: workflow.js wires the buttons.

   Important logic:
   - Engine 'tick' stores the newest State; ONE requestAnimationFrame paint
     per frame updates the cards, badge and chart, so a tick never causes
     more than one paint no matter how many events arrive.
   - Only #notifications is aria-live; cards, badge and chart are not, so
     screen readers are not flooded every simulated second.
   - The chart uses the plain 2D canvas API, reads its colours from the CSS
     tokens (getComputedStyle) on every draw so dark mode just works, and is
     scaled by devicePixelRatio so it stays crisp on high-DPI screens.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  var STATE_CLASS = {
    'Healthy': 'healthy', 'Under Pressure': 'pressure', 'Degraded': 'degraded', 'Unavailable': 'unavailable'
  };
  var LEVEL_WORD = { info: 'Info', success: 'Success', warn: 'Warning', danger: 'Danger' };
  var MITIGATION_NAMES = {
    synCookies: 'SYN cookies', rateLimit: 'rate limiting', shortTimeout: 'shorter timeouts', firewall: 'firewall filtering'
  };
  var MAX_LOG_ENTRIES = 300;
  var MAX_TOASTS = 3;
  var TOAST_MS = 6000;

  var engineRef = null;
  var unsubs = [];
  var latest = null;          // newest State from the engine
  var paintQueued = false;
  var resizeBound = false;
  var chartSize = { w: 0, h: 0, dpr: 0 };

  function $(id) { return document.getElementById(id); }
  function fmt(n) { return Number(n).toLocaleString(); }
  function pct(n) { return fmt(Math.round(n)) + '%'; }

  function getCapacity() {
    if (latest && latest.queue) return latest.queue.capacity;
    if (engineRef) return engineRef.getState().queue.capacity;
    return 100;
  }

  // ---- metric cards --------------------------------------------------------
  function card(metric) { return document.querySelector('[data-metric="' + metric + '"]'); }

  function setCard(metric, text, barPercent) {
    var c = card(metric);
    if (!c) return;
    var value = c.querySelector('.metric__value');
    if (value) value.textContent = text;
    if (barPercent !== undefined) {
      var bar = c.querySelector('.progress__bar');
      var track = c.querySelector('.progress');
      var clamped = Math.max(0, Math.min(100, barPercent));
      if (bar) bar.style.width = clamped + '%';
      if (track) track.setAttribute('aria-valuenow', Math.round(clamped));
    }
  }

  // Give each progress track proper semantics once (not live, so it is not announced every tick).
  function initProgressSemantics() {
    var cards = document.querySelectorAll('[data-metric]');
    for (var i = 0; i < cards.length; i++) {
      var track = cards[i].querySelector('.progress');
      var label = cards[i].querySelector('.metric__label');
      if (!track) continue;
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      track.setAttribute('aria-valuenow', '0');
      if (label) track.setAttribute('aria-label', label.textContent);
    }
  }

  function renderCards(state) {
    var m = state.metrics;
    setCard('syn-incoming', fmt(m.synIncoming));
    setCard('pending', fmt(m.pending) + ' / ' + fmt(state.queue.capacity));
    setCard('completed', fmt(m.legitCompleted));
    setCard('rejected', fmt(m.rejected + m.timedOut));
    setCard('queue-util', pct(m.queueUtil), m.queueUtil);
    setCard('cpu', pct(m.cpu), m.cpu);
    setCard('response-time', fmt(Math.round(m.responseTimeMs)));
    setCard('availability', pct(m.availability), m.availability);
  }

  function renderBadge(serverState) {
    var el = $('server-state');
    if (!el) return;
    var cls = STATE_CLASS[serverState] || 'healthy';
    el.className = 'server-badge server-badge--' + cls;
    el.setAttribute('data-state', cls);
    var explanation = Lab.Content && Lab.Content.serverStates && Lab.Content.serverStates[serverState];
    el.textContent = '';
    var name = document.createElement('span');
    name.className = 'server-state__name';
    name.textContent = 'Server: ' + serverState;
    el.appendChild(name);
    if (explanation) {
      var desc = document.createElement('span');
      desc.className = 'server-state__desc';
      desc.textContent = ' — ' + explanation;
      el.appendChild(desc);
    }
  }

  // ---- paint scheduling ----------------------------------------------------
  function paintNow() {
    if (!paintQueued) return;                 // already painted by the other trigger below
    paintQueued = false;
    if (!latest) return;
    renderCards(latest);
    renderBadge(latest.serverState);
    drawChart();
  }

  // One paint per frame. requestAnimationFrame is paused in background tabs, so a short timeout is the
  // fallback: whichever fires first paints, the other finds nothing to do.
  function schedulePaint() {
    if (paintQueued) return;
    paintQueued = true;
    requestAnimationFrame(paintNow);
    setTimeout(paintNow, 100);
  }

  // ---- chart ---------------------------------------------------------------
  function cssVar(styles, name, fallback) {
    var v = styles.getPropertyValue(name);
    return v && v.trim() ? v.trim() : fallback;
  }

  function drawChart() {
    var canvas = $('chart-history');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.style.width = '100%';
    canvas.style.maxWidth = '100%';
    canvas.style.display = 'block';
    var dpr = window.devicePixelRatio || 1;
    var cssW = Math.max(260, Math.round(canvas.clientWidth || 800));
    var cssH = Math.max(190, Math.min(300, Math.round(cssW * 0.32)));
    if (chartSize.w !== cssW || chartSize.h !== cssH || chartSize.dpr !== dpr) {
      chartSize = { w: cssW, h: cssH, dpr: dpr };
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var styles = getComputedStyle(document.documentElement);
    var cText = cssVar(styles, '--color-text', '#1b2430');
    var cMuted = cssVar(styles, '--color-muted', '#5b6675');
    var cGrid = cssVar(styles, '--color-border', '#d5dbe3');
    var cAvail = cssVar(styles, '--color-healthy', '#12804f');
    var cQueue = cssVar(styles, '--color-attack', '#c8421a');
    var font = cssVar(styles, '--font-sans', 'sans-serif');

    var history = latest && latest.history ? latest.history : [];
    var lastT = history.length ? history[history.length - 1].t : 0;
    var xMax = Math.max(20, Math.ceil(lastT / 5) * 5);
    var xStep = xMax <= 25 ? 5 : (xMax <= 60 ? 10 : 20);

    var L = 46, R = 14, T = 34, B = 40;
    var pw = cssW - L - R, ph = cssH - T - B;
    var px = function (t) { return L + (t / xMax) * pw; };
    var py = function (v) { return T + ph - (v / 100) * ph; };

    ctx.font = '12px ' + font;
    ctx.textBaseline = 'middle';

    // grid + y labels
    ctx.lineWidth = 1;
    ctx.strokeStyle = cGrid;
    ctx.fillStyle = cMuted;
    ctx.textAlign = 'right';
    for (var v = 0; v <= 100; v += 25) {
      ctx.beginPath(); ctx.moveTo(L, py(v) + 0.5); ctx.lineTo(L + pw, py(v) + 0.5); ctx.stroke();
      ctx.fillText(v + '%', L - 6, py(v));
    }
    // x labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var t = 0; t <= xMax; t += xStep) {
      ctx.beginPath(); ctx.moveTo(px(t) + 0.5, T + ph); ctx.lineTo(px(t) + 0.5, T + ph + 4); ctx.stroke();
      ctx.fillText(String(t), px(t), T + ph + 6);
    }
    var xTitle = 'Simulated seconds';

    // legend (top-left) and the "Simulated data" label (top-right, or under the axis if it will not fit)
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var simLabel = 'Simulated data';
    // pick the longest legend wording that fits on one row (phones get the short one)
    var legends = [['Availability %', 'Queue utilisation %'], ['Availability', 'Queue util.'], ['Avail.', 'Queue']];
    var legend = legends[legends.length - 1];
    var legendW = 0;
    for (var li = 0; li < legends.length; li++) {
      legendW = 34 + ctx.measureText(legends[li][0]).width + 18 + 34 + ctx.measureText(legends[li][1]).width;
      if (L + legendW < cssW - R) { legend = legends[li]; break; }
    }
    var simFits = L + legendW + 14 + ctx.measureText(simLabel).width < cssW - R;
    var x = L;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = cAvail; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 28, 14); ctx.stroke();
    ctx.fillStyle = cText; ctx.fillText(legend[0], x + 34, 14);
    x += 34 + ctx.measureText(legend[0]).width + 18;
    ctx.strokeStyle = cQueue; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(x, 14); ctx.lineTo(x + 28, 14); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cText; ctx.fillText(legend[1], x + 34, 14);
    if (simFits) {
      ctx.textAlign = 'right'; ctx.fillStyle = cMuted;
      ctx.fillText(simLabel, cssW - R, 14);
    } else {
      xTitle += ' · ' + simLabel;
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = cMuted;
    ctx.fillText(xTitle, L + pw / 2, cssH - 2);

    // data lines
    function line(key, color, dash) {
      if (!history.length) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.setLineDash(dash);
      ctx.beginPath();
      history.forEach(function (row, i) {
        if (i === 0) ctx.moveTo(px(row.t), py(row[key])); else ctx.lineTo(px(row.t), py(row[key]));
      });
      ctx.stroke();
      ctx.setLineDash([]);
      var last = history[history.length - 1];
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(px(last.t), py(last[key]), 3.5, 0, Math.PI * 2); ctx.fill();
    }
    line('queueUtil', cQueue, [6, 4]);
    line('availability', cAvail, []);

    var last = history[history.length - 1];
    canvas.setAttribute('aria-label', last
      ? 'History chart (simulated data). At ' + last.t + ' simulated seconds availability is ' + Math.round(last.availability) +
        ' percent and queue utilisation is ' + Math.round(last.queueUtil) + ' percent.'
      : 'History chart of availability and queue utilisation (simulated data). No data yet.');
  }

  function bindResize() {
    if (resizeBound) return;
    resizeBound = true;
    var redraw = function () { chartSize = { w: 0, h: 0, dpr: 0 }; requestAnimationFrame(drawChart); };
    window.addEventListener('resize', redraw);
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', redraw);
    }
    var canvas = $('chart-history');
    if (canvas && window.ResizeObserver) {
      new ResizeObserver(function () {
        if (canvas.clientWidth && Math.round(canvas.clientWidth) !== chartSize.w) requestAnimationFrame(drawChart);
      }).observe(canvas);
    }
  }

  // ---- toasts --------------------------------------------------------------
  function toastHost() {
    var host = $('toast-container');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'toast-container';
    host.setAttribute('aria-hidden', 'true');   // the same text is announced through #notifications
    host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:1000;display:flex;flex-direction:column;gap:8px;max-width:calc(100vw - 32px)';
    document.body.appendChild(host);
    return host;
  }

  function notify(message, level) {
    level = LEVEL_WORD[level] ? level : 'info';
    var live = $('notifications');
    if (live) {
      live.textContent = '';
      setTimeout(function () { live.textContent = message; }, 40);   // clear first so repeats are re-announced
    }
    var host = toastHost();
    while (host.children.length >= MAX_TOASTS) host.removeChild(host.firstChild);
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + level;
    toast.textContent = LEVEL_WORD[level] + ': ' + message;
    host.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, TOAST_MS);
  }

  // ---- log -----------------------------------------------------------------
  function two(n) { return n < 10 ? '0' + n : String(n); }

  function addLog(message, level, simT) {
    var list = $('log-list');
    if (!list) return;
    level = LEVEL_WORD[level] ? level : 'info';
    var now = new Date();
    var li = document.createElement('li');
    li.className = 'log-entry log-entry--' + level;

    var wall = document.createElement('span');
    wall.className = 'log-entry__time';
    wall.textContent = two(now.getHours()) + ':' + two(now.getMinutes()) + ':' + two(now.getSeconds());
    var levelWord = document.createElement('span');
    levelWord.className = 'log-entry__level';
    levelWord.textContent = LEVEL_WORD[level];
    var text = document.createElement('span');
    text.className = 'log-entry__message';
    text.textContent = message;
    li.appendChild(wall);
    li.appendChild(document.createTextNode(' '));
    if (typeof simT === 'number') {
      var sim = document.createElement('span');
      sim.className = 'log-entry__sim';
      sim.textContent = '(t = ' + simT + ' s)';
      li.appendChild(sim);
      li.appendChild(document.createTextNode(' '));
    }
    li.appendChild(levelWord);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(text);

    list.insertBefore(li, list.firstChild);              // newest first
    while (list.children.length > MAX_LOG_ENTRIES) list.removeChild(list.lastChild);
  }

  Lab.Log = {
    add: function (message, level) {
      // Simulated time is shown only while a run is active.
      var t = engineRef && engineRef.isRunning() ? engineRef.getState().t : undefined;
      addLog(message, level, t);
    },
    clear: function () {
      var list = $('log-list');
      if (list) list.textContent = '';
    }
  };

  // ---- comparison ----------------------------------------------------------
  var ROWS = [
    { label: 'Pending connections (peak)', key: 'peakPending', unit: '',  lowerIsBetter: true },
    { label: 'Legitimate connection success', key: 'legitSuccessRate', unit: '%', lowerIsBetter: false },
    { label: 'Avg response time (ms)', key: 'avgResponseTimeMs', unit: '', lowerIsBetter: true },
    { label: 'Peak server resource usage (%)', key: 'peakCpu', unit: '%', lowerIsBetter: true },
    { label: 'Service availability (avg %)', key: 'avgAvailability', unit: '%', lowerIsBetter: false },
    { label: 'Final server state', key: 'finalServerState', unit: '', text: true }
  ];

  function cell(tag, text, scope) {
    var c = document.createElement(tag);
    if (scope) c.setAttribute('scope', scope);
    c.textContent = text;
    return c;
  }

  function valueText(run, row) {
    if (!run || run[row.key] === undefined || run[row.key] === null) return '—';
    return row.text ? String(run[row.key]) : fmt(Math.round(run[row.key])) + row.unit;
  }

  function renderTable(runs) {
    var table = $('compare-table');
    if (!table) return;
    table.textContent = '';
    var caption = document.createElement('caption');
    caption.className = 'visually-hidden';
    caption.textContent = 'Comparison of baseline, attack and mitigated runs (simulated data)';
    table.appendChild(caption);

    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['Metric', 'Baseline', 'Under attack', 'With mitigation'].forEach(function (h) { hr.appendChild(cell('th', h, 'col')); });
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    ROWS.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.appendChild(cell('th', row.label, 'row'));
      tr.appendChild(cell('td', valueText(runs.baseline, row)));
      tr.appendChild(cell('td', valueText(runs.attack, row)));
      var td = cell('td', valueText(runs.mitigated, row));
      // change indicator: mitigated column relative to the attack column (numbers only)
      if (!row.text && runs.mitigated && runs.attack &&
          typeof runs.mitigated[row.key] === 'number' && typeof runs.attack[row.key] === 'number') {
        var diff = Math.round(runs.mitigated[row.key]) - Math.round(runs.attack[row.key]);
        if (diff !== 0) {
          var up = diff > 0;
          var good = row.lowerIsBetter ? !up : up;
          var span = document.createElement('span');
          span.className = 'compare-change compare-change--' + (good ? 'good' : 'bad') + ' compare-change--' + (up ? 'up' : 'down');
          span.textContent = ' ' + (up ? '▲' : '▼') + ' ' + fmt(Math.abs(diff)) + row.unit;
          var sr = document.createElement('span');
          sr.className = 'visually-hidden';
          sr.textContent = (up ? ' increase' : ' decrease') + ' of ' + fmt(Math.abs(diff)) + ' compared with the attack run, which is ' + (good ? 'better' : 'worse');
          td.appendChild(span);
          td.appendChild(sr);
        }
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  function joinNames(list) {
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  function buildExplanation(runs) {
    var cap = getCapacity();
    var sentences = [];
    var base = runs.baseline, atk = runs.attack, mit = runs.mitigated;

    if (atk) {
      var level = atk.level ? atk.level + ' ' : '';
      var a = Math.round(atk.avgAvailability);
      if (base && Math.round(base.avgAvailability) > a) {
        sentences.push('During the ' + level + 'flood availability fell from ' + Math.round(base.avgAvailability) + '% to ' + a +
          '% because pending connections reached ' + atk.peakPending + '/' + cap + '.');
      } else {
        sentences.push('During the ' + level + 'flood average availability was ' + a + '% and pending connections peaked at ' +
          atk.peakPending + '/' + cap + '.');
      }
      sentences.push('The server finished in the ' + atk.finalServerState + ' state, with response time averaging ' +
        fmt(Math.round(atk.avgResponseTimeMs)) + ' ms.');
    } else if (base) {
      sentences.push('With normal traffic only, average availability was ' + Math.round(base.avgAvailability) +
        '% and the server finished ' + base.finalServerState + '.');
    }

    if (mit) {
      var used = Object.keys(MITIGATION_NAMES).filter(function (k) { return mit.mitigation && mit.mitigation[k]; })
        .map(function (k) { return MITIGATION_NAMES[k]; });
      var m = Math.round(mit.avgAvailability);
      var verb = atk ? (m > Math.round(atk.avgAvailability) ? 'it recovered to ' : (m < Math.round(atk.avgAvailability) ? 'it dropped to ' : 'it stayed at ')) : 'availability was ';
      sentences.push(used.length
        ? 'With ' + joinNames(used) + ' enabled, ' + verb + m + '% and pending connections peaked at ' + mit.peakPending + '.'
        : 'With no mitigation enabled, ' + verb + m + '% and pending connections peaked at ' + mit.peakPending + '.');
    }

    if (!sentences.length) return 'Run the baseline, the attack and a mitigated run to see how they compare.';
    sentences.push('No single defence fully prevents real-world denial-of-service attacks; these figures are simulated estimates.');
    return sentences.join(' ');
  }

  function renderComparison(runs) {
    runs = runs || {};
    renderTable(runs);
    var p = $('compare-explanation');
    if (p) p.textContent = buildExplanation(runs);
  }

  // ---- public API ----------------------------------------------------------
  function zeroCards() {
    setCard('syn-incoming', '0');
    setCard('pending', '0 / ' + fmt(getCapacity()));
    setCard('completed', '0');
    setCard('rejected', '0');
    setCard('queue-util', '0%', 0);
    setCard('cpu', '0%', 0);
    setCard('response-time', '40');
    setCard('availability', '100%', 100);
  }

  Lab.Dashboard = {
    init: function (engine) {
      unsubs.forEach(function (u) { u(); });
      unsubs = [];
      engineRef = engine || null;
      initProgressSemantics();
      bindResize();
      if (engine) {
        latest = engine.getState();
        unsubs.push(engine.on('tick', function (state) { latest = state; schedulePaint(); }));
        unsubs.push(engine.on('serverStateChange', function (e) {
          latest = engine.getState();
          schedulePaint();
          if (e.to === 'Degraded' || e.to === 'Unavailable') {
            notify('Server is now ' + e.to + ' (simulated, t = ' + e.t + ' s).', e.to === 'Unavailable' ? 'danger' : 'warn');
          } else if (e.to === 'Healthy' && e.from !== 'Healthy') {
            notify('Server has recovered and is Healthy (simulated).', 'success');
          }
        }));
        unsubs.push(engine.on('log', function (e) { addLog(e.message, e.level, e.t); }));
      }
      zeroCards();
      renderBadge('Healthy');
      drawChart();
    },

    notify: notify,

    renderComparison: renderComparison,

    reset: function () {
      latest = engineRef ? engineRef.getState() : null;
      if (latest) latest.history = [];          // the chart starts empty again
      zeroCards();
      renderBadge('Healthy');
      chartSize = { w: 0, h: 0, dpr: 0 };
      drawChart();
      var table = $('compare-table');
      if (table) table.textContent = '';
      var p = $('compare-explanation');
      if (p) p.textContent = '';
      var host = $('toast-container');
      if (host) host.textContent = '';
      var live = $('notifications');
      if (live) live.textContent = '';
    }
  };
})(window.Lab);
