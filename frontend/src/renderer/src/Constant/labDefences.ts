export interface DefenseItem {
  id: string
  title: string
  subtitle: string
  description: string
  command?: string
  defaultActive: boolean
}

export interface MetricComparison {
  name: string
  unmitigated: string
  mitigated: string
  improvement: string
}

export interface LabDefenseData {
  labRepo: string
  heroTitle: string
  heroDescription: string
  defenses: DefenseItem[]
  metrics: MetricComparison[]
  summaryTitle: string
  summaryDescription: string
}

export const LAB_DEFENSES: Record<string, LabDefenseData> = {
  css_mini: {
    labRepo: 'css_mini',
    heroTitle: 'TCP Stack Hardening & SYN Flood Mitigations',
    heroDescription: 'Configure kernel socket parameters, cryptographic sequence challenges, and firewall connection limits to preserve web server availability during volumetric half-open floods.',
    defenses: [
      {
        id: 'syncookies',
        title: 'SYN Cookies (RFC 4987)',
        subtitle: 'net.ipv4.tcp_syncookies = 1',
        description: 'When the listen queue fills, the kernel avoids allocating socket memory by encoding TCP connection parameters into the Initial Sequence Number (ISN). State is only allocated when the final ACK arrives.',
        command: 'sudo sysctl -w net.ipv4.tcp_syncookies=1',
        defaultActive: true
      },
      {
        id: 'backlog',
        title: 'Backlog Queue Expansion',
        subtitle: 'net.ipv4.tcp_max_syn_backlog = 2048',
        description: 'Expands the kernel half-open connection table capacity from the default 100 to 2048 sockets, absorbing transient micro-bursts of SYN traffic without dropping legitimate handshakes.',
        command: 'sudo sysctl -w net.ipv4.tcp_max_syn_backlog=2048',
        defaultActive: false
      },
      {
        id: 'retries',
        title: 'SYN-ACK Retries Reduction',
        subtitle: 'net.ipv4.tcp_synack_retries = 1',
        description: 'Reduces the number of times the server retransmits SYN-ACK packets for unacknowledged connections from 5 to 1, releasing abandoned sockets in ~3 seconds instead of 63 seconds.',
        command: 'sudo sysctl -w net.ipv4.tcp_synack_retries=1',
        defaultActive: true
      },
      {
        id: 'ratelimit',
        title: 'iptables SYN Rate Limiting',
        subtitle: 'iptables hashlimit module',
        description: 'Drops excessive SYN packets originating from anomalous IP ranges when connection attempts exceed 25 requests per second.',
        command: 'sudo iptables -A INPUT -p tcp --syn -m hashlimit --hashlimit-above 25/sec -j DROP',
        defaultActive: false
      }
    ],
    metrics: [
      { name: 'Backlog Saturation', unmitigated: '100% (Exhausted)', mitigated: '0% (Bypassed)', improvement: '-100% Saturation' },
      { name: 'Legitimate Drop Rate', unmitigated: '88.4% Dropped', mitigated: '0.1% Dropped', improvement: '99.8% Restored' },
      { name: 'Average RTT Latency', unmitigated: '480 ms', mitigated: '24 ms', improvement: '-95% Latency' },
      { name: 'Server CPU Interrupts', unmitigated: '98% (SoftIRQ lock)', mitigated: '14% (Normal)', improvement: 'Stable' }
    ],
    summaryTitle: 'Hardening Status: Protected via SYN Cookies',
    summaryDescription: 'Cryptographic sequence validation ensures authentic client handshakes succeed with zero local memory pre-allocation.'
  },

  'CSS-lab-simulation': {
    labRepo: 'CSS-lab-simulation',
    heroTitle: 'RSA Asymmetric Cryptographic Hardening & Padding',
    heroDescription: 'Evaluate cryptographic protections against Chosen Ciphertext Attacks (CCA), malleability exploits, and small prime factorization vulnerabilities.',
    defenses: [
      {
        id: 'oaep',
        title: 'Optimal Asymmetric Encryption Padding (OAEP)',
        subtitle: 'PKCS#1 v2.1 / RFC 8017',
        description: 'Applies randomized Feistel-network asymmetric padding with SHA-256 hashing to plaintext prior to exponentiation. Destroys the multiplicative homomorphic property, eliminating Chosen Ciphertext Attacks.',
        command: 'openssl pkeyutl -encrypt -in msg.txt -out c.bin -pubin -inkey pub.pem -pkeyopt rsa_padding_mode:oaep',
        defaultActive: true
      },
      {
        id: 'keysize',
        title: 'Key Length Hardening (2048 / 4096-bit)',
        subtitle: 'NIST Special Publication 800-57',
        description: 'Increases modulus size n from insecure demo semiprimes (16-1024 bits) to 2048 or 4096 bits, raising General Number Field Sieve (GNFS) factorization complexity to beyond 112-128 bits of security.',
        command: 'openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out private.pem',
        defaultActive: true
      },
      {
        id: 'blinding',
        title: 'Cryptographic Blinding against Side-Channels',
        subtitle: 'Timing attack countermeasure',
        description: 'Multiplies the private key exponentiation by a secret random blinding scalar before modular exponentiation, then unblinds afterward, preventing timing and power analysis attacks from extracting private key d.',
        command: 'RSA_blinding_on(rsa_key, ctx);',
        defaultActive: true
      },
      {
        id: 'constant_time',
        title: 'Constant-Time Modular Arithmetic',
        subtitle: 'Montgomery ladder multiplication',
        description: 'Executes all modular multiplications in constant time regardless of bit values in private exponent d, preventing cache-timing leakage.',
        command: 'BN_mod_exp_mont_consttime(...)',
        defaultActive: false
      }
    ],
    metrics: [
      { name: 'CCA Oracle Resistance', unmitigated: 'Vulnerable (Malleable)', mitigated: 'Immune (OAEP Checked)', improvement: 'Attack Defeated' },
      { name: 'Factoring Complexity', unmitigated: 'Seconds (Small primes)', mitigated: '2¹¹² Operations', improvement: 'Computationally Infeasible' },
      { name: 'Timing Side-Channel Leakage', unmitigated: 'Detectable Variance', mitigated: 'Constant-Time / Blinded', improvement: 'Zero Signal' },
      { name: 'Semantic Security (IND-CCA2)', unmitigated: 'Fail (Textbook)', mitigated: 'Pass (PKCS#1 v2.1)', improvement: 'Provably Secure' }
    ],
    summaryTitle: 'Cryptographic Security: IND-CCA2 Compliant',
    summaryDescription: 'RSA-OAEP padding renders ciphertexts non-malleable, completely preventing decryption oracle attacks.'
  },

  'CSS-LAB-BOA': {
    labRepo: 'CSS-LAB-BOA',
    heroTitle: 'Memory Safety Defenses & Exploit Mitigations',
    heroDescription: 'Analyze compiler-level, operating system, and architecture-level mitigations designed to neutralize stack-based buffer overflows and control-flow hijacking.',
    defenses: [
      {
        id: 'canary',
        title: 'Compiler Stack Canaries',
        subtitle: '-fstack-protector-all / -fstack-protector-strong',
        description: 'Places a randomized guard value (canary) between local buffers and the saved frame pointer (EBP) / return address (EIP). If an overflow corrupts the canary, the __stack_chk_fail handler terminates the process.',
        command: 'gcc -fstack-protector-all -o safe_prog vuln.c',
        defaultActive: true
      },
      {
        id: 'dep',
        title: 'Non-Executable Stack (NX / DEP / W^X)',
        subtitle: 'Data Execution Prevention (AMD No-Execute / Intel XD)',
        description: 'Marks memory pages allocated for the call stack as non-executable. If an attacker injects shellcode into a stack buffer and redirects EIP to it, the CPU raises an immediate Segmentation Fault (SIGSEGV).',
        command: 'gcc -z noexecstack -o safe_prog vuln.c',
        defaultActive: true
      },
      {
        id: 'aslr',
        title: 'Address Space Layout Randomization (ASLR)',
        subtitle: '/proc/sys/kernel/randomize_va_space = 2',
        description: 'Randomizes the base memory addresses of the stack, heap, and shared libraries on every program execution, preventing hardcoded payload addresses from pointing reliably to target functions.',
        command: 'sudo sysctl -w kernel.randomize_va_space=2',
        defaultActive: true
      },
      {
        id: 'bounds',
        title: 'Bounds-Checked Standard Library APIs',
        subtitle: 'Replacing gets(), strcpy() with fgets(), snprintf()',
        description: 'Prohibits the use of unbounded C string functions. Enforces explicit buffer length parameters to ensure user input cannot exceed allocated memory bounds.',
        command: 'fgets(buffer, sizeof(buffer), stdin);',
        defaultActive: true
      }
    ],
    metrics: [
      { name: 'EIP Hijack Success', unmitigated: '100% Reliable', mitigated: 'Blocked (__stack_chk_fail)', improvement: 'Exploit Neutralized' },
      { name: 'Stack Shellcode Execution', unmitigated: 'Arbitrary Code Exec', mitigated: 'SIGSEGV (NX Page)', improvement: 'Hardware Protected' },
      { name: 'Address Predictability', unmitigated: 'Static (0xffffcfb0)', mitigated: '24-bit Entropy Random', improvement: 'ASLR Randomization' },
      { name: 'Input Bounds Enforced', unmitigated: 'Unbounded (gets)', mitigated: 'Strict (sizeof check)', improvement: 'Zero Overflow' }
    ],
    summaryTitle: 'Memory Protection: Exploit Mitigation Active',
    summaryDescription: 'Stack Canaries and Data Execution Prevention prevent hijacked control flow from executing malicious instructions.'
  },

  packet_spoofing: {
    labRepo: 'packet_spoofing',
    heroTitle: 'Local Area Network & Protocol Defense Hardening',
    heroDescription: 'Deploy switch-level security controls, static mappings, and end-to-end transport layer encryption to defeat packet sniffing and ARP cache poisoning.',
    defenses: [
      {
        id: 'dai',
        title: 'Dynamic ARP Inspection (DAI)',
        subtitle: 'Switch port security with DHCP Snooping',
        description: 'Managed switches inspect incoming ARP replies on untrusted user ports and validate them against the DHCP snooping binding database. Unsolicited or spoofed ARP responses are dropped at the switch ASIC.',
        command: 'Switch(config)# ip arp inspection vlan 1',
        defaultActive: true
      },
      {
        id: 'static_arp',
        title: 'Static ARP Cache Bindings',
        subtitle: 'Permanent gateway IP-to-MAC mapping',
        description: 'Hardcodes the legitimate default gateway MAC address into the client operating system ARP table as a permanent entry, ignoring all incoming gratuitous ARP broadcast updates.',
        command: 'sudo arp -s 192.168.1.1 00:11:22:33:44:55',
        defaultActive: false
      },
      {
        id: 'tls',
        title: 'Enforced TLS 1.3 Transport Encryption',
        subtitle: 'HTTPS-Everywhere & HSTS (RFC 6797)',
        description: 'Encrypts all application payloads with authenticated symmetric ciphers (AES-256-GCM / ChaCha20-Poly1305) and Perfect Forward Secrecy (ECDHE), preventing passive sniffers from reading cleartext credentials.',
        command: 'Strict-Transport-Security: max-age=31536000; includeSubDomains',
        defaultActive: true
      },
      {
        id: 'dot1x',
        title: 'IEEE 802.1X Port-Based Authentication',
        subtitle: 'RADIUS EAP-TLS client verification',
        description: 'Requires all connected physical Ethernet ports and wireless clients to authenticate with cryptographic certificates before receiving network access, blocking rogue attacker nodes.',
        command: 'Switch(config-if)# authentication port-control auto',
        defaultActive: false
      }
    ],
    metrics: [
      { name: 'ARP Table Poisoning', unmitigated: 'Successful (Spoofed MAC)', mitigated: 'Blocked (DAI Switch Filter)', improvement: 'Cache Integrity Preserved' },
      { name: 'Cleartext Credential Leakage', unmitigated: 'Exposed in Plaintext', mitigated: 'Ciphertext Only (TLS 1.3)', improvement: 'Zero Eavesdropping' },
      { name: 'MITM Traffic Interception', unmitigated: '100% Routed via Attacker', mitigated: 'Direct Gateway Path', improvement: 'Gateway Authenticated' },
      { name: 'Rogue Node Network Access', unmitigated: 'Plug-and-Play', mitigated: 'Blocked (802.1X EAP)', improvement: 'Zero Unauthorized Access' }
    ],
    summaryTitle: 'LAN Defense: MITM & Eavesdropping Neutralized',
    summaryDescription: 'Dynamic ARP Inspection protects Layer 2 routing, while TLS 1.3 ensures transport data confidentiality.'
  },

  'css-virtual-lab': {
    labRepo: 'css-virtual-lab',
    heroTitle: 'Volumetric DoS & Distributed DDoS Mitigation Architecture',
    heroDescription: 'Implement tiered rate-limiting, edge scrubbing centers, and protocol validation to maintain application responsiveness during large-scale denial of service attacks.',
    defenses: [
      {
        id: 'token_bucket',
        title: 'Token Bucket & Leaky Bucket Rate Limiting',
        subtitle: 'Nginx limit_req / Envoy rate_limit',
        description: 'Regulates incoming request volume by granting execution tokens at a steady rate. Excess requests from aggressive clients are immediately rejected with HTTP 429 (Too Many Requests).',
        command: 'limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;',
        defaultActive: true
      },
      {
        id: 'anycast',
        title: 'Anycast BGP Edge Scrubbing Network',
        subtitle: 'Cloudflare / Cloud Armor / AWS Shield',
        description: 'Broadcasts the application IP address globally via BGP Anycast, distributing attack traffic across dozens of geographically proximate data centers to absorb terabits of volumetric flood.',
        command: 'BGP Anycast Route Announcement (AS-Path Prepended)',
        defaultActive: true
      },
      {
        id: 'captcha',
        title: 'Managed Behavioral Challenge (Turnstile / CAPTCHA)',
        subtitle: 'Layer 7 Botnet filtering',
        description: 'Requires anomalous browser sessions to solve non-intrusive cryptographic challenges, filtering automated botnet HTTP flood scripts from real human visitors.',
        command: 'cf-turnstile-verify-endpoint',
        defaultActive: true
      },
      {
        id: 'synproxy',
        title: 'Linux Netfilter SYNPROXY',
        subtitle: 'Kernel-level connection gating',
        description: 'Terminates initial TCP handshakes inside the Linux kernel netfilter without contacting the backend web server until the client completes a valid three-way handshake.',
        command: 'sudo iptables -t raw -A PREROUTING -p tcp -m tcp --syn -j CT --notrack',
        defaultActive: false
      }
    ],
    metrics: [
      { name: 'Server Availability', unmitigated: '0% (Offline 503)', mitigated: '99.9% Online', improvement: 'High Availability' },
      { name: 'Average Response Latency', unmitigated: '2,800 ms (Timeout)', mitigated: '32 ms (Normal)', improvement: '-98.8% Latency' },
      { name: 'Server CPU Saturation', unmitigated: '100% (Kernel Lock)', mitigated: '18% Utilization', improvement: 'Load Normalized' },
      { name: 'Botnet Request Ingestion', unmitigated: '10,000 req/s to Origin', mitigated: 'Filtered at Edge (99.4%)', improvement: 'Scrubbed' }
    ],
    summaryTitle: 'DDoS Resilience: Edge Scrubbing & Rate Limiting Active',
    summaryDescription: 'Automated challenges and token bucket filters preserve origin server resources while discarding malicious traffic.'
  },

  'trojan-horse-mcp': {
    labRepo: 'trojan-horse-mcp',
    heroTitle: 'Sandbox Containment & Least-Privilege Execution Defenses',
    heroDescription: 'Enforce strict container sandboxing, capability dropping, and syscall filtering to isolate deceptive software and prevent host compromise.',
    defenses: [
      {
        id: 'cap_drop',
        title: 'Linux Kernel Capability Dropping',
        subtitle: '--cap-drop=ALL --security-opt=no-new-privileges',
        description: 'Strips all root capabilities from the executing container process, preventing privilege escalation and kernel exploit execution even if attacker commands run as root inside the container.',
        command: 'docker run --cap-drop=ALL --security-opt=no-new-privileges:true ...',
        defaultActive: true
      },
      {
        id: 'readonly_fs',
        title: 'Read-Only Root Filesystem with tmpfs',
        subtitle: '--read-only --tmpfs /tmp',
        description: 'Mounts the root container filesystem as strictly read-only, preventing malicious droppers from downloading, compiling, or persisting secondary malware implants on disk.',
        command: 'docker run --read-only --tmpfs /tmp:rw,noexec,nosuid ...',
        defaultActive: true
      },
      {
        id: 'loopback_bind',
        title: 'Strict Loopback Binding (127.0.0.1)',
        subtitle: 'Restricting network attack surface',
        description: 'Binds local Model Context Protocol (MCP) server sockets strictly to 127.0.0.1, preventing remote attackers on the local network from accessing exposed tool execution ports.',
        command: 'server.listen(7331, "127.0.0.1")',
        defaultActive: true
      },
      {
        id: 'seccomp',
        title: 'Seccomp Syscall Whitelisting',
        subtitle: '--security-opt seccomp=profile.json',
        description: 'Blocks sensitive Linux system calls (e.g. ptrace, mount, bpf) at the kernel level, confining containerized code strictly to standard computation and I/O.',
        command: 'docker run --security-opt seccomp=/etc/docker/strict.json ...',
        defaultActive: false
      }
    ],
    metrics: [
      { name: 'Host Filesystem Exposure', unmitigated: 'Full Host RW Access', mitigated: 'Zero Host Access (Isolated)', improvement: 'Blast Radius Contained' },
      { name: 'Reverse Shell Persistence', unmitigated: 'Persistent Crontab', mitigated: 'Disposable Container (Ephemeral)', improvement: 'Zero Persistence' },
      { name: 'Network Attack Surface', unmitigated: 'Exposed to LAN (0.0.0.0)', mitigated: 'Localhost Only (127.0.0.1)', improvement: 'Restricted Interface' },
      { name: 'Privilege Escalation Potential', unmitigated: 'High (Host root)', mitigated: 'Blocked (No-New-Privileges)', improvement: 'Capabilities Stripped' }
    ],
    summaryTitle: 'Sandbox Containment: Host Environment Secured',
    summaryDescription: 'Disposable container boundaries and capability restrictions isolate deceptive code from host resources.'
  }
}

export function getDefensesForLab(repoName: string): LabDefenseData {
  if (LAB_DEFENSES[repoName]) {
    return LAB_DEFENSES[repoName]
  }
  return LAB_DEFENSES.css_mini
}
