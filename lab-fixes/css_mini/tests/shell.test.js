/* Simulated-shell tests (plain Node, no libraries): node tests/shell.test.js
   Loads js/content.js, js/workshop-content.js and js/workshop.js in a vm (no DOM) and drives
   Lab.Workshop.shell the way a student would type. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const win = { console, setInterval, clearInterval, setTimeout, clearTimeout };
win.window = win;
const ctx = vm.createContext(win);
['content.js', 'workshop-content.js', 'icons.js', 'engine.js', 'workshop.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
});
const sh = win.Lab.Workshop.shell;
const W = win.Lab.Content.workshop;

let failed = 0, total = 0;
function check(ok, msg) { total++; if (!ok) { failed++; console.log('  FAIL  ' + msg); } else console.log('  ok    ' + msg); }
const out = (h, c) => sh.run(h, c).lines.join('\n');

// ---- reading and measuring
let h = sh.createHost();
check(/net\.ipv4\.tcp_syncookies = 0/.test(out(h, 'sysctl net.ipv4.tcp_syncookies')), 'sysctl reads a key');
check(/cannot stat/.test(out(h, 'sysctl net.ipv4.nope')), 'sysctl reports an unknown key');
check(out(h, 'ss -tan state syn-recv | wc -l') === '257', 'ss | wc -l counts the header plus 256 half-open entries (' + out(h, 'ss -tan state syn-recv | wc -l') + ')');
check(out(h, 'ss -Htan state syn-recv | wc -l') === '256', 'ss -H | wc -l counts 256');
check(out(h, 'netstat -ant | grep -c SYN_RECV') === '256', 'netstat | grep -c SYN_RECV counts 256');
check(h.ran.count, 'counting half-open connections is recorded');
check(/Dropping request/.test(out(h, 'dmesg | tail')), 'dmesg says requests are dropped while cookies are off');
check(h.ran.klog, 'reading the kernel log is recorded');
check(/Flags \[S\]/.test(out(h, "tcpdump -nn -c 5 'tcp[tcpflags] == tcp-syn'")) && h.ran.capture, 'tcpdump prints SYN packets and is recorded');
check(/timed out/.test(out(h, 'curl -I --max-time 5 https://shop.example/')), 'curl times out while the queue refuses connections');
check(/Possible SYN/.test(out(h, 'dmesg | grep -i syn')), 'grep filters output');
check(out(h, 'ss -tan state syn-recv | head -n 3').split('\n').length === 3, 'head -n limits lines');
check(/not found/.test(out(h, 'frobnicate')), 'unknown command is reported');

// ---- hardening with sysctl
out(h, 'sysctl -w net.ipv4.tcp_syncookies=1');
check(h.sysctl['net.ipv4.tcp_syncookies'] === 1, 'sysctl -w changes the running value');
check(/Sending cookies/.test(out(h, 'dmesg')), 'dmesg now says cookies are being sent');
check(/Invalid argument/.test(out(h, 'sysctl -w net.ipv4.tcp_syncookies=7')), 'out-of-range value is rejected');
check(h.sysctl['net.ipv4.tcp_syncookies'] === 1, 'a rejected value changes nothing');
check(!/timed out/.test(out(h, 'curl https://shop.example/')), 'curl succeeds once cookies are on');

// ---- persistence
out(h, 'echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-synflood.conf');
check(/tcp_syncookies = 1/.test(out(h, 'cat /etc/sysctl.d/99-synflood.conf')), 'echo >> writes the file');
check(h.fileVersion !== h.loadedVersion, 'file is not loaded until sysctl --system');
out(h, 'sysctl --system');
check(h.fileVersion === h.loadedVersion, 'sysctl --system loads it');
check(/Read-only/.test(out(h, 'echo x > /etc/passwd')), 'writing elsewhere is refused');
out(h, 'echo "net.ipv4.tcp_synack_retries = 2" | tee -a /etc/sysctl.d/99-synflood.conf');
check(/synack_retries = 2/.test(out(h, 'cat /etc/sysctl.d/99-synflood.conf')), 'tee -a appends to the file');

// ---- iptables
h = sh.createHost();
check(/unknown option "--limit"/.test(out(h, 'iptables -A INPUT -p tcp --syn --limit 10/s -j ACCEPT')), '--limit without -m limit is rejected');
check(/Couldn't load target/.test(out(h, 'iptables -A INPUT -j FROB')), 'unknown target is rejected');
check(/Chain "FOO" does not exist/.test(out(h, 'iptables -A FOO -j DROP')), 'unknown chain is rejected');
check(/unknown option "--syn"/.test(out(h, 'iptables -A INPUT --syn -j DROP')), '--syn needs -p tcp');
out(h, 'iptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT');
let ev = sh.evaluate(h);
check(!ev.defences.rateLimit && ev.notes.some((n) => /on its own changes nothing/.test(n.text)), 'an ACCEPT-limit rule alone is not a rate limit (explained)');
out(h, 'iptables -A INPUT -p tcp --syn --dport 443 -j DROP');
ev = sh.evaluate(h);
check(ev.defences.rateLimit && ev.status.globalLimit.rate === 400, 'limit ACCEPT + DROP is a global rate limit of 400/s');
check(/limit 400\/s/.test(out(h, 'iptables -S')) && /Chain INPUT/.test(out(h, 'iptables -L -n -v')), 'iptables -S and -L list the rules');
out(h, 'iptables -F');
check(sh.evaluate(h).status.globalLimit === null, 'iptables -F flushes');

h = sh.createHost();
out(h, 'iptables -A INPUT -p tcp --syn -m limit --limit 20/s -j ACCEPT');
out(h, 'iptables -A INPUT -p tcp --syn -j DROP');
ev = sh.evaluate(h);
check(ev.blocksCustomers && !ev.defences.rateLimit && ev.notes.some((n) => /below the normal customer peak/.test(n.text)), 'a 20/s limit is flagged as blocking customers');

h = sh.createHost();
out(h, 'iptables -A INPUT -p tcp --syn -m hashlimit --hashlimit-above 20/sec --hashlimit-mode srcip --hashlimit-name syn -j DROP');
ev = sh.evaluate(h);
check(!ev.defences.rateLimit && ev.status.perSource && ev.notes.some((n) => /spoofed flood/.test(n.text)), 'per-source hashlimit is not counted against a spoofed flood');
h = sh.createHost();
out(h, 'iptables -A INPUT -p tcp --syn -m hashlimit --hashlimit-above 400/sec --hashlimit-mode dstip --hashlimit-name syn -j DROP');
check(sh.evaluate(h).defences.rateLimit, 'a destination-based hashlimit is a global limit');

h = sh.createHost();
out(h, 'nft add rule inet filter input tcp dport 443 tcp flags syn limit rate over 400/second drop');
check(sh.evaluate(h).defences.rateLimit && /limit rate over 400/.test(out(h, 'nft list ruleset')), 'nft limit rate over 400/second drop is a global limit');

// ---- SYNPROXY
h = sh.createHost();
out(h, 'iptables -t raw -A PREROUTING -p tcp -m tcp --syn --dport 443 -j CT --notrack');
out(h, 'iptables -A INPUT -p tcp -m tcp --dport 443 -m conntrack --ctstate INVALID,UNTRACKED -j SYNPROXY --sack-perm --timestamp --wscale 7 --mss 1460');
ev = sh.evaluate(h);
check(!ev.defences.firewall && ev.notes.some((n) => /not effective yet/.test(n.text)), 'SYNPROXY without the prerequisites is not effective (explained)');
out(h, 'sysctl -w net.ipv4.tcp_syncookies=1'); out(h, 'sysctl -w net.netfilter.nf_conntrack_tcp_loose=0');
check(sh.evaluate(h).defences.firewall, 'SYNPROXY with loose=0 and cookies on is effective');

// ---- the attack model follows Little's law
h = sh.createHost();
let m = sh.attackModel(h);
check(m.synrecv === 256 && m.refusing, 'default host: queue full and refusing');
out(h, 'sysctl -w net.ipv4.tcp_synack_retries=1'); out(h, 'sysctl -w net.ipv4.tcp_max_syn_backlog=65536');
m = sh.attackModel(h);
check(m.life === 3 && m.synrecv === Math.min(65536, 1500 * 3), 'half-open entries = rate x lifetime when the backlog is large');

// ---- the workshop content is internally consistent
const calc = W.understand.calculator;
check(Math.pow(2, calc.answer + 1) - 1 <= calc.backlog / calc.rate && Math.pow(2, calc.answer + 2) - 1 > calc.backlog / calc.rate, 'calculator answer is the largest value that fits the backlog');
const allQs = [].concat(W.understand.checkpoints, W.investigate.questions, W.quizExtra);
check(allQs.every((q) => q.answer >= 0 && q.answer < q.options.length && q.explanation.length > 30), 'every workshop question has a valid answer and explanation');
check(W.incident.steps.every((s) => s.options.filter((o) => o.good).length === 1), 'every incident decision has exactly one best answer');
check(W.layers.exercises.every((e) => W.layers.layers.some((l) => l.id === e.answer)), 'every layer exercise points at a real layer');
const tally = [0, 0, 0, 0];
allQs.forEach((q) => tally[q.answer]++);
console.log('  info  answer position spread (A,B,C,D): ' + tally.join(','));

console.log('\n' + (failed ? failed + ' of ' + total + ' checks FAILED' : 'all ' + total + ' shell checks passed'));
process.exit(failed ? 1 : 0);
