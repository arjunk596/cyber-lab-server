/* ==========================================================================
   workshop-content.js — OWNER: Meet Mangaonkar (text), reviewed by Manvith Karkera
   Purpose: all text for "Part 2: Defender's Workshop" (Lab.Content.workshop).
   This is the part that teaches how a SYN flood is investigated and stopped on a
   real Linux server: kernel queues, the arithmetic of exhaustion, packet and log
   analysis, real sysctl / iptables / nftables commands, defence layers, and an
   incident-response playbook.

   Rich text is written as "blocks" (rendered by Lab.Workshop.renderBlocks):
     { t: 'h', x }  heading        { t: 'p', x }  paragraph (**bold** and `code` allowed)
     { t: 'ul'|'ol', items }       { t: 'code', x }  terminal-style block
     { t: 'note', title, x }       { t: 'table', head, rows }
   Everything is plain text; nothing here is ever inserted as HTML.
   NOTE: commands in this file are real Linux commands. The lab only SIMULATES them.
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  Lab.Content = Lab.Content || {};

  Lab.Content.workshop = {
    title: "Part 2: Defender's Workshop",
    intro: 'The simulation showed you what a SYN flood does. This workshop shows you how a real defender finds it and stops it. You will do the work an on-call engineer does: understand the kernel mechanism, read evidence, harden a Linux server with real commands, choose the right defence layer, and run the incident. Finish all five modules to unlock the quiz.',

    scenario: {
      host: 'web01',
      ip: '203.0.113.10',
      story: 'You are the on-call engineer for an online shop. web01 is a single Linux web server (nginx on port 443) behind a 1 Gbit/s uplink. It normally handles up to about 150 new connections per second. At 02:14 monitoring reports timeouts for customers.',
      normalPeakSynPerSec: 150
    },

    modules: [
      { id: 'understand', title: 'Understand', blurb: 'What the kernel does, and the arithmetic of exhaustion.' },
      { id: 'investigate', title: 'Investigate', blurb: 'Read logs and packets to prove it is a SYN flood.' },
      { id: 'harden', title: 'Harden', blurb: 'Fix a Linux server with real commands.' },
      { id: 'layers', title: 'Choose layers', blurb: 'Match each problem to the right defence.' },
      { id: 'incident', title: 'Run the incident', blurb: 'Make the calls an on-call engineer makes.' }
    ],

    // ------------------------------------------------------------------ 1. UNDERSTAND
    understand: {
      blocks: [
        { t: 'h', x: 'What the kernel really does with a SYN' },
        { t: 'p', x: 'When a SYN arrives on a port that has a listening socket, the Linux kernel does **not** wait for the application. The kernel itself answers, and it remembers the half-finished handshake in a small record called a **request socket** (roughly a few hundred bytes plus a timer). These records live in the **SYN queue** (also called the request queue or half-open queue).' },
        { t: 'ol', items: [
          'SYN arrives. The kernel creates a request socket in the **SYN queue** (the connection is now in state `SYN-RECV`) and sends a SYN-ACK.',
          'If no ACK arrives, the kernel **retransmits the SYN-ACK** with exponential back-off: after 1, 2, 4, 8 and 16 seconds. The number of retransmissions is `net.ipv4.tcp_synack_retries` (default 5).',
          'If the final ACK arrives, the record moves to the **accept queue**, where it waits until the application calls `accept()`. The accept queue is limited by `net.core.somaxconn` and by the backlog the application passed to `listen()`.',
          'If the timers run out, the request socket is deleted. With 5 retries that is after 1+2+4+8+16+32 = **63 seconds**.'
        ] },
        { t: 'note', title: 'The key insight', x: 'A half-open connection costs the attacker one tiny packet and costs the server memory, a timer and up to six retransmitted replies. The attack works because of this **asymmetry**, not because the attacker is "stronger". It is a resource-exhaustion attack on a limited table.' },

        { t: 'h', x: 'The settings that control it' },
        { t: 'table', head: ['Setting (sysctl)', 'Typical default', 'What it controls'], rows: [
          ['net.ipv4.tcp_syncookies', '1 on most distributions', '0 = never use cookies. 1 = use cookies only when the SYN queue overflows. 2 = always use cookies.'],
          ['net.ipv4.tcp_max_syn_backlog', '128 to 4096 (scaled by RAM)', 'How many half-open connections the SYN queue may hold per listener.'],
          ['net.core.somaxconn', '4096 on kernels 5.4+, 128 before', 'Upper limit of the accept queue (completed handshakes waiting for the application).'],
          ['net.ipv4.tcp_synack_retries', '5', 'How many times a SYN-ACK is retransmitted. Fewer retries mean half-open entries are removed sooner.'],
          ['net.netfilter.nf_conntrack_tcp_loose', '1', 'Needed for SYNPROXY: must be 0 so the firewall does not accept mid-stream packets as new connections.']
        ] },

        { t: 'h', x: 'How SYN cookies work' },
        { t: 'p', x: 'When the SYN queue is full and `tcp_syncookies` is on, the kernel stops storing anything. It builds the **initial sequence number** of its SYN-ACK from a keyed hash of the connection (source and destination address and port), a coarse timestamp, and a few bits that encode the client\'s MSS. A real client echoes that number back in its ACK (as the acknowledgment number minus one). The kernel recomputes the hash; if it matches, the connection is real and is created at that moment. A spoofed SYN never produces an ACK, so it costs the server **no memory at all**.' },
        { t: 'p', x: 'The price: cookies cost CPU (a hash per SYN and per ACK), and they can carry only a few TCP options, which is why they are used only when the queue is already full. TCP timestamps are used to carry extra option bits, so do not disable `tcp_timestamps` on a server that relies on cookies.' },

        { t: 'h', x: 'Why the source address does not matter to the attacker' },
        { t: 'p', x: 'TCP gives the receiver no proof that the source address is genuine. The attacker forges a different source address in every SYN, so the server\'s SYN-ACKs go to innocent third parties (this reflected noise is called **backscatter**). Because there is no real source to throttle or block, blocking addresses you saw in a capture is almost always useless, and it can block real customers whose addresses were borrowed. The long-term fix is for networks to drop packets whose source address cannot be legitimate: **ingress filtering**, standardised as BCP 38 (RFC 2827), often done with unicast reverse-path filtering (uRPF).' },

        { t: 'h', x: 'The arithmetic: Little\'s law' },
        { t: 'p', x: 'In steady state, the number of entries in a queue equals **arrival rate multiplied by the time each entry stays**. For the SYN queue:' },
        { t: 'code', x: 'half-open entries  =  attack SYN rate  x  lifetime of an entry\nlifetime            =  2^(tcp_synack_retries + 1) - 1  seconds' },
        { t: 'p', x: 'Worked example: 500 spoofed SYN per second with the default 5 retries gives a lifetime of 63 s, so the server wants to hold 500 x 63 = **31,500** entries. With a backlog of 4,096 the queue is full. The attacker did not need to hold anything open: the server\'s own patience filled the table. Now try different settings below.' },

        { t: 'h', x: 'Which attacks does each tool cover?' },
        { t: 'table', head: ['Attack', 'What is exhausted', 'What helps', 'What does not'], rows: [
          ['SYN flood (spoofed)', 'SYN queue, CPU', 'SYN cookies, SYNPROXY, shorter SYN-ACK retries, global SYN limits', 'Blocking source IPs'],
          ['SYN flood from a botnet (real sources)', 'SYN queue, CPU', 'Cookies plus per-source limits and reputation filtering', 'Nothing alone is enough'],
          ['Volumetric flood (link saturated)', 'Bandwidth', 'Upstream scrubbing, CDN, provider filtering', 'Any setting on the server (packets never reach it)'],
          ['Connection exhaustion / Slowloris (full handshakes)', 'Accept queue, worker threads, file descriptors', 'Timeouts in the application, connection limits per source, a reverse proxy', 'SYN cookies (the handshake is genuine)'],
          ['ACK / RST floods', 'CPU, conntrack table', 'Stateless filtering, dropping INVALID packets', 'SYN-specific tuning']
        ] }
      ],

      calculator: {
        title: 'Check your understanding: size the fix',
        text: 'A spoofed flood arrives at 500 SYN per second. The SYN queue holds 4,096 entries (`tcp_max_syn_backlog = 4096`), and you are not allowed to use SYN cookies on this legacy box. What is the **largest** value of `tcp_synack_retries` that keeps the steady-state number of half-open entries at or below the backlog?',
        rate: 500,
        backlog: 4096,
        answer: 2,
        success: 'Correct. With 2 retries the lifetime is 2^3 - 1 = 7 s, so 500 x 7 = 3,500 entries, which fits in 4,096. With 3 retries the lifetime is 15 s and 500 x 15 = 7,500, which does not fit.',
        failure: 'Not yet. Work out the lifetime for a candidate value with 2^(retries + 1) - 1, multiply by 500 SYN/s, and compare with 4,096.',
        caveat: 'Real life adds a trade-off: a very low value also drops genuine clients on slow mobile links whose ACK is delayed, and it only works while the flood rate stays low enough. This is why cookies, not timers, are the main defence.'
      },

      checkpoints: [
        {
          id: 'u1',
          question: 'A legitimate client completes the handshake. Which queue does its connection sit in until the web server calls accept()?',
          options: ['The SYN queue', 'The accept queue', 'The conntrack table only', 'The ARP cache'],
          answer: 1,
          explanation: 'The SYN queue holds half-open connections. After the final ACK the request moves to the accept queue, which is limited by somaxconn and the application\'s listen() backlog.'
        },
        {
          id: 'u2',
          question: 'Why can a server with plenty of free RAM and an idle link still be taken down by a SYN flood?',
          options: [
            'The attacker fills the disk with log files',
            'The SYN queue is a fixed-size table, and once it is full new connections are refused regardless of free RAM',
            'SYN packets contain malware',
            'TCP stops working when the CPU is below 50%'
          ],
          answer: 1,
          explanation: 'The queue has a configured limit (tcp_max_syn_backlog). The attack exhausts that table, not memory or bandwidth, so the machine looks calm while customers get timeouts. That is why a flood can be missed if you only watch CPU and bandwidth.'
        },
        {
          id: 'u3',
          question: 'An administrator sets net.ipv4.tcp_syncookies = 0 "for performance". What changes during a flood?',
          options: [
            'Nothing, cookies are used only for encryption',
            'When the SYN queue is full the kernel can only drop new SYNs, so genuine customers are refused too',
            'The kernel answers every SYN with a RST',
            'The attack becomes harder because SYN-ACKs are encrypted'
          ],
          answer: 1,
          explanation: 'Without cookies there is no way to accept a connection without storing state, so a full queue means refusal for everyone. Cookies are the one mechanism that lets genuine clients through while the queue is full.'
        }
      ]
    },

    // ------------------------------------------------------------------ 2. INVESTIGATE
    investigate: {
      brief: 'Before you change anything, prove what is happening. A wrong diagnosis costs time: a crashed application, a flash sale and a SYN flood all look like "the site is down". Study the evidence from web01, then answer the four questions.',
      evidence: [
        {
          title: 'Monitoring dashboard (02:14)',
          lines: [
            'CPU load .............. 35 %',
            'Memory in use ......... 41 %',
            'Network in ............ 18 Mbit/s  (link: 1000 Mbit/s)',
            'Established conns ..... 211   (normal: about 200)',
            'HTTP 5xx / timeouts ... 94 % of customer requests',
            'nginx process ......... running, 0 restarts'
          ]
        },
        {
          title: 'Kernel log: dmesg | tail -n 3',
          lines: [
            '[ 8412.113456] TCP: request_sock_TCP: Possible SYN flooding on port 443. Dropping request.  Check SNMP counters.',
            '[ 8472.481902] TCP: request_sock_TCP: Possible SYN flooding on port 443. Dropping request.  Check SNMP counters.',
            '[ 8532.907311] TCP: request_sock_TCP: Possible SYN flooding on port 443. Dropping request.  Check SNMP counters.'
          ]
        },
        {
          title: 'Packet capture (first 16 SYN packets): tcpdump -nn -c 16 \'tcp[tcpflags] == tcp-syn\' and port 443',
          lines: [
            '02:14:07.100312 IP 91.208.17.4.31022   > 203.0.113.10.443: Flags [S], seq 1930412211, win 512, length 0',
            '02:14:07.100391 IP 185.33.201.90.2744  > 203.0.113.10.443: Flags [S], seq 77012003, win 512, length 0',
            '02:14:07.100470 IP 24.118.7.201.60117  > 203.0.113.10.443: Flags [S], seq 2840911122, win 512, length 0',
            '02:14:07.100552 IP 118.45.230.9.12984  > 203.0.113.10.443: Flags [S], seq 411230981, win 512, length 0',
            '02:14:07.100630 IP 5.188.62.140.45003  > 203.0.113.10.443: Flags [S], seq 3290127711, win 512, length 0',
            '02:14:07.100711 IP 200.57.11.33.8811   > 203.0.113.10.443: Flags [S], seq 1172209934, win 512, length 0',
            '02:14:07.100793 IP 77.91.154.18.52019  > 203.0.113.10.443: Flags [S], seq 610339018, win 512, length 0',
            '02:14:07.100874 IP 141.98.10.77.9120   > 203.0.113.10.443: Flags [S], seq 2299001235, win 512, length 0',
            '02:14:07.100952 IP 36.110.233.5.33310  > 203.0.113.10.443: Flags [S], seq 904412330, win 512, length 0',
            '02:14:07.101031 IP 62.210.5.201.17744  > 203.0.113.10.443: Flags [S], seq 3711009421, win 512, length 0',
            '02:14:07.101111 IP 190.12.88.64.64002  > 203.0.113.10.443: Flags [S], seq 55120934, win 512, length 0',
            '02:14:07.101190 IP 103.77.2.250.20777  > 203.0.113.10.443: Flags [S], seq 2012877340, win 512, length 0',
            '02:14:07.101271 IP 45.9.148.113.4115   > 203.0.113.10.443: Flags [S], seq 1388204412, win 512, length 0',
            '02:14:07.101352 IP 212.102.40.8.38812  > 203.0.113.10.443: Flags [S], seq 3099410021, win 512, length 0',
            '02:14:07.101430 IP 14.139.9.171.55290  > 203.0.113.10.443: Flags [S], seq 760218833, win 512, length 0',
            '02:14:07.101510 IP 168.196.41.6.27018  > 203.0.113.10.443: Flags [S], seq 1544910072, win 512, length 0'
          ]
        },
        {
          title: 'Connection states: ss -Htan | awk \'{print $1}\' | sort | uniq -c',
          lines: [
            '    211 ESTAB',
            '   4096 SYN-RECV',
            '      9 TIME-WAIT',
            '      4 LISTEN'
          ]
        }
      ],
      questions: [
        {
          id: 'i1',
          question: 'CPU is 35%, memory is 41% and the link is almost idle, yet 94% of customer requests fail. What does this combination tell you?',
          options: [
            'The link is saturated by a volumetric flood',
            'A limited table inside the server is exhausted (connection state), not raw capacity',
            'The disk is full',
            'nginx has crashed'
          ],
          answer: 1,
          explanation: 'Low CPU, low bandwidth and a running nginx point away from a volumetric flood and an application crash. Something with a fixed size is full. The state counts (4,096 in SYN-RECV, matching the backlog) show that it is the SYN queue.'
        },
        {
          id: 'i2',
          question: 'Look at the capture. All 16 packets have different source addresses from different countries, but identical window size (512) and the same destination port. What is the most likely explanation?',
          options: [
            'Sixteen different customers opened the shop at the same instant',
            'A traffic generator is sending SYN packets with forged source addresses',
            'The packets are a normal load balancer health check',
            'A DNS misconfiguration'
          ],
          answer: 1,
          explanation: 'Different genuine browsers would show different window sizes and sequence behaviour, and they would not all arrive within 1.2 ms. Identical packet fields with random sources are the signature of a tool that forges sources (hping3 style, window 512). Real customers also follow their SYN with an ACK.'
        },
        {
          id: 'i3',
          question: 'How can you tell a SYN flood from a flash crowd after a big marketing email?',
          options: [
            'A flash crowd has many ESTABLISHED connections and the queue drains; in a flood the SYN-RECV count stays high while ESTABLISHED does not grow',
            'There is no way to tell them apart',
            'A flash crowd only comes from one country',
            'A flood is always slower than a flash crowd'
          ],
          answer: 0,
          explanation: 'In a flash crowd the handshakes complete: ESTABLISHED and request rates rise and SYN-RECV stays short-lived. In a SYN flood, 4,096 connections sit in SYN-RECV, ESTABLISHED stays near normal (211 here), and the kernel log says "Possible SYN flooding".'
        },
        {
          id: 'i4',
          question: 'Your colleague proposes adding all 16 source addresses from the capture to a blocklist. What is the best response?',
          options: [
            'Good idea, do it for every address in the capture',
            'It will not help: the addresses are forged and change on every packet, and some belong to innocent networks',
            'Block the whole internet except your office',
            'Only block the first address'
          ],
          answer: 1,
          explanation: 'Spoofed sources make address blocklists useless and risk blocking real customers. Controls that do not depend on the source address (SYN cookies, SYNPROXY, global SYN limits, upstream scrubbing) are what work.'
        }
      ]
    },

    // ------------------------------------------------------------------ 3. HARDEN
    harden: {
      brief: 'web01 is under a spoofed SYN flood right now. You are root on the server. Work through the checklist by typing real Linux commands in the terminal pop-up (the Terminal button in the header). Type `help` to see what the lab supports. When your changes are in place, test the server under the same attack you ran in the simulation.',
      motd: [
        'web01 - Ubuntu 22.04 LTS (simulated)  |  you are root',
        'An attack is in progress on port 443. Type "help" for supported commands.',
        ''
      ],
      tasks: [
        {
          id: 'count', required: true,
          title: 'Count the half-open connections',
          why: 'Never change a system you have not measured. This gives you the number you will compare against later.',
          hint: 'ss -tan state syn-recv | wc -l   (or: netstat -ant | grep -c SYN_RECV)'
        },
        {
          id: 'klog', required: true,
          title: 'Read the kernel log',
          why: 'The kernel itself reports a possible SYN flood and tells you whether it is sending cookies or dropping requests.',
          hint: 'dmesg | tail      (or: journalctl -k | grep -i syn)'
        },
        {
          id: 'capture', required: true,
          title: 'Capture some attack packets as evidence',
          why: 'You need a sample for the post-incident review and for your upstream provider.',
          hint: "tcpdump -nn -c 10 'tcp[tcpflags] == tcp-syn'"
        },
        {
          id: 'cookies', required: true,
          title: 'Enable SYN cookies now (runtime)',
          why: 'This is the single most effective host-level change. It lets genuine clients through even when the queue is full.',
          hint: 'sysctl -w net.ipv4.tcp_syncookies=1'
        },
        {
          id: 'retries', required: true,
          title: 'Make half-open entries expire sooner',
          why: 'Using the arithmetic from Module 1: lifetime = 2^(retries+1) - 1. Choose a value between 1 and 3 (zero would hurt slow genuine clients).',
          hint: 'sysctl -w net.ipv4.tcp_synack_retries=2'
        },
        {
          id: 'backlog', required: false,
          title: 'Optional: give the queues more room',
          why: 'A larger backlog only buys time. Set tcp_max_syn_backlog and somaxconn to at least 2048 and note that the flood still fills it eventually.',
          hint: 'sysctl -w net.ipv4.tcp_max_syn_backlog=4096   and   sysctl -w net.core.somaxconn=4096'
        },
        {
          id: 'ratelimit', required: true,
          title: 'Add a global SYN rate limit at the firewall',
          why: 'The sources are spoofed, so a per-source limit is useless: the attacker uses a fresh address each time. Limit all new SYNs to the port. Keep the limit above your normal peak of about 150 per second or you will block customers.',
          hint: 'iptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT\niptables -A INPUT -p tcp --syn --dport 443 -j DROP\n(or with nftables: nft add rule inet filter input tcp dport 443 tcp flags syn limit rate over 400/second drop)'
        },
        {
          id: 'persist', required: true,
          title: 'Make the settings survive a reboot',
          why: '`sysctl -w` changes only the running kernel. Put the settings in a file under /etc/sysctl.d/ and load it, or the fix disappears at the next reboot.',
          hint: 'echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-synflood.conf\necho "net.ipv4.tcp_synack_retries = 2" >> /etc/sysctl.d/99-synflood.conf\nsysctl --system'
        },
        {
          id: 'synproxy', required: false,
          title: 'Stretch goal: put SYNPROXY in front of the server',
          why: 'SYNPROXY lets the firewall complete the handshake itself and only forward connections that proved they are real. It needs conntrack in strict mode and cookies on.',
          hint: 'sysctl -w net.netfilter.nf_conntrack_tcp_loose=0\niptables -t raw -A PREROUTING -p tcp -m tcp --syn --dport 443 -j CT --notrack\niptables -A INPUT -p tcp -m tcp --dport 443 -m conntrack --ctstate INVALID,UNTRACKED -j SYNPROXY --sack-perm --timestamp --wscale 7 --mss 1460'
        }
      ],
      reference: [
        { t: 'h', x: 'Field reference' },
        { t: 'code', x: '# measure\nss -tan state syn-recv | wc -l          # half-open connections\nnetstat -s | grep -i listen              # queue overflow counters\ndmesg | tail                             # kernel messages\ntcpdump -nn -c 10 \'tcp[tcpflags] == tcp-syn\'\n\n# kernel hardening (runtime)\nsysctl -w net.ipv4.tcp_syncookies=1\nsysctl -w net.ipv4.tcp_synack_retries=2\nsysctl -w net.ipv4.tcp_max_syn_backlog=4096\nsysctl -w net.core.somaxconn=4096\n\n# make it permanent\necho "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-synflood.conf\nsysctl --system\n\n# firewall: global SYN limit\niptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT\niptables -A INPUT -p tcp --syn --dport 443 -j DROP' },
        { t: 'note', title: 'Test in a lab, never on someone else\'s network', x: 'Only generate flood traffic against systems you own or have written permission to test, and keep it inside an isolated virtual network. This workshop uses a simulated host so that you can practise the defences safely.' }
      ],
      results: {
        pass: 'Your hardening holds. The server stayed available for genuine customers while the attack continued.',
        weak: 'Customers are mostly getting through, but the server is still strained. Look at which layers you have not used yet.',
        fail: 'Customers are still being refused. Re-read the notes below and the checklist.',
        needCore: 'Finish the required checklist items first (or at least enable SYN cookies), then run the test.'
      }
    },

    // ------------------------------------------------------------------ 4. LAYERS
    layers: {
      brief: 'No single control stops every flood. Real networks stack several layers, and each layer solves a different problem. Read the layers, then decide which one is the right answer to each situation.',
      layers: [
        { id: 'host', name: 'Host kernel tuning', text: 'SYN cookies, backlog sizes, SYN-ACK retries. Free and fast to apply, but only protects the one machine, and it cannot help if the link itself is full.' },
        { id: 'firewall', name: 'Host or network firewall', text: 'Global SYN rate limits, per-source limits (connlimit, hashlimit), SYNPROXY. Removes bad traffic before the application sees it. A limit that is too low also blocks customers.' },
        { id: 'proxy', name: 'Load balancer or reverse proxy', text: 'Terminates TCP in front of the application. Only completed handshakes are forwarded, and the proxy tier can be scaled out. Needs capacity of its own.' },
        { id: 'scrubbing', name: 'Upstream scrubbing / CDN / DDoS protection service', text: 'Traffic is announced to a provider with huge capacity, cleaned, and forwarded to you. The only answer to attacks bigger than your uplink. Costs money and needs preparation.' },
        { id: 'isp', name: 'ISP or edge network (RTBH, FlowSpec, BCP 38)', text: 'Operators drop traffic at their edge: remote-triggered black-hole (RTBH) routes, FlowSpec filters, and ingress filtering that blocks forged source addresses at the origin.' }
      ],
      exercises: [
        {
          id: 'l1',
          situation: 'A flood of 2 Gbit/s of SYN packets is saturating your 1 Gbit/s uplink. Your server is healthy but cannot be reached.',
          answer: 'scrubbing',
          explanation: 'Packets never get through the saturated link, so nothing you configure on the server matters. Traffic has to be absorbed or cleaned upstream, by a provider with more capacity than the attack.'
        },
        {
          id: 'l2',
          situation: 'A modest spoofed flood (500 SYN/s) hits one Linux server. The link is idle but the SYN queue is full.',
          answer: 'host',
          explanation: 'This is exactly what SYN cookies and shorter SYN-ACK retries are for. It is cheap, immediate and needs no extra infrastructure.'
        },
        {
          id: 'l3',
          situation: 'You want your application servers to never see a half-open connection at all, and you want to add capacity for connection handling independently of the application.',
          answer: 'proxy',
          explanation: 'A load balancer or reverse proxy terminates the handshake itself and passes only established connections to the application tier.'
        },
        {
          id: 'l4',
          situation: 'Cookies are enabled and working, but the servers burn CPU filtering a continuous flood. You want to drop most of it cheaply before the application stack and keep legitimate traffic flowing.',
          answer: 'firewall',
          explanation: 'Stateless or SYNPROXY firewall rules and global SYN limits discard bad traffic early, at lower cost than letting each SYN reach the full TCP stack.'
        },
        {
          id: 'l5',
          situation: 'Your hosting network lets customers send packets with any source address, so attackers can use it to hide. How should the network operator stop being a source of spoofed floods?',
          answer: 'isp',
          explanation: 'Ingress filtering (BCP 38 / uRPF) at the network edge drops packets whose source address does not belong to the customer. It protects everybody else, not the operator itself.'
        },
        {
          id: 'l6',
          situation: 'One customer-facing IP address is being hit so hard that it threatens the whole data centre. You decide to sacrifice that one address to keep every other service up.',
          answer: 'isp',
          explanation: 'Remote-triggered black-holing (RTBH) tells upstream routers to discard all traffic to that address. It stops the collateral damage but also completes the attacker\'s goal for that address, so it is a last resort.'
        }
      ],
      closing: 'Good design is **defence in depth**: BCP 38 reduces spoofing everywhere, scrubbing covers volume, a proxy or firewall removes bad handshakes, and host tuning is the last line. Each layer has gaps, and the layers together cover them.'
    },

    // ------------------------------------------------------------------ 5. INCIDENT
    incident: {
      brief: 'It is 02:14. You are the incident commander for the shop. Make each call as you would in production. A weak choice is explained and you can try again, but your first-try score is recorded.',
      steps: [
        {
          id: 'n1',
          title: 'Triage',
          situation: 'The pager says customers see timeouts. Dashboards show low CPU and low bandwidth. What do you do first?',
          options: [
            { text: 'Reboot web01 straight away.', good: false, why: 'A reboot empties the queue for a few seconds, destroys the evidence in memory and logs, and the attack refills the table within a minute. It also hides the cause.' },
            { text: 'Confirm what is happening: check connection states, the kernel log and a short packet sample.', good: true, why: 'Correct. Establish whether this is an attack, a flash crowd or an application fault before changing anything. It takes two minutes and decides every later step.' },
            { text: 'Block every address from outside the country.', good: false, why: 'This is guesswork. Spoofed addresses make geography meaningless, and you would block real customers.' },
            { text: 'Post on social media that the site is under attack.', good: false, why: 'You have no confirmed diagnosis yet. Communicate once you know facts, through the planned channels.' }
          ]
        },
        {
          id: 'n2',
          title: 'Preserve evidence',
          situation: 'Evidence confirms a spoofed SYN flood (4,096 entries in SYN-RECV, "Possible SYN flooding" in the log). What should you save before changing the configuration?',
          options: [
            { text: 'Nothing, the logs rotate automatically.', good: false, why: 'Logs rotate and counters reset. Without a sample you cannot brief your provider or learn from the incident.' },
            { text: 'A short packet capture, the connection-state counts and kernel log lines, each with timestamps.', good: true, why: 'Correct. A few seconds of capture, the counters and timestamps are enough for the provider, for the post-incident review and for any later report.' },
            { text: 'A screenshot of the website.', good: false, why: 'The site is simply down. It tells nobody how or why.' },
            { text: 'Delete the old logs so the disk does not fill.', good: false, why: 'Deleting evidence in the middle of an incident is the opposite of what you need.' }
          ]
        },
        {
          id: 'n3',
          title: 'First containment',
          situation: 'What is the fastest safe change on the server itself?',
          options: [
            { text: 'sysctl -w net.ipv4.tcp_syncookies=1 (and shorten tcp_synack_retries).', good: true, why: 'Correct. It is applied instantly, needs no restart, is easy to reverse, and lets genuine clients through while the queue is full.' },
            { text: 'Set tcp_max_syn_backlog to 10,000,000.', good: false, why: 'A huge backlog only delays the problem and consumes memory for every forged entry. Without cookies it is just a bigger table to fill.' },
            { text: 'Disable TCP timestamps to save CPU.', good: false, why: 'SYN cookies use the timestamp field to carry option bits. Disabling it weakens exactly the defence you need.' },
            { text: 'Restart nginx.', good: false, why: 'The problem is in the kernel\'s SYN queue, not in nginx. Restarting breaks the few connections that do work.' }
          ]
        },
        {
          id: 'n4',
          title: 'Escalate',
          situation: 'Cookies are on and most customers recover, but the link is at 85% and rising. The host cannot fix a full link. What next?',
          options: [
            { text: 'Buy more RAM for web01.', good: false, why: 'Memory is not the bottleneck, bandwidth is. More RAM cannot widen the link.' },
            { text: 'Contact your upstream provider or DDoS protection service with the capture and ask to activate scrubbing or filtering.', good: true, why: 'Correct. Only an upstream with more capacity than the attack can absorb it. Your saved capture and timestamps make this call fast.' },
            { text: 'Add the source addresses in the capture to the firewall blocklist.', good: false, why: 'They are forged and change on every packet. You would add thousands of useless rules and risk blocking real people.' },
            { text: 'Wait and see if it stops.', good: false, why: 'Hoping is not a plan. Preparation and escalation matter most when the link is filling.' }
          ]
        },
        {
          id: 'n5',
          title: 'Communicate',
          situation: 'Customers and management are asking what is going on. How do you communicate?',
          options: [
            { text: 'A short status update: what customers see, since when, that you are working on it, and when the next update is due. Name one person as incident commander.', good: true, why: 'Correct. Factual, time-stamped and honest about what is known. A single owner avoids contradictory messages.' },
            { text: 'Say nothing until the incident is completely resolved.', good: false, why: 'Silence causes rumours and support tickets. Regular short updates reduce load on the team.' },
            { text: 'Blame a named competitor.', good: false, why: 'You have no evidence about who is behind it, and attribution mistakes are expensive.' },
            { text: 'Promise that the problem is fixed before you have verified it.', good: false, why: 'Premature all-clear messages destroy trust when the attack resumes.' }
          ]
        },
        {
          id: 'n6',
          title: 'Aftermath',
          situation: 'At 04:40 the attack stops. What should happen next?',
          options: [
            { text: 'Revert everything to defaults because the problem is gone.', good: false, why: 'The weakness that allowed the outage is still there. Reverting restores exactly the vulnerable configuration.' },
            { text: 'Make the fixes permanent, add alerts, update the runbook and hold a blameless review.', good: true, why: 'Correct. Persist the sysctl settings, alert on the SYN-RECV count and on the kernel "Possible SYN flooding" message, write down what worked, test the provider contact path, and review without blaming individuals.' },
            { text: 'Do nothing and go back to sleep.', good: false, why: 'Without follow-up the next attack repeats the same outage.' },
            { text: 'Disable monitoring to avoid false alarms.', good: false, why: 'Monitoring found the problem. Tuning alerts is right, switching them off is not.' }
          ]
        }
      ],
      debrief: 'A SYN flood is rarely stopped by one clever command. It is stopped by measuring first, applying reversible host fixes, escalating when the problem is bigger than the host, communicating clearly, and fixing the cause afterwards.'
    },

    // extra scenario questions appended to the final quiz
    quizExtra: [
      {
        id: 7,
        question: 'With the default tcp_synack_retries = 5, how long does a forged SYN occupy a slot in the SYN queue?',
        options: ['About 1 second', 'About 7 seconds', 'About 63 seconds', 'Until the next reboot'],
        answer: 2,
        explanation: 'The SYN-ACK is retransmitted after 1, 2, 4, 8 and 16 seconds and the entry is removed after one more wait of 32 seconds: 1+2+4+8+16+32 = 63 seconds.'
      },
      {
        id: 8,
        question: 'A flood arrives at 1,000 forged SYN per second and each entry lives for 7 seconds. About how many half-open entries does the server hold in steady state?',
        options: ['70', '700', '7,000', '70,000'],
        answer: 2,
        explanation: 'Little\'s law: entries = arrival rate x lifetime = 1,000 x 7 = 7,000.'
      },
      {
        id: 9,
        question: 'Why is a per-source-address rate limit a poor defence against a spoofed SYN flood?',
        options: [
          'Routers cannot count packets per address',
          'Every packet carries a different forged source address, so no single source ever exceeds the limit',
          'It only works for IPv6',
          'It always blocks the administrator'
        ],
        answer: 1,
        explanation: 'A per-source limit counts packets from one address. A spoofing attacker rotates through addresses, so each one stays under the limit. Global limits, cookies, SYNPROXY and upstream filtering do not depend on the source address.'
      },
      {
        id: 10,
        question: 'You run sysctl -w net.ipv4.tcp_syncookies=1 during an attack and the site recovers. What must you do to keep this after a reboot?',
        options: [
          'Nothing, sysctl -w is permanent',
          'Add the setting to a file in /etc/sysctl.d/ and load it with sysctl --system',
          'Reinstall the operating system',
          'Restart the network cable'
        ],
        answer: 1,
        explanation: 'sysctl -w modifies only the running kernel. A line in /etc/sysctl.d/*.conf is read at boot and by sysctl --system.'
      },
      {
        id: 11,
        question: 'An attack of 3 Gbit/s saturates your 1 Gbit/s link. Which action is most likely to restore service?',
        options: [
          'Enable SYN cookies on the server',
          'Increase tcp_max_syn_backlog',
          'Divert traffic through an upstream scrubbing service or ask the provider to filter',
          'Shorten tcp_synack_retries'
        ],
        answer: 2,
        explanation: 'The packets are lost before they reach the server, so host settings cannot help. Only a party with more capacity than the attack, such as a scrubbing service or the upstream provider, can absorb it.'
      },
      {
        id: 12,
        question: 'Which long-term network measure reduces the supply of spoofed floods across the whole internet?',
        options: [
          'Ingress filtering (BCP 38) that drops packets with source addresses the network does not own',
          'Longer passwords',
          'Disabling IPv6',
          'Using larger TCP window sizes'
        ],
        answer: 0,
        explanation: 'If every network dropped packets with forged source addresses at the edge, spoofed floods and reflection attacks would be far harder. BCP 38 (RFC 2827) describes how.'
      }
    ],

    completion: {
      title: "Defender's Workshop complete",
      message: 'You have measured an attack, proved its type from evidence, hardened a server with real commands, matched defences to problems, and led an incident. These are the same steps a practising security engineer takes.'
    }
  };

  // ---- housekeeping: spread the correct answers over A-D and append the extra quiz questions ----
  function balance(list, offset) {
    list.forEach(function (q, i) {
      var target = (i * 3 + offset) % 4, from = q.answer;
      if (from === target) return;
      var tmp = q.options[from]; q.options[from] = q.options[target]; q.options[target] = tmp;
      q.answer = target;
    });
  }
  var CMD = {
    synCookies: 'sysctl -w net.ipv4.tcp_syncookies=1',
    rateLimit: 'iptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT\niptables -A INPUT -p tcp --syn --dport 443 -j DROP',
    shortTimeout: 'sysctl -w net.ipv4.tcp_synack_retries=2',
    firewall: 'sysctl -w net.netfilter.nf_conntrack_tcp_loose=0\niptables -t raw -A PREROUTING -p tcp -m tcp --syn --dport 443 -j CT --notrack\niptables -A INPUT -p tcp -m tcp --dport 443 -m conntrack --ctstate INVALID,UNTRACKED -j SYNPROXY --sack-perm --timestamp --wscale 7 --mss 1460'
  };
  Object.keys(CMD).forEach(function (k) { if (Lab.Content.mitigations[k]) Lab.Content.mitigations[k].command = CMD[k]; });

  // ---- the guided runbook shown inside the terminal pop-up (checked by js/terminal.js, in this order) ----
  Lab.Content.runbook = {
    title: 'Guided runbook',
    intro: 'Run these commands one at a time, as an on-call engineer would. Each step checks the server state, not just what you typed, so a different correct command also counts.',
    steps: [
      { id: 'count', check: 'count', required: true, title: 'Measure: count half-open connections',
        why: 'Never change a system you have not measured. SYN-RECV is the state of a connection that received a SYN and is waiting for the final ACK.',
        command: 'ss -tan state syn-recv | wc -l',
        learned: 'About 256 entries (the whole SYN queue) plus a header line. A healthy web server has only a handful in SYN-RECV at any moment.' },
      { id: 'klog', check: 'klog', required: true, title: 'Read the kernel log',
        why: 'The kernel reports a suspected SYN flood itself, and says whether it is dropping requests or sending cookies.',
        command: 'dmesg | tail',
        learned: 'The line "Possible SYN flooding on port 443. Dropping request" confirms the queue overflowed and the kernel has no way to keep serving new clients.' },
      { id: 'capture', check: 'capture', required: true, title: 'Capture attack packets as evidence',
        why: 'You need proof for the post-incident review and for your upstream provider. -c limits the capture to a few packets.',
        command: "tcpdump -nn -c 10 'tcp[tcpflags] == tcp-syn'",
        learned: 'Many SYN packets from unrelated addresses with identical window size: the signature of a tool forging source addresses.' },
      { id: 'readcookies', check: 'readcookies', required: true, title: 'Check whether SYN cookies are on',
        why: 'Before changing a setting, read its current value.',
        command: 'sysctl net.ipv4.tcp_syncookies',
        learned: 'The value is 0. Somebody disabled cookies "for performance", so a full queue means genuine customers are refused.' },
      { id: 'cookies', check: 'cookies', required: true, title: 'Mitigation 1: enable SYN cookies',
        why: 'With cookies, the kernel stops storing state for each SYN once the queue is full and still serves clients that complete the handshake.',
        command: 'sysctl -w net.ipv4.tcp_syncookies=1',
        learned: 'Applied instantly to the running kernel. The SYN cookies switch in the Mitigation section follows it.' },
      { id: 'retries', check: 'retries', required: true, title: 'Mitigation 2: expire half-open entries sooner',
        why: 'Entries live 2^(retries+1) - 1 seconds. With 5 retries that is 63 s. With 2 retries it is 7 s, so the same flood fills far less of the queue.',
        command: 'sysctl -w net.ipv4.tcp_synack_retries=2',
        learned: 'Forged entries now vanish after 7 seconds. Do not set it to 0: genuine clients on lossy links would fail.' },
      { id: 'rateAccept', check: 'rateAccept', required: true, title: 'Mitigation 3a: allow SYNs up to a global limit',
        why: 'The sources are forged, so a per-source limit is useless. This rule accepts new SYNs to port 443 up to 400 per second (your normal peak is about 150).',
        command: 'iptables -A INPUT -p tcp --syn --dport 443 -m limit --limit 400/s --limit-burst 800 -j ACCEPT',
        learned: 'On its own this changes nothing, because the default policy is ACCEPT. The next rule makes it a limit.' },
      { id: 'rateDrop', check: 'rateDrop', required: true, title: 'Mitigation 3b: drop SYNs above the limit',
        why: 'Rules are evaluated top to bottom. SYNs within the limit match the ACCEPT rule; everything else reaches this DROP rule.',
        command: 'iptables -A INPUT -p tcp --syn --dport 443 -j DROP',
        learned: 'A global SYN limit is now in force. It is blunt (it also drops customers during a flood) but keeps the TCP stack from being overwhelmed.' },
      { id: 'listRules', check: 'listRules', required: true, title: 'Verify the firewall rules',
        why: 'Always read back what you configured. Order matters.',
        command: 'iptables -S',
        learned: 'The ACCEPT-limit rule comes first, then the DROP rule. If they were the other way round, every SYN would be dropped.' },
      { id: 'persistCookies', check: 'persistCookies', required: true, title: 'Make it permanent: cookies',
        why: '`sysctl -w` changes only the running kernel. Settings in /etc/sysctl.d/ are read at boot.',
        command: 'echo "net.ipv4.tcp_syncookies = 1" >> /etc/sysctl.d/99-synflood.conf',
        learned: 'The setting is in the file but not loaded yet. Check it with cat /etc/sysctl.d/99-synflood.conf.' },
      { id: 'persistRetries', check: 'persistRetries', required: true, title: 'Make it permanent: SYN-ACK retries',
        why: 'Same file, second setting.',
        command: 'echo "net.ipv4.tcp_synack_retries = 2" >> /etc/sysctl.d/99-synflood.conf',
        learned: 'Both settings are now in the file. iptables rules are saved separately (for example with iptables-save or your distribution\'s persistence package).' },
      { id: 'load', check: 'load', required: true, title: 'Load the file and confirm it parses',
        why: 'Loading proves the file has no typos and that a reboot will give the same result.',
        command: 'sysctl --system',
        learned: 'sysctl applied every file under /etc/sysctl.d/. A typo here would show an error now instead of during an outage.' },
      { id: 'curl', check: 'curl', required: true, title: 'Verify from the customer\'s side',
        why: 'The real test is whether a customer request succeeds.',
        command: 'curl -I --max-time 5 https://shop.example/',
        learned: 'The request is served again. Press Run With Mitigation to measure the same attack against your configuration.' },
      { id: 'loose', check: 'loose', required: false, title: 'Bonus: SYNPROXY, strict conntrack',
        why: 'SYNPROXY lets the firewall complete the handshake for the server. It needs conntrack in strict mode so mid-stream packets are not accepted as new connections.',
        command: 'sysctl -w net.netfilter.nf_conntrack_tcp_loose=0',
        learned: 'Prerequisite one of three.' },
      { id: 'notrack', check: 'notrack', required: false, title: 'Bonus: do not track incoming SYNs',
        why: 'SYNs must bypass connection tracking so the proxy, not the server, answers them.',
        command: 'iptables -t raw -A PREROUTING -p tcp -m tcp --syn --dport 443 -j CT --notrack',
        learned: 'Prerequisite two of three.' },
      { id: 'synproxy', check: 'synproxy', required: false, title: 'Bonus: add the SYNPROXY rule',
        why: 'Untracked SYNs and invalid packets are handed to SYNPROXY, which only forwards connections that proved they are real.',
        command: 'iptables -A INPUT -p tcp -m tcp --dport 443 -m conntrack --ctstate INVALID,UNTRACKED -j SYNPROXY --sack-perm --timestamp --wscale 7 --mss 1460',
        learned: 'The firewall filter is now active: the Firewall filtering switch turns on.' }
    ],
    complete: 'Runbook complete. You measured, mitigated, persisted and verified. Now press Run With Mitigation to see the result against the same attack.'
  };

  var WK = Lab.Content.workshop;
  balance(WK.understand.checkpoints, 2);
  balance(WK.investigate.questions, 3);
  Lab.Content.quiz = Lab.Content.quiz.concat(WK.quizExtra);
  balance(Lab.Content.quiz, 1);
})(window.Lab);
