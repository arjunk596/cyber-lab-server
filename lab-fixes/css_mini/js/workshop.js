/* ==========================================================================
   workshop.js — OWNER: Manvith Karkera
   Purpose: "Part 2: Defender's Workshop" (Lab.Workshop). Five modules built from
   Lab.Content.workshop: Understand, Investigate, Harden, Choose layers, Run the
   incident.

   Two halves:
   1. A small, PURE simulated Linux shell (Lab.Workshop.shell): createHost(), run(),
      evaluate(). It understands the real commands a defender uses (sysctl, ss,
      netstat, dmesg, tcpdump, iptables, nft, ipset, curl, ...), keeps its own host
      state, and never touches the real machine. It has no DOM code, so it is unit
      tested in Node (tests/shell.test.js).
   2. The UI, which renders the modules, drives the terminal and replays the attack
      against the student's hardened configuration with a private engine instance.

   The shell evaluates the host configuration into the same four defences the
   simulation engine knows (SYN cookies, rate limiting, shorter timeouts, firewall),
   so the hardening result is produced by the same cause-and-effect model as Part 1.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  var ATTACK_RATE = { low: 300, medium: 1500, high: 6000 };   // forged SYN per second against web01
  var ATTACK_SECONDS_LOGGED = 600;                             // the attack has been running about ten minutes

  // =========================================================================
  // 1. SIMULATED SHELL (pure)
  // =========================================================================
  var SYSCTL_RANGES = {
    'net.ipv4.tcp_syncookies': [0, 2],
    'net.ipv4.tcp_max_syn_backlog': [1, 1048576],
    'net.core.somaxconn': [1, 65535],
    'net.ipv4.tcp_synack_retries': [0, 255],
    'net.ipv4.tcp_abort_on_overflow': [0, 1],
    'net.ipv4.tcp_timestamps': [0, 2],
    'net.netfilter.nf_conntrack_tcp_loose': [0, 1]
  };
  var SYSCTL_ORDER = Object.keys(SYSCTL_RANGES);
  var SYSCTL_FILES = ['/etc/sysctl.conf'];                    // /etc/sysctl.d/*.conf is accepted by prefix
  var BASE_LINES = [
    'Linux web01 5.15.0-91-generic #101-Ubuntu SMP x86_64 GNU/Linux'
  ];

  function createHost() {
    return {
      sysctl: {
        'net.ipv4.tcp_syncookies': 0,                         // a "performance" profile switched cookies off
        'net.ipv4.tcp_max_syn_backlog': 256,
        'net.core.somaxconn': 128,
        'net.ipv4.tcp_synack_retries': 5,
        'net.ipv4.tcp_abort_on_overflow': 0,
        'net.ipv4.tcp_timestamps': 1,
        'net.netfilter.nf_conntrack_tcp_loose': 1
      },
      files: { '/etc/sysctl.conf': '', '/etc/sysctl.d/99-synflood.conf': '' },
      fileVersion: 0,
      loadedVersion: 0,
      rules: [],                                              // iptables and nft rules in the order they were added
      ipsets: {},
      ran: { count: false, klog: false, capture: false },
      cmdCount: 0,
      level: 'medium',
      lastTest: null
    };
  }

  // ---- tokenising ----------------------------------------------------------
  function splitPipes(line) {
    var parts = [], cur = '', q = null;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) { cur += c; if (c === q) q = null; }
      else if (c === '"' || c === "'") { q = c; cur += c; }
      else if (c === '|') { parts.push(cur); cur = ''; }
      else cur += c;
    }
    if (q) return null;                                       // unbalanced quote
    parts.push(cur);
    return parts;
  }

  function tokenize(s) {
    var out = [], cur = '', q = null, has = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (q) { if (c === q) q = null; else cur += c; }
      else if (c === '"' || c === "'") { q = c; has = true; }
      else if (/\s/.test(c)) { if (has || cur) { out.push(cur); cur = ''; has = false; } }
      else { cur += c; has = true; }
    }
    if (has || cur) out.push(cur);
    return out;
  }

  // ---- output items ----------------------------------------------------------
  // An output item is a string, or { gen: function(i) -> string, n: count } for a group of similar lines
  // (e.g. 4096 SYN-RECV sockets), so counts stay exact without building thousands of strings.
  function itemCount(it) { return typeof it === 'string' ? 1 : it.n; }
  function itemText(it, i) { return typeof it === 'string' ? it : it.gen(i); }
  function totalLines(items) { return items.reduce(function (a, it) { return a + itemCount(it); }, 0); }

  function takeHead(items, k) {
    var out = [], left = k;
    items.forEach(function (it) {
      if (left <= 0) return;
      var n = itemCount(it);
      if (n <= left) { out.push(it); left -= n; }
      else { out.push({ gen: it.gen, n: left }); left = 0; }
    });
    return out;
  }

  function takeTail(items, k) {
    var out = [], left = k;
    for (var j = items.length - 1; j >= 0 && left > 0; j--) {
      var it = items[j], n = itemCount(it);
      if (n <= left) { out.unshift(it); left -= n; }
      else {
        var skip = n - left, g = it.gen;
        out.unshift({ gen: function (i) { return g(i + skip); }, n: left }); left = 0;
      }
    }
    return out;
  }

  function mulberry(seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randIp(rnd) {
    var first = [5, 14, 24, 36, 45, 62, 77, 91, 103, 118, 141, 168, 185, 190, 200, 212][Math.floor(rnd() * 16)];
    return first + '.' + Math.floor(rnd() * 255) + '.' + Math.floor(rnd() * 255) + '.' + (1 + Math.floor(rnd() * 253));
  }

  // ---- attack model: what the host looks like under the flood ----------------
  function toInt(v) { return typeof v === 'number' ? v : parseInt(v, 10); }

  function attackModel(host) {
    var ev = evaluate(host);
    var rate = ATTACK_RATE[host.level] || ATTACK_RATE.medium;
    var retries = toInt(host.sysctl['net.ipv4.tcp_synack_retries']);
    var life = Math.pow(2, retries + 1) - 1;
    var backlog = toInt(host.sysctl['net.ipv4.tcp_max_syn_backlog']);
    var through = rate;                                       // forged SYN per second that reach the TCP stack
    if (ev.status.globalLimit) through = Math.min(rate, ev.status.globalLimit.rate);
    if (ev.status.synproxyActive) through = Math.round(rate * 0.02);   // SYNPROXY absorbs the handshake in the firewall
    var wanted = through * life;                              // Little's law
    var cookies = ev.status.cookies >= 1;
    return {
      rate: rate, life: life, backlog: backlog, through: through, wanted: wanted,
      synrecv: Math.min(backlog, wanted),
      full: wanted >= backlog,
      cookies: cookies,
      refusing: wanted >= backlog && !cookies,
      ev: ev
    };
  }

  // ---- evaluating the host configuration ------------------------------------
  function parseRate(s) {                                      // "400/s", "400/sec", "400/second", "6000/min"
    var m = /^(\d+)\/(s|sec|second|m|min|minute|h|hour)$/i.exec(s || '');
    if (!m) return null;
    var n = parseInt(m[1], 10), u = m[2].toLowerCase()[0];
    return u === 's' ? n : (u === 'm' ? n / 60 : n / 3600);
  }

  function parseConf(text) {
    var out = {};
    String(text || '').split('\n').forEach(function (l) {
      l = l.trim();
      if (!l || l[0] === '#') return;
      var m = /^([a-z0-9_.]+)\s*=\s*(-?\d+)$/i.exec(l);
      if (m) out[m[1]] = parseInt(m[2], 10);
    });
    return out;
  }

  function evaluate(host) {
    var s = host.sysctl;
    var cookies = toInt(s['net.ipv4.tcp_syncookies']);
    var retries = toInt(s['net.ipv4.tcp_synack_retries']);
    var backlog = toInt(s['net.ipv4.tcp_max_syn_backlog']);
    var somax = toInt(s['net.core.somaxconn']);
    var loose = toInt(s['net.netfilter.nf_conntrack_tcp_loose']);
    var peak = (Lab.Content && Lab.Content.workshop && Lab.Content.workshop.scenario.normalPeakSynPerSec) || 150;

    var filterRules = host.rules.filter(function (r) { return r.table === 'filter'; });
    var globalLimit = null, perSource = false, blocklist = false, incomplete = false, lowLimit = false;
    filterRules.forEach(function (r, idx) {
      if (!r.syn) return;
      if (r.nft) {
        if (r.perSource) perSource = true;
        else if (r.overRate && /drop|reject/.test(r.action)) globalLimit = globalLimit || { rate: r.overRate, kind: 'nft' };
        else if (r.limitRate && r.action === 'accept') {
          var laterDrop = filterRules.slice(idx + 1).some(function (x) { return x.syn && /drop|reject/.test(x.action) && !x.limitRate && !x.overRate; });
          if (laterDrop) globalLimit = globalLimit || { rate: r.limitRate, kind: 'nft' }; else incomplete = true;
        }
        return;
      }
      if (r.mods.indexOf('hashlimit') >= 0 && /DROP|REJECT/.test(r.target)) {
        if (/srcip/.test(r.hashMode || '')) perSource = true;
        else if (r.hashAbove) globalLimit = globalLimit || { rate: r.hashAbove, kind: 'hashlimit' };
      } else if (r.mods.indexOf('limit') >= 0 && r.target === 'ACCEPT') {
        var later = filterRules.slice(idx + 1).some(function (x) { return x.syn && /^(DROP|REJECT)$/.test(x.target) && x.mods.indexOf('limit') < 0 && x.mods.indexOf('hashlimit') < 0; });
        if (later) globalLimit = globalLimit || { rate: r.limitRate || 1, kind: 'limit' }; else incomplete = true;
      } else if ((r.mods.indexOf('connlimit') >= 0 || r.mods.indexOf('recent') >= 0) && /DROP|REJECT/.test(r.target)) {
        perSource = true;
      } else if (r.mods.indexOf('set') >= 0 && /DROP|REJECT/.test(r.target)) {
        blocklist = true;
      }
    });
    if (globalLimit && globalLimit.rate < peak) { lowLimit = true; }

    var rawNotrack = host.rules.some(function (r) { return r.table === 'raw' && r.chain === 'PREROUTING' && r.target === 'CT' && r.notrack && r.syn; });
    var synproxyRule = host.rules.some(function (r) { return r.target === 'SYNPROXY' && r.chain === 'INPUT'; });
    var synproxyActive = rawNotrack && synproxyRule && loose === 0 && cookies >= 1;

    var defences = {
      synCookies: cookies >= 1,
      shortTimeout: retries >= 0 && retries <= 3,
      rateLimit: !!globalLimit && !lowLimit,
      firewall: synproxyActive
    };

    var notes = [];
    if (cookies >= 1) notes.push({ level: 'good', text: 'SYN cookies are on (tcp_syncookies = ' + cookies + '), so genuine clients can connect while the queue is full.' });
    else notes.push({ level: 'bad', text: 'SYN cookies are off. When the SYN queue fills, the kernel can only drop new SYNs, so genuine customers are refused too.' });
    if (retries >= 1 && retries <= 3) notes.push({ level: 'good', text: 'tcp_synack_retries = ' + retries + ' removes forged entries after ' + (Math.pow(2, retries + 1) - 1) + ' s instead of 63 s.' });
    else if (retries === 0) notes.push({ level: 'warn', text: 'tcp_synack_retries = 0 never retransmits a SYN-ACK. It frees entries instantly but also breaks genuine clients on lossy mobile links.' });
    else if (retries > 3) notes.push({ level: 'warn', text: 'tcp_synack_retries = ' + retries + ' keeps every forged entry for ' + (Math.pow(2, retries + 1) - 1) + ' s, which makes the queue easier to fill.' });
    if (backlog >= 2048 && somax >= 2048) notes.push({ level: 'info', text: 'Larger queues (backlog ' + backlog + ', somaxconn ' + somax + ') buy time and absorb bursts, but a sustained flood still fills them.' });
    if (globalLimit && !lowLimit) notes.push({ level: 'good', text: 'A global SYN limit of ' + Math.round(globalLimit.rate) + '/s caps what reaches the TCP stack without depending on the (forged) source address.' });
    if (lowLimit) notes.push({ level: 'bad', text: 'Your SYN limit (' + Math.round(globalLimit.rate) + '/s) is below the normal customer peak of about ' + peak + '/s. You would block genuine customers even without an attack.' });
    if (incomplete) notes.push({ level: 'warn', text: 'A rate-limit ACCEPT rule on its own changes nothing, because the default policy is ACCEPT. Add a DROP rule for SYN packets after it.' });
    if (perSource && !globalLimit) notes.push({ level: 'warn', text: 'A per-source limit (srcip, connlimit, recent) does not stop a spoofed flood: every packet claims a different source address, so none exceeds the limit. It is still good against a single real abuser.' });
    if (blocklist) notes.push({ level: 'warn', text: 'A static blocklist does not help against forged, changing source addresses and can block innocent networks.' });
    if (synproxyRule && !synproxyActive) notes.push({ level: 'warn', text: 'A SYNPROXY rule exists but is not effective yet. It needs the raw-table NOTRACK rule, nf_conntrack_tcp_loose = 0, and tcp_syncookies enabled.' });
    if (synproxyActive) notes.push({ level: 'good', text: 'SYNPROXY is active: the firewall completes the handshake and only forwards connections that proved they are real.' });

    return {
      defences: defences,
      notes: notes,
      blocksCustomers: lowLimit,
      status: {
        cookies: cookies, retries: retries, backlog: backlog, somaxconn: somax, loose: loose,
        globalLimit: globalLimit, perSource: perSource, blocklist: blocklist, incomplete: incomplete,
        rawNotrack: rawNotrack, synproxyRule: synproxyRule, synproxyActive: synproxyActive, lowLimit: lowLimit
      }
    };
  }

  // ---- sysctl ---------------------------------------------------------------
  function sysctlPath(key) { return '/proc/sys/' + key.replace(/\./g, '/'); }

  function sysctlSet(host, key, val, out) {
    if (!(key in SYSCTL_RANGES)) {
      out.push('sysctl: cannot stat ' + sysctlPath(key) + ': No such file or directory');
      return false;
    }
    if (!/^-?\d+$/.test(String(val))) { out.push('sysctl: setting key "' + key + '": Invalid argument'); return false; }
    var n = parseInt(val, 10), r = SYSCTL_RANGES[key];
    if (n < r[0] || n > r[1]) { out.push('sysctl: setting key "' + key + '": Invalid argument'); return false; }
    host.sysctl[key] = n;
    out.push(key + ' = ' + n);
    return true;
  }

  function loadConfFile(host, path, out) {
    var conf = parseConf(host.files[path]);
    Object.keys(conf).forEach(function (k) { sysctlSet(host, k, conf[k], out); });
  }

  function cmdSysctl(host, a) {
    var out = [];
    var args = a.slice(1);
    var quiet = false, all = false, load = null, system = false, write = false;
    var keys = [];
    for (var i = 0; i < args.length; i++) {
      var t = args[i];
      if (t === '-n') quiet = true;
      else if (t === '-a' || t === '--all') all = true;
      else if (t === '-w' || t === '--write') write = true;
      else if (t === '--system') system = true;
      else if (t === '-p' || t === '--load') { load = (args[i + 1] && args[i + 1][0] !== '-') ? args[++i] : '/etc/sysctl.conf'; }
      else if (t[0] === '-' && t.indexOf('=') < 0) { out.push('sysctl: invalid option -- \'' + t.replace(/^-+/, '') + '\''); return out; }
      else keys.push(t);
    }
    if (system) {
      Object.keys(host.files).sort().forEach(function (f) {
        if (/^\/etc\/sysctl\.d\/.*\.conf$/.test(f) || f === '/etc/sysctl.conf') {
          out.push('* Applying ' + f + ' ...');
          loadConfFile(host, f, out);
        }
      });
      host.loadedVersion = host.fileVersion;
      return out;
    }
    if (load) {
      if (!(load in host.files)) { out.push('sysctl: cannot open "' + load + '": No such file or directory'); return out; }
      loadConfFile(host, load, out);
      host.loadedVersion = host.fileVersion;
      return out;
    }
    if (all) {
      SYSCTL_ORDER.forEach(function (k) { out.push(k + ' = ' + host.sysctl[k]); });
      return out;
    }
    if (!keys.length) { out.push('sysctl: no variables specified', "Try `sysctl --help' for more information."); return out; }
    keys.forEach(function (k) {
      var eq = k.indexOf('=');
      if (eq > 0) {                                           // key=value (a write)
        sysctlSet(host, k.slice(0, eq).replace(/\s+/g, ''), k.slice(eq + 1), out);
      } else if (write) {
        out.push('sysctl: "' + k + '" must be of the form name=value');
      } else if (k in SYSCTL_RANGES) {
        out.push(quiet ? String(host.sysctl[k]) : k + ' = ' + host.sysctl[k]);
      } else {
        out.push('sysctl: cannot stat ' + sysctlPath(k) + ': No such file or directory');
      }
    });
    return out;
  }

  // ---- files, echo, tee --------------------------------------------------------
  function writeFile(host, path, text, append) {
    var allowed = path === '/etc/sysctl.conf' || /^\/etc\/sysctl\.d\/[A-Za-z0-9._-]+\.conf$/.test(path);
    if (!allowed) return '-bash: ' + path + ': Read-only in this lab (use /etc/sysctl.d/99-synflood.conf)';
    var cur = host.files[path] || '';
    host.files[path] = append ? cur + text + '\n' : text + '\n';
    host.fileVersion++;
    return null;
  }

  // ---- ss / netstat ------------------------------------------------------------
  function ssLines(host, args) {
    var m = attackModel(host);
    var seed = host.cmdCount * 7919 + 17;
    var noHeader = args.some(function (t) { return /^-[a-zA-Z]*H/.test(t); });
    if (args.indexOf('-s') >= 0) {
      var total = 211 + m.synrecv + 13;
      return [
        'Total: ' + (total + 6),
        'TCP:   ' + total + ' (estab 211, closed 3, orphaned 0, timewait 9)',
        '',
        'Transport Total     IP        IPv6',
        'RAW       0         0         0',
        'UDP       6         4         2',
        'TCP       ' + total + '      ' + (total - 4) + '      4',
        'INET      ' + (total + 6) + '      ' + (total + 2) + '      6',
        'FRAG      0         0         0'
      ];
    }
    var wantsSyn = args.indexOf('state') >= 0 && /syn-recv|syn_recv/i.test(args[args.indexOf('state') + 1] || '');
    var header = noHeader ? [] : ['State      Recv-Q  Send-Q   Local Address:Port    Peer Address:Port'];
    var rows = [];
    var rnd = mulberry(seed);
    var peers = [];
    for (var i = 0; i < 40; i++) peers.push(randIp(rnd) + ':' + (1024 + Math.floor(rnd() * 60000)));
    var syn = { gen: function (i) { return 'SYN-RECV   0       0        203.0.113.10:443      ' + peers[i % peers.length]; }, n: m.synrecv };
    var estab = { gen: function (i) { return 'ESTAB      0       0        203.0.113.10:443      198.51.100.' + (1 + (i % 250)) + ':' + (40000 + i); }, n: 211 };
    if (wantsSyn) { if (m.synrecv > 0) rows.push(syn); return header.concat(rows); }
    var listen = ['LISTEN     0       ' + m.backlog + '     0.0.0.0:443           0.0.0.0:*'];
    return header.concat(listen, [estab], m.synrecv > 0 ? [syn] : []);
  }

  function netstatLines(host, args) {
    var m = attackModel(host);
    if (args.indexOf('-s') >= 0 || args.some(function (t) { return /^-[a-z]*s$/.test(t); })) {
      var dropped = m.refusing ? Math.round(m.through * ATTACK_SECONDS_LOGGED * 0.62) : 0;
      var overflow = m.refusing ? Math.round(dropped / 6) : (m.full ? 41 : 0);
      var sent = m.cookies && m.full ? Math.round((m.through - m.backlog / m.life) * ATTACK_SECONDS_LOGGED) : 0;
      return [
        'Tcp:',
        '    18432 active connection openings',
        '    2291847 passive connection openings',
        '    1204 failed connection attempts',
        'TcpExt:',
        '    ' + overflow + ' times the listen queue of a socket overflowed',
        '    ' + dropped + ' SYNs to LISTEN sockets dropped',
        '    ' + Math.max(0, sent) + ' SYN cookies sent',
        '    ' + Math.round(Math.max(0, sent) * 0.0004) + ' SYN cookies received',
        '    0 SYN cookies failed'
      ];
    }
    var rnd = mulberry(host.cmdCount * 104729 + 3);
    var peers = [];
    for (var i = 0; i < 40; i++) peers.push(randIp(rnd) + ':' + (1024 + Math.floor(rnd() * 60000)));
    return [
      'Active Internet connections (servers and established)',
      'Proto Recv-Q Send-Q Local Address           Foreign Address         State',
      'tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN',
      { gen: function (i) { return 'tcp        0      0 203.0.113.10:443        198.51.100.' + (1 + (i % 250)) + ':' + (40000 + i) + '   ESTABLISHED'; }, n: 211 },
      { gen: function (i) { return 'tcp        0      0 203.0.113.10:443        ' + peers[i % peers.length] + '   SYN_RECV'; }, n: m.synrecv },
      { gen: function (i) { return 'tcp        0      0 203.0.113.10:443        198.51.100.' + (1 + (i % 250)) + ':' + (30000 + i) + '   TIME_WAIT'; }, n: 9 }
    ].filter(function (it) { return itemCount(it) > 0; });
  }

  function dmesgLines(host) {
    var m = attackModel(host);
    var out = [
      '[    0.000000] Linux version 5.15.0-91-generic (buildd@lcy02-amd64-045)',
      '[    5.311402] nf_conntrack: default automatic helper assignment has been turned off',
      '[ 8340.002118] nginx[921]: worker process 924 exited with code 0'
    ];
    if (m.full) {
      var verb = m.cookies ? 'Sending cookies.' : 'Dropping request.';
      out.push('[ 8412.113456] TCP: request_sock_TCP: Possible SYN flooding on port 443. ' + verb + '  Check SNMP counters.');
      out.push('[ 8472.481902] TCP: request_sock_TCP: Possible SYN flooding on port 443. ' + verb + '  Check SNMP counters.');
      out.push('[ 8532.907311] TCP: request_sock_TCP: Possible SYN flooding on port 443. ' + verb + '  Check SNMP counters.');
    } else {
      out.push('[ 8412.113456] TCP: request_sock_TCP: Possible SYN flooding on port 443. Sending cookies.  Check SNMP counters.');
    }
    return out;
  }

  function tcpdumpLines(host, args) {
    var cIdx = args.indexOf('-c');
    var n = cIdx >= 0 ? Math.max(1, Math.min(40, parseInt(args[cIdx + 1], 10) || 10)) : 10;
    var filter = args.filter(function (t) { return t[0] !== '-' && !/^\d+$/.test(t) && t !== 'eth0'; }).join(' ');
    var synOnly = /tcp-syn|\bsyn\b/.test(filter) && !/tcp-ack/.test(filter.replace(/tcp-syn\|tcp-ack/g, ''));
    var rnd = mulberry(host.cmdCount * 15485863 + 11);
    var out = [
      'tcpdump: verbose output suppressed, use -v[v]... for full protocol decode',
      'listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes'
    ];
    for (var i = 0; i < n; i++) {
      var usec = 100312 + i * 79 + Math.floor(rnd() * 20);
      var ip = randIp(rnd), port = 1024 + Math.floor(rnd() * 60000);
      var stamp = '02:14:07.' + String(usec).padStart(6, '0');
      var kind = synOnly ? 0 : rnd();
      if (kind < 0.75) out.push(stamp + ' IP ' + ip + '.' + port + ' > 203.0.113.10.443: Flags [S], seq ' + Math.floor(rnd() * 4294967295) + ', win 512, length 0');
      else if (kind < 0.9) out.push(stamp + ' IP 203.0.113.10.443 > ' + ip + '.' + port + ': Flags [S.], seq ' + Math.floor(rnd() * 4294967295) + ', ack 1, win 64240, options [mss 1460], length 0');
      else out.push(stamp + ' IP 198.51.100.' + (1 + Math.floor(rnd() * 250)) + '.' + (40000 + i) + ' > 203.0.113.10.443: Flags [.], ack 1, win 502, length 0');
    }
    out.push('', n + ' packets captured', n + ' packets received by filter', '0 packets dropped by kernel');
    return out;
  }

  function curlLines(host) {
    var m = attackModel(host);
    if (m.refusing) return ['curl: (28) Connection timed out after 5001 milliseconds'];
    if (m.full) return ['HTTP/2 200', 'server: nginx', 'time_connect: 0.92s  (slow: the host is strained but serving)'];
    return ['HTTP/2 200', 'server: nginx', 'time_connect: 0.04s'];
  }

  // ---- iptables ----------------------------------------------------------------
  var IPT_VERSION = 'iptables v1.8.7 (nf_tables)';
  var IPT_TABLES = { filter: ['INPUT', 'FORWARD', 'OUTPUT'], raw: ['PREROUTING', 'OUTPUT'], mangle: ['PREROUTING', 'INPUT', 'FORWARD', 'OUTPUT', 'POSTROUTING'], nat: ['PREROUTING', 'INPUT', 'OUTPUT', 'POSTROUTING'] };
  var IPT_TARGETS = ['ACCEPT', 'DROP', 'REJECT', 'LOG', 'RETURN', 'SYNPROXY', 'CT'];
  var IPT_MODULES = {
    tcp: ['--dport', '--sport', '--tcp-flags', '--syn'],
    limit: ['--limit', '--limit-burst'],
    hashlimit: ['--hashlimit-above', '--hashlimit-upto', '--hashlimit-mode', '--hashlimit-name', '--hashlimit-burst', '--hashlimit-htable-expire', '--hashlimit-srcmask', '--hashlimit-dstmask'],
    connlimit: ['--connlimit-above', '--connlimit-upto', '--connlimit-mask'],
    recent: ['--name', '--set', '--update', '--rcheck', '--seconds', '--hitcount', '--rsource', '--remove'],
    set: ['--match-set'],
    conntrack: ['--ctstate'],
    state: ['--state']
  };
  var IPT_NOARG = { '--syn': 1, '--notrack': 1, '--sack-perm': 1, '--timestamp': 1, '--set': 1, '--update': 1, '--rcheck': 1, '--rsource': 1, '--remove': 1 };
  var IPT_ARGC = { '--match-set': 2 };

  function cmdIptables(host, a) {
    var out = [];
    var args = a.slice(1);
    var table = 'filter', action = null, chain = null, insertAt = null;
    var rule = { table: 'filter', chain: '', mods: [], target: '', syn: false, proto: '', raw: '' };
    var listLike = false, flush = false, S = false;
    var i = 0;
    for (; i < args.length; i++) {
      var t = args[i];
      if (t === '-t') { table = args[++i]; if (!IPT_TABLES[table]) { return [IPT_VERSION + ': can\'t initialize iptables table `' + table + '\': Table does not exist (do you need to insmod?)']; } }
      else if (t === '-A' || t === '-I' || t === '-D') {
        action = t; chain = args[++i];
        if (t === '-I' && /^\d+$/.test(args[i + 1] || '')) insertAt = parseInt(args[++i], 10);
      }
      else if (t === '-L' || t === '--list') { listLike = true; if (args[i + 1] && args[i + 1][0] !== '-') chain = args[++i]; }
      else if (t === '-S') { S = true; if (args[i + 1] && args[i + 1][0] !== '-') chain = args[++i]; }
      else if (t === '-F' || t === '--flush') { flush = true; if (args[i + 1] && args[i + 1][0] !== '-') chain = args[++i]; }
      else if (t === '-n' || t === '-v' || t === '--line-numbers' || t === '-nv' || t === '-vn') { /* display flags */ }
      else if (t === '-p' || t === '--protocol') { rule.proto = (args[++i] || '').toLowerCase(); }
      else if (t === '-s' || t === '-d' || t === '-i' || t === '-o') { rule[t] = args[++i]; }
      else if (t === '-m' || t === '--match') {
        var mod = args[++i];
        if (!IPT_MODULES[mod]) { return [IPT_VERSION + ': Couldn\'t load match `' + mod + '\':No such file or directory', '', 'Try `iptables -h\' or \'iptables --help\' for more information.']; }
        rule.mods.push(mod);
      }
      else if (t === '-j' || t === '--jump' || t === '-g') {
        var tg = args[++i];
        if (IPT_TARGETS.indexOf(tg) < 0) { return [IPT_VERSION + ': Couldn\'t load target `' + tg + '\':No such file or directory', '', 'Try `iptables -h\' or \'iptables --help\' for more information.']; }
        rule.target = tg;
      }
      else if (t === '--syn') {
        if (rule.proto !== 'tcp') return [IPT_VERSION + ': unknown option "--syn"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
        rule.syn = true;
      }
      else if (t === '--tcp-flags') {
        if (rule.proto !== 'tcp') return [IPT_VERSION + ': unknown option "--tcp-flags"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
        var mask = (args[++i] || '').toUpperCase().split(','), set = (args[++i] || '').toUpperCase().split(',');
        if (mask.indexOf('SYN') >= 0 && set.indexOf('SYN') >= 0 && set.indexOf('ACK') < 0) rule.syn = true;
        rule.flags = mask.join(',') + ' ' + set.join(',');
      }
      else if (t === '--dport' || t === '--sport' || t === '--destination-port' || t === '--source-port') {
        if (rule.proto !== 'tcp' && rule.proto !== 'udp') return [IPT_VERSION + ': unknown option "' + t + '"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
        rule.port = args[++i];
      }
      else if (t === '--ctstate' || t === '--state') {
        var mset = (t === '--ctstate' ? 'conntrack' : 'state');
        if (rule.mods.indexOf(mset) < 0) return [IPT_VERSION + ': unknown option "' + t + '"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
        rule.ctstate = (args[++i] || '').toUpperCase();
      }
      else if (t === '--limit') {
        if (rule.mods.indexOf('limit') < 0) return [IPT_VERSION + ': unknown option "--limit"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
        rule.limitRate = parseRate(args[++i]); if (rule.limitRate === null) return [IPT_VERSION + ': Bad rate `' + args[i] + '\''];
      }
      else if (/^--hashlimit-(above|upto)$/.test(t)) {
        if (rule.mods.indexOf('hashlimit') < 0) return [IPT_VERSION + ': unknown option "' + t + '"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
        var hr = parseRate(args[++i]); if (hr === null) return [IPT_VERSION + ': Bad rate `' + args[i] + '\''];
        if (t === '--hashlimit-above') rule.hashAbove = hr; else rule.hashUpto = hr;
      }
      else if (t === '--hashlimit-mode') {
        if (rule.mods.indexOf('hashlimit') < 0) return [IPT_VERSION + ': unknown option "--hashlimit-mode"'];
        rule.hashMode = args[++i];
      }
      else if (t === '--notrack') { if (rule.target !== 'CT') return [IPT_VERSION + ': unknown option "--notrack"']; rule.notrack = true; }
      else if (t === '--sack-perm' || t === '--timestamp') { if (rule.target !== 'SYNPROXY') return [IPT_VERSION + ': unknown option "' + t + '"']; }
      else if (t === '--wscale' || t === '--mss' || t === '--log-prefix' || t === '--reject-with' || t === '--limit-burst' || t === '--hashlimit-name' || t === '--hashlimit-burst' || t === '--connlimit-above' || t === '--connlimit-mask' || t === '--seconds' || t === '--hitcount' || t === '--name' || t === '--hashlimit-htable-expire' || t === '--hashlimit-srcmask' || t === '--hashlimit-dstmask') { i++; }
      else if (t === '--match-set') { i += 2; rule.setName = args[i - 1]; }
      else if (t === '--set' || t === '--update' || t === '--rcheck' || t === '--rsource' || t === '--remove') { /* recent flags */ }
      else if (t === '-P' || t === '-N' || t === '-X' || t === '-Z') { i += 1; }
      else if (t === '-h' || t === '--help') { return ['iptables v1.8.7', 'Usage: iptables -[ACD] chain rule-specification [options]', '       iptables -L [chain] [-n -v]   |   iptables -S   |   iptables -F [chain]']; }
      else { return [IPT_VERSION + ': unknown option "' + t + '"', 'Try `iptables -h\' or \'iptables --help\' for more information.']; }
    }

    if (flush) {
      host.rules = host.rules.filter(function (r) { return !(r.table === table && (!chain || r.chain === chain)); });
      return out;
    }
    if (S || listLike) {
      var rows = host.rules.filter(function (r) { return r.table === table && (!chain || r.chain === chain); });
      if (S) {
        (IPT_TABLES[table] || []).forEach(function (c) { if (!chain || chain === c) out.push('-P ' + c + ' ACCEPT'); });
        rows.forEach(function (r) { out.push('-A ' + r.chain + ' ' + r.raw); });
        return out;
      }
      (IPT_TABLES[table] || []).forEach(function (c) {
        if (chain && chain !== c) return;
        out.push('Chain ' + c + ' (policy ACCEPT)');
        out.push('target     prot opt source               destination');
        rows.filter(function (r) { return r.chain === c; }).forEach(function (r) {
          out.push((r.target + '          ').slice(0, 10) + ' ' + ((r.proto || 'all') + '    ').slice(0, 4) + ' --  ' + (r['-s'] || 'anywhere') + '            ' + (r['-d'] || 'anywhere') + '   ' + r.raw.replace(/-j \S+/, '').replace(/^-p \S+ /, '').trim());
        });
        out.push('');
      });
      return out;
    }
    if (!action) return [IPT_VERSION + ': no command specified', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
    if (!chain || (IPT_TABLES[table] || []).indexOf(chain) < 0) {
      return [IPT_VERSION + ': Chain "' + chain + '" does not exist in table "' + table + '"', 'Try `iptables -h\' or \'iptables --help\' for more information.'];
    }
    if (!rule.target) return [IPT_VERSION + ': Bad target: a rule needs "-j TARGET" here (ACCEPT, DROP, ...)'];
    if (rule.target === 'SYNPROXY' && table !== 'filter') return [IPT_VERSION + ': SYNPROXY is only valid in the filter table (INPUT/FORWARD)'];
    if (rule.target === 'CT' && table !== 'raw') return [IPT_VERSION + ': the CT target is only valid in the raw table'];
    if (rule.mods.indexOf('tcp') >= 0 && rule.proto !== 'tcp') return [IPT_VERSION + ': Couldn\'t load match `tcp\':the "-m tcp" module needs -p tcp'];
    rule.table = table;
    rule.chain = chain;
    rule.raw = args.filter(function (t, k) { return !(t === '-A' || t === '-t' || t === '-I' || (k > 0 && (args[k - 1] === '-A' || args[k - 1] === '-t' || args[k - 1] === '-I'))); }).join(' ');
    if (action === '-D') {
      var before = host.rules.length;
      var idx = -1;
      host.rules.forEach(function (r, k) { if (idx < 0 && r.table === table && r.chain === chain && r.raw === rule.raw) idx = k; });
      if (idx < 0) return [IPT_VERSION + ': Bad rule (does a matching rule exist in that chain?).'];
      host.rules.splice(idx, 1);
      return out;
    }
    if (action === '-I') {
      var pos = 0, seen = 0;
      for (var k = 0; k < host.rules.length; k++) {
        if (host.rules[k].table === table && host.rules[k].chain === chain) { seen++; if (seen === (insertAt || 1)) { pos = k; break; } }
        pos = k + 1;
      }
      host.rules.splice(pos, 0, rule);
    } else {
      host.rules.push(rule);
    }
    return out;
  }

  function cmdNft(host, a, line) {
    var args = a.slice(1);
    if (args[0] === 'list' && args[1] === 'ruleset') {
      var out = ['table inet filter {', '\tchain input {', '\t\ttype filter hook input priority filter; policy accept;'];
      host.rules.filter(function (r) { return r.nft; }).forEach(function (r) { out.push('\t\t' + r.raw); });
      out.push('\t}', '}');
      return out;
    }
    if (args[0] === 'add' && args[1] === 'rule') {
      var fam = args[2], tbl = args[3], ch = args[4];
      if ((fam !== 'inet' && fam !== 'ip') || tbl !== 'filter' || ch !== 'input') {
        return ['Error: No such file or directory', 'add rule ' + args.slice(2).join(' ') + '\n         ^^^^^^^^^^^^^^^^^^'.replace(/\n/g, ' ')];
      }
      var rest = args.slice(5).join(' ');
      var syn = /tcp flags\s+(?:&\s*\S+\s*==\s*)?syn\b/.test(rest) || /tcp flags\s*&\s*syn\s*==\s*syn/.test(rest);
      var over = /limit rate over (\d+)\/(second|minute|hour)/.exec(rest);
      var lim = /limit rate (\d+)\/(second|minute|hour)/.exec(rest);
      var act = /\b(drop|reject|accept)\b/.exec(rest);
      if (!act || !/tcp/.test(rest)) return ['Error: syntax error, unexpected end of file', 'add rule ' + args.slice(2).join(' ')];
      var conv = function (m) { return m ? (m[2] === 'second' ? 1 : (m[2] === 'minute' ? 1 / 60 : 1 / 3600)) * parseInt(m[1], 10) : null; };
      host.rules.push({
        nft: true, table: 'filter', chain: 'INPUT', mods: [], target: act[1].toUpperCase(), action: act[1],
        syn: syn, overRate: over ? conv(over) : null, limitRate: !over && lim ? conv(lim) : null,
        perSource: /saddr/.test(rest) || /meter|ct count/.test(rest), raw: rest
      });
      return [];
    }
    if (args[0] === 'flush') { host.rules = host.rules.filter(function (r) { return !r.nft; }); return []; }
    return ['Error: syntax error, unexpected ' + (args[0] || 'end of file'), 'Supported here: nft list ruleset | nft add rule inet filter input ... | nft flush ruleset'];
  }

  function cmdIpset(host, a) {
    var args = a.slice(1);
    if (args[0] === 'create' && args[1]) { host.ipsets[args[1]] = []; return []; }
    if (args[0] === 'add' && args[1]) {
      if (!host.ipsets[args[1]]) return ['ipset v7.15: The set with the given name does not exist'];
      host.ipsets[args[1]].push(args[2]); return [];
    }
    if (args[0] === 'list') return Object.keys(host.ipsets).map(function (k) { return 'Name: ' + k + ' (' + host.ipsets[k].length + ' entries)'; });
    return ['ipset v7.15: Unknown command'];
  }

  var HELP = [
    'Supported commands (the lab simulates a Linux host; nothing real is changed):',
    '  measure   ss -tan state syn-recv | wc -l      netstat -ant | grep -c SYN_RECV',
    '            ss -s       netstat -s | grep -i listen       dmesg | tail',
    '            tcpdump -nn -c 10 \'tcp[tcpflags] == tcp-syn\'        curl -I --max-time 5 https://shop.example/',
    '  kernel    sysctl <key>      sysctl -w <key>=<value>      sysctl -a | grep syn',
    '            sysctl --system   sysctl -p <file>',
    '            cat /etc/sysctl.d/99-synflood.conf      echo "<line>" >> /etc/sysctl.d/99-synflood.conf',
    '  firewall  iptables -L -n -v      iptables -S      iptables -A INPUT ...      iptables -F',
    '            nft list ruleset       nft add rule inet filter input ...',
    '            ipset create <name> hash:ip     ipset add <name> <address>',
    '  filters   | grep [-i -v -c]     | wc -l     | head -n N     | tail -n N     | tee [-a] <file>',
    '  other     clear   hostname   whoami   uname -a   date',
    'Keys you can tune: ' + SYSCTL_ORDER.join(', ')
  ];

  // ---- stages and pipelines -------------------------------------------------------
  function sourceStage(host, tokens, ctx) {
    var cmd = tokens[0];
    if (cmd === 'sudo') return sourceStage(host, tokens.slice(1), ctx);
    switch (cmd) {
      case 'help': case '?': return HELP.slice();
      case 'clear': ctx.clear = true; return [];
      case 'hostname': return ['web01'];
      case 'whoami': return ['root'];
      case 'id': return ['uid=0(root) gid=0(root) groups=0(root)'];
      case 'date': return ['Tue Oct 13 02:21:44 UTC 2026'];
      case 'uname': return BASE_LINES.slice();
      case 'pwd': return ['/root'];
      case 'uptime': return [' 02:21:44 up 38 days,  3:12,  1 user,  load average: 0.31, 0.42, 0.40'];
      case 'ls': {
        var tgt = tokens.slice(1).filter(function (t) { return t[0] !== '-'; })[0] || '.';
        if (tgt.replace(/\/$/, '') === '/etc/sysctl.d') return Object.keys(host.files).filter(function (f) { return f.indexOf('/etc/sysctl.d/') === 0; }).map(function (f) { return f.split('/').pop(); });
        return tgt === '.' ? [] : ['ls: cannot access \'' + tgt + '\': Not available in this lab'];
      }
      case 'cat': {
        var f = tokens[1];
        if (!f) return [];
        if (f in host.files) return host.files[f] ? host.files[f].replace(/\n$/, '').split('\n') : [];
        var m = /^\/proc\/sys\/(.+)$/.exec(f);
        if (m) { var key = m[1].replace(/\//g, '.'); return key in host.sysctl ? [String(host.sysctl[key])] : ['cat: ' + f + ': No such file or directory']; }
        return ['cat: ' + f + ': No such file or directory'];
      }
      case 'echo': {
        var redirect = null, append = false, words = [];
        for (var i = 1; i < tokens.length; i++) {
          var t = tokens[i];
          if (t === '>>' || t === '>') { redirect = tokens[++i]; append = t === '>>'; }
          else if (t.indexOf('>>') === 0) { redirect = t.slice(2); append = true; }
          else if (t[0] === '>') { redirect = t.slice(1); append = false; }
          else words.push(t);
        }
        var text = words.join(' ');
        if (redirect) { var err = writeFile(host, redirect, text, append); return err ? [err] : []; }
        return [text];
      }
      case 'sysctl': return cmdSysctl(host, tokens);
      case 'ss': host.ran.count = host.ran.count || tokens.some(function (t) { return /syn-recv|syn_recv/i.test(t); }); return ssLines(host, tokens.slice(1));
      case 'netstat': {
        var items = netstatLines(host, tokens.slice(1));
        if (tokens.indexOf('-s') < 0 && !tokens.some(function (t) { return /^-[a-z]*s$/.test(t); })) { /* counted when it is filtered for SYN_RECV */ ctx.netstatTable = true; }
        return items;
      }
      case 'dmesg': host.ran.klog = true; return dmesgLines(host);
      case 'journalctl': if (tokens.some(function (t) { return t === '-k' || t === '--dmesg'; })) { host.ran.klog = true; return dmesgLines(host); } return ['-- No entries --'];
      case 'tcpdump': host.ran.capture = true; return tcpdumpLines(host, tokens.slice(1));
      case 'curl': return curlLines(host);
      case 'iptables': case 'ip6tables': return cmdIptables(host, tokens);
      case 'nft': return cmdNft(host, tokens);
      case 'ipset': return cmdIpset(host, tokens);
      case 'awk': case 'sed': case 'sort': case 'uniq': case 'cut': case 'top': case 'htop': case 'ping':
        return [cmd + ': not available in this lab shell. Try grep, wc, head or tail.'];
      default:
        return ['bash: ' + cmd + ': command not found. Type "help" to see what this lab supports.'];
    }
  }

  function filterStage(host, tokens, input) {
    var cmd = tokens[0];
    if (cmd === 'grep') {
      var flags = tokens.slice(1).filter(function (t) { return /^-[a-zA-Z]+$/.test(t); }).join('');
      var rest = tokens.slice(1).filter(function (t) { return !/^-[a-zA-Z]+$/.test(t); });
      var pat = rest[0];
      if (pat === undefined) return { err: 'Usage: grep [OPTION]... PATTERNS' };
      var ci = /i/.test(flags), inv = /v/.test(flags), cnt = /c/.test(flags), ext = /E/.test(flags);
      var re;
      try { re = new RegExp(ext ? pat : pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), ci ? 'i' : ''); } catch (e) { return { err: 'grep: Invalid regular expression' }; }
      var kept = [];
      input.forEach(function (it) {
        var n = itemCount(it);
        var hit = re.test(itemText(it, 0));
        if (typeof it !== 'string' && n > 1) { if (hit !== inv) kept.push(it); }   // a group is homogeneous
        else if (hit !== inv) kept.push(it);
      });
      return { items: cnt ? [String(totalLines(kept))] : kept };
    }
    if (cmd === 'wc') {
      if (tokens.indexOf('-l') < 0) return { err: 'wc: only "wc -l" is supported in this lab' };
      return { items: [String(totalLines(input))] };
    }
    if (cmd === 'head' || cmd === 'tail') {
      var k = 10;
      for (var i = 1; i < tokens.length; i++) {
        if (tokens[i] === '-n') k = parseInt(tokens[i + 1], 10) || 10;
        else if (/^-\d+$/.test(tokens[i])) k = parseInt(tokens[i].slice(1), 10);
      }
      return { items: cmd === 'head' ? takeHead(input, k) : takeTail(input, k) };
    }
    if (cmd === 'tee') {
      var app = tokens.indexOf('-a') >= 0;
      var file = tokens.filter(function (t, j) { return j > 0 && t[0] !== '-'; })[0];
      var lines = [];
      input.forEach(function (it) { for (var j = 0; j < Math.min(itemCount(it), 50); j++) lines.push(itemText(it, j)); });
      if (file) {
        var allowed = file === '/etc/sysctl.conf' || /^\/etc\/sysctl\.d\/[A-Za-z0-9._-]+\.conf$/.test(file);
        if (!allowed) return { err: 'tee: ' + file + ': Read-only in this lab (use /etc/sysctl.d/99-synflood.conf)' };
        lines.forEach(function (l, j) { writeFile(host, file, l, app || j > 0); });
      }
      return { items: input };
    }
    return { err: 'bash: ' + cmd + ': pipelines in this lab support grep, wc -l, head, tail and tee' };
  }

  // Runs one command line. Returns { lines: [display strings], clear: bool }.
  function run(host, line) {
    host.cmdCount++;
    var raw = String(line || '').trim();
    if (!raw) return { lines: [], clear: false };
    var stages = splitPipes(raw);
    if (!stages) return { lines: ['bash: unexpected EOF while looking for matching quote'], clear: false };
    var ctx = { clear: false };
    var items = null;
    for (var s = 0; s < stages.length; s++) {
      var toks = tokenize(stages[s]);
      if (!toks.length) return { lines: ['bash: syntax error near unexpected token `|\''], clear: false };
      if (s === 0) {
        items = sourceStage(host, toks, ctx);
        if (ctx.netstatTable && stages.length > 1 && stages.slice(1).some(function (st) { return /SYN_RECV/.test(st); })) host.ran.count = true;
      } else {
        var r = filterStage(host, toks, items);
        if (r.err) return { lines: [r.err], clear: false };
        items = r.items;
      }
    }
    var out = [];
    items.forEach(function (it) {
      if (typeof it === 'string') { out.push(it); return; }
      var show = Math.min(it.n, 6);
      for (var i = 0; i < show; i++) out.push(it.gen(i));
      if (it.n > show) out.push('... (' + (it.n - show) + ' more lines like these not shown)');
    });
    return { lines: out, clear: ctx.clear };
  }

  // ---- shell test hooks and the public pure API ----------------------------------------
  var shell = {
    createHost: createHost,
    run: run,
    evaluate: evaluate,
    attackModel: attackModel,
    parseConf: parseConf
  };

  // =========================================================================
  // 2. WORKSHOP UI
  // =========================================================================
  var W;                                  // Lab.Content.workshop
  var root = null;
  var opts = {};
  var host = null;
  var done = {};                          // module id -> true
  var tasksDone = {};                     // harden task id -> true
  var testEngine = null;
  var offTerminal = null;
  var testRunning = false;
  var finishedFired = false;
  var currentTab = 'understand';
  var incidentState = null;
  var scores = { incidentFirstTry: 0, incidentTotal: 0, layersFirstTry: 0, layersTotal: 0 };

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function $(id) { return document.getElementById(id); }

  function inline(parent, text) {
    var re = /(\*\*[^*]+\*\*|`[^`]+`)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var tok = m[0];
      if (tok[0] === '*') parent.appendChild(el('strong', null, tok.slice(2, -2)));
      else parent.appendChild(el('code', null, tok.slice(1, -1)));
      last = m.index + tok.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
    return parent;
  }

  function renderBlocks(container, blocks) {
    blocks.forEach(function (b) {
      var n;
      if (b.t === 'h') n = el('h4', 'ws-h', b.x);
      else if (b.t === 'p') n = inline(el('p'), b.x);
      else if (b.t === 'ul' || b.t === 'ol') { n = el(b.t, 'ws-list'); b.items.forEach(function (it) { n.appendChild(inline(el('li'), it)); }); }
      else if (b.t === 'code') { n = el('pre', 'ws-code'); n.appendChild(el('code', null, b.x)); n.tabIndex = 0; }
      else if (b.t === 'note') { n = el('aside', 'ws-note'); n.appendChild(el('strong', 'ws-note__title', b.title)); n.appendChild(inline(el('p'), b.x)); }
      else if (b.t === 'table') {
        var wrap = el('div', 'ws-table-wrap'); wrap.tabIndex = 0;
        var tb = el('table', 'ws-table');
        var thead = el('thead'), hr = el('tr');
        b.head.forEach(function (h) { var th = el('th', null, h); th.scope = 'col'; hr.appendChild(th); });
        thead.appendChild(hr); tb.appendChild(thead);
        var tbody = el('tbody');
        b.rows.forEach(function (r) { var tr = el('tr'); r.forEach(function (c, ci) { var td = el(ci === 0 ? 'th' : 'td'); if (ci === 0) td.scope = 'row'; inline(td, c); tr.appendChild(td); }); tbody.appendChild(tr); });
        tb.appendChild(tbody); wrap.appendChild(tb); n = wrap;
      }
      if (n) container.appendChild(n);
    });
  }

  // ---- multiple-choice questions ----------------------------------------------------------
  function renderQuestions(container, questions, onAllDone, tally) {
    var solved = 0;
    questions.forEach(function (q, qi) {
      var card = el('fieldset', 'ws-q');
      var legend = el('legend', null, (qi + 1) + '. ' + q.question);
      card.appendChild(legend);
      var group = el('div', 'ws-q__options');
      group.setAttribute('role', 'group');
      var fb = el('div', 'ws-feedback');
      fb.setAttribute('role', 'status');
      var wrongTries = 0;
      var opts_ = [];
      q.options.forEach(function (text, i) {
        var b = el('button', 'quiz-option');
        b.type = 'button';
        b.appendChild(el('span', 'quiz-option__key', String.fromCharCode(65 + i))).setAttribute('aria-hidden', 'true');
        b.appendChild(el('span', 'quiz-option__text', text));
        b.addEventListener('click', function () {
          if (i === q.answer) {
            b.classList.add('is-correct');
            opts_.forEach(function (o) { o.disabled = true; });
            fb.textContent = '';
            fb.className = 'ws-feedback is-good';
            fb.appendChild(el('strong', null, 'Correct. '));
            fb.appendChild(document.createTextNode(q.explanation));
            if (tally && wrongTries === 0) tally.first++;
            solved++;
            if (solved === questions.length) onAllDone();
          } else {
            wrongTries++;
            b.classList.add('is-wrong');
            b.disabled = true;
            fb.className = 'ws-feedback is-bad';
            fb.textContent = 'Not quite. Re-read the evidence and try another option.';
          }
        });
        opts_.push(b);
        group.appendChild(b);
      });
      card.appendChild(group);
      card.appendChild(fb);
      container.appendChild(card);
    });
  }

  // ---- module panels ------------------------------------------------------------------------
  function panelUnderstand(p) {
    var U = W.understand;
    renderBlocks(p, U.blocks);

    var calc = el('div', 'ws-calc');
    calc.appendChild(el('h4', 'ws-h', U.calculator.title));
    calc.appendChild(inline(el('p'), U.calculator.text));
    var row = el('div', 'ws-calc__row');
    var label = el('label', null, 'tcp_synack_retries = ');
    label.htmlFor = 'ws-calc-input';
    var input = el('input', 'field');
    input.type = 'number'; input.id = 'ws-calc-input'; input.min = '0'; input.max = '10'; input.inputMode = 'numeric';
    var btn = el('button', 'btn btn--primary', 'Check');
    btn.type = 'button'; btn.id = 'ws-calc-check';
    row.appendChild(label); row.appendChild(input); row.appendChild(btn);
    calc.appendChild(row);
    var fb = el('div', 'ws-feedback'); fb.setAttribute('role', 'status'); fb.id = 'ws-calc-feedback';
    calc.appendChild(fb);
    p.appendChild(calc);

    var calcOk = false, cpOk = false;
    function maybe() { if (calcOk && cpOk) markDone('understand'); }
    btn.addEventListener('click', function () {
      var v = parseInt(input.value, 10);
      fb.textContent = '';
      if (v === U.calculator.answer) {
        calcOk = true; fb.className = 'ws-feedback is-good';
        fb.appendChild(el('strong', null, 'Correct. ')); fb.appendChild(document.createTextNode(U.calculator.success + ' '));
        fb.appendChild(document.createTextNode(U.calculator.caveat));
        maybe();
      } else if (isNaN(v)) { fb.className = 'ws-feedback is-bad'; fb.textContent = 'Enter a whole number.'; }
      else {
        var life = Math.pow(2, v + 1) - 1;
        fb.className = 'ws-feedback is-bad';
        fb.textContent = 'With ' + v + ' retries an entry lives ' + life + ' s, so the queue wants ' + (U.calculator.rate * life).toLocaleString('en-US') + ' entries (backlog ' + U.calculator.backlog.toLocaleString('en-US') + '). ' + U.calculator.failure;
      }
    });

    p.appendChild(el('h4', 'ws-h', 'Checkpoint questions'));
    var qs = el('div', 'ws-qs');
    renderQuestions(qs, U.checkpoints, function () { cpOk = true; maybe(); });
    p.appendChild(qs);
  }

  function panelInvestigate(p) {
    var I = W.investigate;
    p.appendChild(inline(el('p'), I.brief));
    var ev = el('div', 'ws-evidence');
    I.evidence.forEach(function (e) {
      var card = el('figure', 'ws-evidence__card');
      card.appendChild(el('figcaption', null, e.title));
      var pre = el('pre', 'ws-code'); pre.tabIndex = 0;
      pre.appendChild(el('code', null, e.lines.join('\n')));
      card.appendChild(pre);
      ev.appendChild(card);
    });
    p.appendChild(ev);
    p.appendChild(el('h4', 'ws-h', 'Your diagnosis'));
    var qs = el('div', 'ws-qs');
    renderQuestions(qs, I.questions, function () { markDone('investigate'); });
    p.appendChild(qs);
  }

  function panelLayers(p) {
    var L = W.layers;
    p.appendChild(inline(el('p'), L.brief));
    var grid = el('div', 'ws-layers');
    L.layers.forEach(function (l, i) {
      var c = el('div', 'ws-layer');
      c.appendChild(el('span', 'ws-layer__num', String(i + 1)));
      c.appendChild(el('strong', null, l.name));
      c.appendChild(el('p', null, l.text));
      grid.appendChild(c);
    });
    p.appendChild(grid);
    p.appendChild(el('h4', 'ws-h', 'Match each situation to the best layer'));
    var solved = 0;
    L.exercises.forEach(function (ex, idx) {
      var card = el('div', 'ws-q ws-match');
      var id = 'ws-match-' + ex.id;
      var lab = el('label', 'ws-match__text'); lab.htmlFor = id;
      lab.textContent = (idx + 1) + '. ' + ex.situation;
      var sel = el('select', 'field'); sel.id = id;
      var ph = el('option', null, 'Choose a layer...'); ph.value = ''; sel.appendChild(ph);
      L.layers.forEach(function (l) { var o = el('option', null, l.name); o.value = l.id; sel.appendChild(o); });
      var fb = el('div', 'ws-feedback'); fb.setAttribute('role', 'status');
      var wrong = 0, locked = false;
      sel.addEventListener('change', function () {
        if (locked || !sel.value) return;
        if (sel.value === ex.answer) {
          locked = true; sel.disabled = true;
          fb.className = 'ws-feedback is-good'; fb.textContent = '';
          fb.appendChild(el('strong', null, 'Correct. ')); fb.appendChild(document.createTextNode(ex.explanation));
          scores.layersTotal++; if (wrong === 0) scores.layersFirstTry++;
          solved++;
          if (solved === L.exercises.length) {
            var closing = inline(el('p', 'ws-closing'), L.closing);
            p.appendChild(closing);
            markDone('layers');
          }
        } else {
          wrong++;
          fb.className = 'ws-feedback is-bad';
          fb.textContent = 'Not the best fit. Think about where the bottleneck is and who has the capacity to fix it.';
        }
      });
      card.appendChild(lab); card.appendChild(sel); card.appendChild(fb);
      p.appendChild(card);
    });
  }

  function panelIncident(p) {
    var N = W.incident;
    p.appendChild(inline(el('p'), N.brief));
    var stage = el('div', 'ws-incident'); stage.id = 'ws-incident';
    p.appendChild(stage);
    incidentState = { i: 0, first: 0, wrong: 0 };
    renderIncidentStep(stage);
  }

  function renderIncidentStep(stage) {
    var N = W.incident, st = incidentState;
    stage.textContent = '';
    if (st.i >= N.steps.length) {
      var res = el('div', 'ws-incident__result');
      res.appendChild(el('h4', 'ws-h', 'Incident closed'));
      res.appendChild(el('p', null, 'First-try decisions: ' + st.first + ' of ' + N.steps.length + '.'));
      res.appendChild(inline(el('p'), N.debrief));
      stage.appendChild(res);
      scores.incidentFirstTry = st.first; scores.incidentTotal = N.steps.length;
      markDone('incident');
      return;
    }
    var s = N.steps[st.i];
    var card = el('div', 'ws-incident__card');
    card.appendChild(el('p', 'ws-incident__meta', 'Decision ' + (st.i + 1) + ' of ' + N.steps.length + ' — ' + s.title));
    card.appendChild(el('p', 'ws-incident__situation', s.situation));
    var group = el('div', 'ws-q__options'); group.setAttribute('role', 'group');
    var fb = el('div', 'ws-feedback'); fb.setAttribute('role', 'status');
    var next = el('button', 'btn btn--primary', st.i === N.steps.length - 1 ? 'Close the incident' : 'Next decision');
    next.type = 'button'; next.hidden = true; next.id = 'ws-incident-next';
    var wrong = 0, opts_ = [];
    s.options.forEach(function (o, i) {
      var b = el('button', 'quiz-option'); b.type = 'button';
      b.appendChild(el('span', 'quiz-option__key', String.fromCharCode(65 + i))).setAttribute('aria-hidden', 'true');
      b.appendChild(el('span', 'quiz-option__text', o.text));
      b.addEventListener('click', function () {
        fb.textContent = '';
        if (o.good) {
          b.classList.add('is-correct'); opts_.forEach(function (x) { x.disabled = true; });
          fb.className = 'ws-feedback is-good'; fb.appendChild(el('strong', null, 'Good call. ')); fb.appendChild(document.createTextNode(o.why));
          if (wrong === 0) st.first++;
          next.hidden = false; next.focus();
        } else {
          wrong++; b.classList.add('is-wrong'); b.disabled = true;
          fb.className = 'ws-feedback is-bad'; fb.appendChild(el('strong', null, 'Weak choice. ')); fb.appendChild(document.createTextNode(o.why));
        }
      });
      opts_.push(b); group.appendChild(b);
    });
    next.addEventListener('click', function () { st.i++; renderIncidentStep(stage); var h = stage.querySelector('.ws-incident__meta, .ws-h'); if (h) { h.tabIndex = -1; h.focus(); } });
    card.appendChild(group); card.appendChild(fb); card.appendChild(next);
    stage.appendChild(card);
  }

  // ---- terminal + hardening -------------------------------------------------------------------
  function panelHarden(p) {
    var H = W.harden;
    p.appendChild(el('div', 'ws-story', W.scenario.story));
    p.appendChild(inline(el('p'), H.brief));

    var lay = el('div', 'ws-harden');
    var opener = el('div', 'ws-opener');
    opener.appendChild(el('p', null, 'The terminal is a pop-up panel that is available throughout the lab. Open it, type real commands, and the checklist below ticks itself.'));
    var ob = el('button', 'btn btn--primary', 'Open the terminal'); ob.type = 'button'; ob.id = 'btn-ws-open-terminal';
    ob.addEventListener('click', function () { Lab.Terminal.open(true); });
    opener.appendChild(ob);
    lay.appendChild(opener);

    // checklist
    var side = el('div', 'ws-side');
    side.appendChild(el('h4', 'ws-h', 'Your checklist'));
    var list = el('ol', 'ws-tasks'); list.id = 'ws-tasks';
    H.tasks.forEach(function (t) {
      var li = el('li', 'ws-task'); li.id = 'ws-task-' + t.id; li.setAttribute('data-done', 'false');
      var head = el('div', 'ws-task__head');
      head.appendChild(el('span', 'ws-task__tick', ''));
      var title = el('span', 'ws-task__title', t.title); head.appendChild(title);
      head.appendChild(el('span', 'ws-task__tag' + (t.required ? '' : ' is-optional'), t.required ? 'Required' : 'Optional'));
      li.appendChild(head);
      li.appendChild(inline(el('p', 'ws-task__why'), t.why));
      var hb = el('button', 'btn btn--ghost btn--sm', 'Show hint'); hb.type = 'button';
      var hint = el('pre', 'ws-hint'); hint.hidden = true; hint.appendChild(el('code', null, t.hint));
      hb.addEventListener('click', function () { hint.hidden = !hint.hidden; hb.textContent = hint.hidden ? 'Show hint' : 'Hide hint'; });
      li.appendChild(hb); li.appendChild(hint);
      list.appendChild(li);
    });
    side.appendChild(list);
    lay.appendChild(side);
    p.appendChild(lay);

    // test
    var test = el('div', 'ws-test');
    test.appendChild(el('h4', 'ws-h', 'Test your hardening'));
    test.appendChild(el('p', null, 'This replays your attack from Part 1 against web01 twice: first as it was before you touched it, then with the configuration you built in the terminal.'));
    var trow = el('div', 'ws-test__row');
    var tb = el('button', 'btn btn--primary', 'Test the hardened server'); tb.type = 'button'; tb.id = 'btn-ws-test';
    var tl = el('span', 'ws-test__status', ''); tl.id = 'ws-test-status'; tl.setAttribute('role', 'status');
    trow.appendChild(tb); trow.appendChild(tl);
    test.appendChild(trow);
    var res = el('div', 'ws-result'); res.id = 'ws-test-result'; res.hidden = true;
    test.appendChild(res);
    p.appendChild(test);

    renderBlocks(p, H.reference);

    // wiring
    tb.addEventListener('click', runHardeningTest);
    updateTasks();
  }

  function taskChecks() {
    var ev = evaluate(host), s = ev.status;
    var conf = parseConf(host.files['/etc/sysctl.d/99-synflood.conf']);
    var confCookies = conf['net.ipv4.tcp_syncookies'], confRetries = conf['net.ipv4.tcp_synack_retries'];
    return {
      count: host.ran.count,
      klog: host.ran.klog,
      capture: host.ran.capture,
      cookies: s.cookies >= 1,
      retries: s.retries >= 1 && s.retries <= 3,
      backlog: s.backlog >= 2048 && s.somaxconn >= 2048,
      ratelimit: !!s.globalLimit && !s.lowLimit,
      persist: confCookies >= 1 && confRetries >= 1 && confRetries <= 3 && host.loadedVersion === host.fileVersion,
      synproxy: s.synproxyActive
    };
  }

  function updateTasks() {
    if (!host || !$('ws-tasks')) return;
    var chk = taskChecks();
    W.harden.tasks.forEach(function (t) {
      if (chk[t.id]) tasksDone[t.id] = true;
      var li = $('ws-task-' + t.id);
      if (li) {
        li.setAttribute('data-done', tasksDone[t.id] ? 'true' : 'false');
        var tick = li.querySelector('.ws-task__tick');
        if (tick) tick.textContent = tasksDone[t.id] ? '✓' : '';
      }
    });
    checkHardenDone();
  }

  function requiredTasksDone() {
    return W.harden.tasks.every(function (t) { return !t.required || tasksDone[t.id]; });
  }

  function checkHardenDone() {
    if (requiredTasksDone() && host.lastTest && host.lastTest.pass) markDone('harden');
  }

  function simulate(defences, level, cb) {
    var e = Lab.Engine.create({ tickMs: 8 });
    testEngine = e;
    e.setMitigation(defences);
    e.on('runEnded', function (summary) {
      var h = e.getState().history.filter(function (x) { return x.t >= 10; });
      var steady = h.length ? h.reduce(function (a, x) { return a + x.availability; }, 0) / h.length : 0;
      testEngine = null;
      cb({ steady: Math.round(steady * 10) / 10, state: summary.finalServerState, peakCpu: summary.peakCpu, avgResponseTimeMs: summary.avgResponseTimeMs, stoppedEarly: !!summary.stoppedEarly });
    });
    e.runAttack(level);
  }

  function runHardeningTest() {
    if (testRunning) return;
    var level = (opts.getLevel && opts.getLevel()) || 'medium';
    host.level = level;
    var ev = evaluate(host);
    var none = { synCookies: false, rateLimit: false, shortTimeout: false, firewall: false };
    testRunning = true;
    $('btn-ws-test').disabled = true;
    $('ws-test-status').textContent = 'Replaying the ' + level + ' attack against web01...';
    simulate(none, level, function (before) {
      if (before.stoppedEarly) return;
      simulate(ev.defences, level, function (after) {
        if (after.stoppedEarly) return;
        testRunning = false;
        $('btn-ws-test').disabled = false;
        $('ws-test-status').textContent = 'Test finished.';
        var okState = after.state === 'Healthy' || after.state === 'Under Pressure';
        var pass = !ev.blocksCustomers && after.steady >= 95 && okState;
        host.lastTest = { level: level, before: before, after: after, pass: pass, excellent: pass && after.state === 'Healthy', defences: ev.defences };
        showTestResult(ev);
        checkHardenDone();
      });
    });
  }

  function showTestResult(ev) {
    var box = $('ws-test-result'), R = W.harden.results, t = host.lastTest;
    box.hidden = false; box.textContent = '';
    box.className = 'ws-result ' + (t.pass ? (t.excellent ? 'is-excellent' : 'is-pass') : 'is-fail');
    var title = t.pass ? (t.excellent ? 'Excellent: the server is Healthy' : 'Pass: customers are served') : 'Not yet';
    box.appendChild(el('h4', 'ws-result__title', title));
    box.appendChild(el('p', null, t.pass ? (t.excellent ? R.pass : R.weak) : (ev.blocksCustomers ? 'Your SYN limit is blocking genuine customers. ' + R.fail : R.fail)));
    var tb = el('table', 'ws-table ws-result__table');
    var head = el('thead'), hr = el('tr');
    ['', 'Before (as found)', 'After (your config)'].forEach(function (h) { var th = el('th', null, h); th.scope = 'col'; hr.appendChild(th); });
    head.appendChild(hr); tb.appendChild(head);
    var body = el('tbody');
    [['Level of attack', t.level, t.level],
     ['Customer availability', t.before.steady + '%', t.after.steady + '%'],
     ['Server state', t.before.state, t.after.state],
     ['Peak CPU', Math.round(t.before.peakCpu) + '%', Math.round(t.after.peakCpu) + '%'],
     ['Average response time', Math.round(t.before.avgResponseTimeMs) + ' ms', Math.round(t.after.avgResponseTimeMs) + ' ms']].forEach(function (r) {
      var tr = el('tr'); r.forEach(function (c, i) { var cell = el(i === 0 ? 'th' : 'td', null, c); if (i === 0) cell.scope = 'row'; tr.appendChild(cell); }); body.appendChild(tr);
    });
    tb.appendChild(body);
    var wrap = el('div', 'ws-table-wrap'); wrap.tabIndex = 0; wrap.appendChild(tb);
    box.appendChild(wrap);
    box.appendChild(el('h5', 'ws-h', 'What your configuration did'));
    var ul = el('ul', 'ws-notes');
    ev.notes.forEach(function (n) { var li = el('li', 'ws-notes__' + n.level); li.appendChild(el('span', 'ws-notes__icon', { good: '✓', warn: '!', bad: '✗', info: 'i' }[n.level])); li.appendChild(document.createTextNode(' ' + n.text)); ul.appendChild(li); });
    box.appendChild(ul);
    var pend = W.harden.tasks.filter(function (x) { return x.required && !tasksDone[x.id]; });
    if (t.pass && pend.length) box.appendChild(el('p', 'ws-result__pending', 'The test passed, but these required checklist items are still open: ' + pend.map(function (x) { return x.title; }).join('; ') + '.'));
  }

  // ---- tabs and progress --------------------------------------------------------------------------
  function markDone(id) {
    if (done[id]) return;
    done[id] = true;
    updateTabs();
  }

  function allDone() { return W.modules.every(function (m) { return done[m.id]; }); }

  function updateTabs() {
    if (!root) return;
    var n = 0;
    W.modules.forEach(function (m) {
      var tab = $('ws-tab-' + m.id);
      if (!tab) return;
      var ok = !!done[m.id];
      if (ok) n++;
      tab.setAttribute('data-done', ok ? 'true' : 'false');
      var tick = tab.querySelector('.ws-tab__tick');
      if (tick) tick.textContent = ok ? '✓' : '';
    });
    var prog = $('workshop-progress');
    if (prog) prog.textContent = n + ' of ' + W.modules.length + ' modules complete';
    var bar = document.querySelector('#workshop-progress-bar');
    if (bar) bar.style.width = (n / W.modules.length * 100) + '%';
    var fin = $('workshop-finish');
    if (fin) {
      fin.hidden = !allDone();
      if (allDone() && !fin.getAttribute('data-announced')) {
        fin.setAttribute('data-announced', '1');
        var live = $('workshop-live'); if (live) live.textContent = W.completion.title + '. You can continue to the quiz.';
      }
    }
  }

  function selectTab(id, focus) {
    currentTab = id;
    W.modules.forEach(function (m) {
      var tab = $('ws-tab-' + m.id), panel = $('ws-panel-' + m.id);
      var on = m.id === id;
      if (tab) { tab.setAttribute('aria-selected', on ? 'true' : 'false'); tab.tabIndex = on ? 0 : -1; }
      if (panel) panel.hidden = !on;
    });
    if (id === 'harden' && Lab.Terminal && root && root.offsetParent !== null) Lab.Terminal.open(false);
    if (focus && $('ws-tab-' + id)) $('ws-tab-' + id).focus();
  }

  function build() {
    root.textContent = '';
    var intro = el('p', 'ws-intro'); intro.id = 'workshop-intro'; intro.textContent = W.intro;
    root.appendChild(intro);

    var prog = el('div', 'ws-progress');
    var label = el('span', 'ws-progress__label', ''); label.id = 'workshop-progress';
    var track = el('div', 'progress'); track.setAttribute('aria-hidden', 'true');
    var barEl = el('div', 'progress__bar'); barEl.id = 'workshop-progress-bar'; track.appendChild(barEl);
    prog.appendChild(label); prog.appendChild(track);
    root.appendChild(prog);

    var tabs = el('div', 'ws-tabs'); tabs.setAttribute('role', 'tablist'); tabs.id = 'workshop-tabs'; tabs.setAttribute('aria-label', 'Workshop modules');
    var panels = el('div', 'ws-panels'); panels.id = 'workshop-panels';
    W.modules.forEach(function (m, idx) {
      var tab = el('button', 'ws-tab'); tab.type = 'button'; tab.id = 'ws-tab-' + m.id;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', 'ws-panel-' + m.id); tab.setAttribute('aria-selected', 'false'); tab.tabIndex = -1;
      tab.appendChild(el('span', 'ws-tab__num', String(idx + 1)));
      var txt = el('span', 'ws-tab__text'); txt.appendChild(el('strong', null, m.title)); txt.appendChild(el('small', null, m.blurb)); tab.appendChild(txt);
      tab.appendChild(el('span', 'ws-tab__tick', ''));
      tab.addEventListener('click', function () { selectTab(m.id, false); });
      tab.addEventListener('keydown', function (e) {
        var k = W.modules.findIndex(function (x) { return x.id === m.id; }), nx = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nx = (k + 1) % W.modules.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nx = (k - 1 + W.modules.length) % W.modules.length;
        else if (e.key === 'Home') nx = 0; else if (e.key === 'End') nx = W.modules.length - 1;
        if (nx >= 0) { e.preventDefault(); selectTab(W.modules[nx].id, true); }
      });
      tabs.appendChild(tab);

      var panel = el('div', 'ws-panel'); panel.id = 'ws-panel-' + m.id; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'ws-tab-' + m.id); panel.hidden = true;
      panel.tabIndex = -1;
      panels.appendChild(panel);
    });
    root.appendChild(tabs);
    root.appendChild(panels);

    panelUnderstand($('ws-panel-understand'));
    panelInvestigate($('ws-panel-investigate'));
    panelHarden($('ws-panel-harden'));
    panelLayers($('ws-panel-layers'));
    panelIncident($('ws-panel-incident'));

    var foot = el('div', 'ws-foot');
    var live = el('p', 'ws-live'); live.id = 'workshop-live'; live.setAttribute('role', 'status');
    var fin = el('button', 'btn btn--primary', 'Finish the workshop and continue to the quiz'); fin.type = 'button'; fin.id = 'workshop-finish'; fin.hidden = true;
    fin.addEventListener('click', function () {
      if (!allDone() || finishedFired) return;
      finishedFired = true;
      if (typeof opts.onFinished === 'function') opts.onFinished(Lab.Workshop.getSummary());
    });
    foot.appendChild(live); foot.appendChild(fin);
    root.appendChild(foot);

    selectTab(currentTab, false);
    updateTabs();
  }

  Lab.Workshop = {
    shell: shell,
    renderBlocks: renderBlocks,

    init: function (rootEl, options) {
      W = Lab.Content.workshop;
      root = rootEl;
      opts = options || {};
      host = Lab.Terminal.getHost();
      if (offTerminal) offTerminal();
      offTerminal = Lab.Terminal.on(function () { updateTasks(); });
      done = {}; tasksDone = {}; finishedFired = false; testRunning = false;
      scores = { incidentFirstTry: 0, incidentTotal: 0, layersFirstTry: 0, layersTotal: 0 };
      currentTab = 'understand';
      if (root) build();
    },

    reset: function () {
      if (testEngine) { testEngine.stop(); testEngine = null; }
      if (!root) return;
      Lab.Workshop.init(root, opts);
    },

    isComplete: function () { return !!(W && allDone()); },
    getHost: function () { return host; },

    getSummary: function () {
      var t = host && host.lastTest;
      return {
        hardening: t ? { level: t.level, before: t.before.steady, after: t.after.steady, state: t.after.state, pass: t.pass, excellent: t.excellent } : null,
        incident: { firstTry: scores.incidentFirstTry, total: scores.incidentTotal },
        layers: { firstTry: scores.layersFirstTry, total: scores.layersTotal },
        modulesDone: Object.keys(done).length
      };
    },

    // test hook: finish every module without clicking (used only by tests/e2e)
    _completeAllForTests: function (callback) {
      ['understand', 'investigate', 'layers', 'incident'].forEach(markDone);
      var cmds = [
        'ss -tan state syn-recv | wc -l', 'dmesg | tail', "tcpdump -nn -c 5 'tcp[tcpflags] == tcp-syn'",
        'sysctl -w net.ipv4.tcp_syncookies=1', 'sysctl -w net.ipv4.tcp_synack_retries=2',
        'iptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT',
        'iptables -A INPUT -p tcp --syn --dport 443 -j DROP',
        'echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-synflood.conf',
        'echo "net.ipv4.tcp_synack_retries = 2" >> /etc/sysctl.d/99-synflood.conf',
        'sysctl --system'
      ];
      cmds.forEach(function (c) { run(host, c); });
      updateTasks();
      if (callback) callback();
    }
  };
})(window.Lab);
