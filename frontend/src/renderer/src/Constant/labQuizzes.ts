export interface QuizQuestion {
  id: number
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface LabQuizData {
  labRepo: string
  labTitle: string
  questions: QuizQuestion[]
}

export const LAB_QUIZZES: Record<string, LabQuizData> = {
  // 1. SYN Flood Lab
  css_mini: {
    labRepo: 'css_mini',
    labTitle: 'TCP SYN Flood Attack & Defense Simulation',
    questions: [
      {
        id: 1,
        question: 'Which TCP flag combination is sent by the attacker during a classic SYN flood attack?',
        options: [
          'SYN flag set, followed by immediate ACK',
          'SYN flag only, without completing the handshake with an ACK',
          'FIN flag only, to terminate existing connections',
          'RST flag combined with PSH'
        ],
        correctIndex: 1,
        explanation: 'In a SYN flood, the attacker transmits numerous TCP SYN packets with spoofed source IPs and deliberately never sends the final ACK, leaving connections half-open in the SYN_RECEIVED state.'
      },
      {
        id: 2,
        question: 'What kernel data structure is exhausted when a server is overwhelmed by a SYN flood attack?',
        options: [
          'Routing table buffer',
          'DNS cache table',
          'TCP listen backlog queue (half-open connection table)',
          'ARP cache table'
        ],
        correctIndex: 2,
        explanation: 'The server allocates a Transmission Control Block (TCB) in its TCP listen backlog queue for each incoming SYN. When this queue reaches maximum capacity, all subsequent legitimate connection attempts are dropped.'
      },
      {
        id: 3,
        question: 'How do SYN Cookies (RFC 4987) prevent backlog queue exhaustion?',
        options: [
          'By dropping all incoming packets on port 80',
          'By encoding state into the Initial Sequence Number (ISN) and avoiding local memory allocation until the final ACK arrives',
          'By encrypting the entire payload using AES-256',
          'By disconnecting the network interface automatically'
        ],
        correctIndex: 1,
        explanation: 'SYN Cookies calculate an Initial Sequence Number based on a cryptographic hash of source IP, port, timestamp, and MSS. The server stores zero state in memory until the client returns the valid ACK containing that sequence number + 1.'
      },
      {
        id: 4,
        question: 'Which Linux sysctl parameter controls the maximum length of the TCP half-open connection backlog queue?',
        options: [
          'net.ipv4.tcp_max_syn_backlog',
          'net.ipv4.ip_forward',
          'net.core.rmem_default',
          'fs.file-max'
        ],
        correctIndex: 0,
        explanation: 'net.ipv4.tcp_max_syn_backlog dictates the maximum number of queued connection requests that have not yet received an acknowledgment from the connecting client.'
      },
      {
        id: 5,
        question: 'Why does reducing net.ipv4.tcp_synack_retries from 5 to 1 help mitigate half-open connection accumulation?',
        options: [
          'It permanently blocks all retransmissions across the entire Internet',
          'It releases abandoned half-open sockets in approximately 3 seconds instead of 63+ seconds',
          'It forces clients to use UDP instead of TCP',
          'It reboots the network card after every drop'
        ],
        correctIndex: 1,
        explanation: 'Each SYN-ACK retry uses exponential backoff. Reducing retries to 1 frees up orphaned half-open sockets after ~3 seconds, recovering backlog capacity significantly faster.'
      }
    ]
  },

  // 2. RSA Cryptosystem Lab
  'CSS-lab-simulation': {
    labRepo: 'CSS-lab-simulation',
    labTitle: 'RSA Public Key Cryptosystem & Key Exchange',
    questions: [
      {
        id: 1,
        question: 'In RSA key generation, how is Euler\'s totient function φ(n) calculated for distinct primes p and q?',
        options: [
          'φ(n) = p * q',
          'φ(n) = (p - 1) * (q - 1)',
          'φ(n) = p + q - 1',
          'φ(n) = (p + 1) * (q + 1)'
        ],
        correctIndex: 1,
        explanation: 'Since p and q are prime numbers, φ(p) = p - 1 and φ(q) = q - 1. Because the totient function is multiplicative for coprime integers, φ(n) = (p - 1)(q - 1).'
      },
      {
        id: 2,
        question: 'What mathematical condition must the public exponent e satisfy in relation to φ(n)?',
        options: [
          'e must be equal to φ(n)',
          'e must divide φ(n) evenly',
          '1 < e < φ(n) and gcd(e, φ(n)) = 1 (coprime to φ(n))',
          'e must be a multiple of n'
        ],
        correctIndex: 2,
        explanation: 'The public exponent e must be coprime to φ(n) (gcd(e, φ(n)) = 1) so that a unique modular multiplicative inverse d ≡ e⁻¹ (mod φ(n)) exists.'
      },
      {
        id: 3,
        question: 'Given ciphertext c, public key (e, n), and private key (d, n), what is the RSA decryption formula?',
        options: [
          'm ≡ c * d (mod n)',
          'm ≡ cᵈ (mod n)',
          'm ≡ (c + d) (mod φ(n))',
          'm ≡ cᵉ (mod n)'
        ],
        correctIndex: 1,
        explanation: 'Decryption is performed by computing m ≡ cᵈ (mod n). By Euler\'s totient theorem, (mᵉ)ᵈ ≡ m¹ ≡ m (mod n).'
      },
      {
        id: 4,
        question: 'Why is textbook (unpadded) RSA vulnerable to a Chosen Ciphertext Attack (CCA)?',
        options: [
          'Because textbook RSA is multiplicatively malleable: (m1 * m2)ᵉ ≡ c1 * c2 (mod n)',
          'Because prime numbers can be easily guessed by brute force',
          'Because private key d is transmitted over the wire in plaintext',
          'Because modular arithmetic cannot operate on large numbers'
        ],
        correctIndex: 0,
        explanation: 'Textbook RSA is homomorphic/malleable: multiplying ciphertext c by sᵉ (mod n) produces a valid ciphertext for message (m * s). The decryption oracle decrypts it to m\' = m * s, allowing the attacker to compute m = m\' * s⁻¹.'
      },
      {
        id: 5,
        question: 'Which standardized padding scheme should be used with RSA encryption to prevent Chosen Ciphertext Attacks?',
        options: [
          'Zero-padding',
          'PKCS#1 v1.5 with static bytes',
          'Optimal Asymmetric Encryption Padding (OAEP, PKCS#1 v2.1)',
          'DES S-Box padding'
        ],
        correctIndex: 2,
        explanation: 'RSA-OAEP adds asymmetric randomized feistel-network padding to the plaintext before exponentiation, ensuring semantic security (indistinguishability under CCA2).'
      }
    ]
  },

  // 3. Buffer Overflow Lab
  'CSS-LAB-BOA': {
    labRepo: 'CSS-LAB-BOA',
    labTitle: 'Buffer Overflow Attack: Stack Smashing & Control Flow Hijacking',
    questions: [
      {
        id: 1,
        question: 'In x86 cdecl architecture, in which direction does the call stack grow in memory?',
        options: [
          'From low memory addresses toward high memory addresses',
          'From high memory addresses downward toward low memory addresses',
          'Horizontally across CPU registers only',
          'Randomly depending on the compiler'
        ],
        correctIndex: 1,
        explanation: 'On x86 architectures, the call stack grows downward from high memory addresses toward lower memory addresses as stack frames are pushed.'
      },
      {
        id: 2,
        question: 'Why is the C standard library function gets() considered fundamentally insecure?',
        options: [
          'It only accepts encrypted strings',
          'It performs no bounds checking on input length and writes until a newline or EOF is found',
          'It requires root privileges to execute',
          'It cannot read characters larger than 8 bits'
        ],
        correctIndex: 1,
        explanation: 'gets() does not take a buffer size parameter. Any input longer than the destination buffer will overwrite adjacent memory on the stack, smashing variables, saved EBP, and the return address.'
      },
      {
        id: 3,
        question: 'What critical register contains the instruction pointer (address of the next instruction to execute) on 32-bit x86 CPUs?',
        options: ['ESP', 'EAX', 'EBP', 'EIP'],
        correctIndex: 3,
        explanation: 'EIP (Extended Instruction Pointer) points to the next machine instruction. When a buffer overflow overwrites the Saved Return Address on the stack, the ret instruction loads that corrupted value directly into EIP.'
      },
      {
        id: 4,
        question: 'In an x86 Little-Endian architecture, how is the 32-bit hexadecimal address 0x080484a0 stored in memory bytes?',
        options: [
          '\\x08\\x04\\x84\\xa0',
          '\\xa0\\x84\\x04\\x08',
          '\\x00\\x08\\x04\\x84',
          '\\x84\\x04\\x08\\xa0'
        ],
        correctIndex: 1,
        explanation: 'Little-endian stores the least significant byte at the lowest memory address. Therefore 0x080484a0 is stored as bytes \\xa0 \\x84 \\x04 \\x08.'
      },
      {
        id: 5,
        question: 'How do compiler Stack Canaries (-fstack-protector) defend against stack-based buffer overflows?',
        options: [
          'By encrypting all source code files at compile time',
          'By placing a secret guard value immediately before the return address and checking it before function return',
          'By prohibiting the allocation of character arrays',
          'By making the CPU run at double clock frequency'
        ],
        correctIndex: 1,
        explanation: 'A stack canary is a random value placed between local buffers and the saved frame pointer/return address. Before returning, the function verifies the canary has not changed; if corrupted, it terminates execution immediately (stack smashing detected).'
      }
    ]
  },

  // 4. Packet Sniffing & ARP Spoofing Lab
  packet_spoofing: {
    labRepo: 'packet_spoofing',
    labTitle: 'Packet Sniffing, ARP Spoofing & Protocol Analysis',
    questions: [
      {
        id: 1,
        question: 'What is the purpose of enabling "Promiscuous Mode" on a Network Interface Card (NIC)?',
        options: [
          'To increase transmission speed over Ethernet',
          'To capture all Ethernet frames on the network segment regardless of destination MAC address',
          'To encrypt outbound TCP packet headers',
          'To block incoming broadcast packets'
        ],
        correctIndex: 1,
        explanation: 'Normally, a NIC discards frames whose destination MAC does not match its own. Promiscuous mode instructs the NIC to pass all incoming frames to the operating system packet sniffer.'
      },
      {
        id: 2,
        question: 'At which OSI layer does the Address Resolution Protocol (ARP) operate?',
        options: [
          'Layer 2 (Data Link Layer) mapping IP addresses to MAC addresses',
          'Layer 4 (Transport Layer) establishing TCP handshakes',
          'Layer 7 (Application Layer) resolving domain names to IPs',
          'Layer 1 (Physical Layer) encoding digital bitstreams'
        ],
        correctIndex: 0,
        explanation: 'ARP operates at the Data Link / Network interface boundary (Layer 2) to resolve 32-bit IPv4 addresses into 48-bit Ethernet MAC hardware addresses.'
      },
      {
        id: 3,
        question: 'Why does ARP Spoofing (ARP Cache Poisoning) succeed on traditional Ethernet local area networks?',
        options: [
          'Because ARP packets are encrypted with AES-128',
          'Because ARP is stateless and clients accept unsolicited Gratuitous ARP replies without authentication',
          'Because routers drop all ARP request packets',
          'Because MAC addresses can only be changed by network administrators'
        ],
        correctIndex: 1,
        explanation: 'ARP lacks authentication. When an attacker broadcasts a gratuitous ARP reply claiming the gateway IP belongs to the attacker\'s MAC, peer hosts blindly update their ARP tables.'
      },
      {
        id: 4,
        question: 'What information is exposed to a packet sniffer when inspecting unencrypted HTTP traffic?',
        options: [
          'Only packet lengths, with contents fully hidden',
          'Full plaintext URLs, HTTP headers, cookies, and POST body credentials',
          'Nothing, because Ethernet frames are always encrypted',
          'Only cryptographic handshake tokens'
        ],
        correctIndex: 1,
        explanation: 'HTTP transmits all application data in cleartext. Any sniffer on the LAN segment can read plaintext usernames, passwords, session cookies, and request bodies.'
      },
      {
        id: 5,
        question: 'Which network security feature on managed switches validates ARP packets against DHCP snooping bindings?',
        options: [
          'Dynamic ARP Inspection (DAI)',
          'Spanning Tree Protocol (STP)',
          'Network Address Translation (NAT)',
          'Virtual Router Redundancy Protocol (VRRP)'
        ],
        correctIndex: 0,
        explanation: 'Dynamic ARP Inspection (DAI) inspects all ARP requests and responses on untrusted switch ports and drops invalid ARP packets that do not match the trusted DHCP snooping database.'
      }
    ]
  },

  // 5. DoS & DDoS Lab
  'css-virtual-lab': {
    labRepo: 'css-virtual-lab',
    labTitle: 'Virtual Network Security Lab: DoS & DDoS Attacks and Mitigation',
    questions: [
      {
        id: 1,
        question: 'What is the fundamental architectural difference between a DoS attack and a DDoS attack?',
        options: [
          'DoS attacks only target UDP, while DDoS attacks only target TCP',
          'A DoS attack originates from a single source host, while a DDoS attack leverages multiple distributed hosts (botnets)',
          'DDoS attacks can only be launched by government agencies',
          'A DoS attack involves physical wire disconnection'
        ],
        correctIndex: 1,
        explanation: 'A Denial of Service (DoS) attack originates from one host, making source IP filtering relatively easy. A Distributed DoS (DDoS) leverages hundreds or thousands of compromised hosts (botnets) distributed globally.'
      },
      {
        id: 2,
        question: 'Why are simple IP-based blacklists ineffective against Distributed Denial of Service (DDoS) attacks?',
        options: [
          'Because IP addresses cannot be blocked by modern firewalls',
          'Because traffic originates from thousands of disparate, constantly shifting IP addresses',
          'Because DDoS attacks do not use IP packets',
          'Because blacklists disable web server SSL certificates'
        ],
        correctIndex: 1,
        explanation: 'In a botnet DDoS, blocking individual IPs fails because attack traffic is distributed across thousands of compromised devices, and blocking entire subnets causes immense collateral damage to legitimate users.'
      },
      {
        id: 3,
        question: 'What is an Application-Layer (Layer 7) HTTP GET flood?',
        options: [
          'Sending malformed electrical signals across coaxial cables',
          'Flooding the web server with high volumes of seemingly legitimate HTTP requests that force intensive backend processing',
          'Exhausting switch TCAM tables with random MAC addresses',
          'Intercepting DNS queries with spoofed responses'
        ],
        correctIndex: 1,
        explanation: 'Layer 7 HTTP floods send valid HTTP requests that consume server worker threads, database connections, and CPU resources, mimicking authentic visitors and bypassing Layer 4 firewalls.'
      },
      {
        id: 4,
        question: 'Which mitigation algorithm limits the rate of incoming requests by granting tokens at a sustained rate?',
        options: [
          'Token Bucket / Leaky Bucket Algorithm',
          'Dijkstra\'s Shortest Path Algorithm',
          'RSA Key Exponentiation',
          'Bellman-Ford Algorithm'
        ],
        correctIndex: 0,
        explanation: 'Token bucket algorithms regulate bursty network traffic by replenishing tokens at a fixed rate, dropping or queuing requests that exceed the available token allowance.'
      },
      {
        id: 5,
        question: 'How do Anycast DNS and Anycast BGP routing help absorb volumetric DDoS attacks?',
        options: [
          'By shutting down DNS servers during an incident',
          'By routing traffic to the topologically closest data center among globally distributed scrubbing centers, dispersing the load',
          'By converting all IPv4 addresses into IPv6 addresses',
          'By requiring password authentication for all web requests'
        ],
        correctIndex: 1,
        explanation: 'Anycast announces the same IP address from multiple geographically diverse nodes. Attack traffic is naturally partitioned and absorbed across dozens of regional scrubbing centers instead of crushing one origin server.'
      }
    ]
  },

  // 6. Trojan Horse Lab
  'trojan-horse-mcp': {
    labRepo: 'trojan-horse-mcp',
    labTitle: 'Trojan Horse via MCP Server (Sandboxed Malware Propagation)',
    questions: [
      {
        id: 1,
        question: 'What defines a "Trojan Horse" in cybersecurity classification?',
        options: [
          'Malware that self-replicates across networks without user interaction',
          'Malicious code disguised as or embedded within legitimate, desirable software',
          'A hardware defect in microprocessors',
          'A specialized firewall used in server racks'
        ],
        correctIndex: 1,
        explanation: 'Unlike worms that spread autonomously, a Trojan horse relies on social engineering or developer convenience, appearing as a useful tool (e.g. an MCP server or utility) while harboring hidden malicious functionality.'
      },
      {
        id: 2,
        question: 'What is a "Reverse Shell" payload?',
        options: [
          'A shell session where the target machine initiates an outbound connection back to the attacker\'s listener',
          'A command line interface that only accepts reversed text strings',
          'A protocol that decrypts passwords backwards',
          'An operating system feature that reverses CPU cycles'
        ],
        correctIndex: 0,
        explanation: 'Most firewalls block inbound connection attempts. A reverse shell bypasses this restriction by having the compromised target establish an outbound TCP connection to the attacker\'s listening port.'
      },
      {
        id: 3,
        question: 'Why does container sandboxing (Docker) limit the blast radius of a compromised tool or MCP server?',
        options: [
          'Because containers prevent memory allocation',
          'Because the process runs in an isolated namespace without mounting the host root filesystem or host credentials',
          'Because containers make network connections impossible',
          'Because containers automatically delete all files every second'
        ],
        correctIndex: 1,
        explanation: 'Containers utilize Linux kernel cgroups and namespaces to isolate processes. If the host filesystem is not mounted and privileges are dropped, the attacker remains confined to the disposable container filesystem.'
      },
      {
        id: 4,
        question: 'Why is binding a local developer service strictly to 127.0.0.1 safer than binding to 0.0.0.0?',
        options: [
          '127.0.0.1 is accessible only from the local host loopback interface, preventing remote LAN attackers from connecting',
          '127.0.0.1 encrypts all data automatically',
          '0.0.0.0 is an invalid IP address',
          '127.0.0.1 doubles the data transfer bandwidth'
        ],
        correctIndex: 0,
        explanation: 'Binding to 0.0.0.0 exposes the socket on all network interfaces (Ethernet, Wi-Fi, LAN). Binding to 127.0.0.1 restricts socket communication strictly to processes running on the local machine.'
      },
      {
        id: 5,
        question: 'Which defensive security principle dictates that software should only possess the minimum privileges necessary to perform its intended function?',
        options: [
          'Principle of Defense in Depth',
          'Principle of Least Privilege (PoLP)',
          'Kerckhoffs\'s Principle',
          'Open-Closed Principle'
        ],
        correctIndex: 1,
        explanation: 'The Principle of Least Privilege states that every module, user, and process must be restricted to only the resources and permissions indispensably required for legitimate operation.'
      }
    ]
  }
}

export function getQuizForLab(repoName: string): LabQuizData {
  if (LAB_QUIZZES[repoName]) {
    return LAB_QUIZZES[repoName]
  }
  // Generic fallback if unknown repo
  return {
    labRepo: repoName,
    labTitle: 'Cybersecurity Laboratory Assessment',
    questions: [
      {
        id: 1,
        question: 'What is the primary educational goal of conducting hands-on cybersecurity experiments in isolated sandboxes?',
        options: [
          'To attack unauthorized production servers without detection',
          'To safely observe vulnerability mechanics, analyze system degradation, and verify defensive mitigations',
          'To bypass local antivirus scanning software',
          'To replace traditional networking equipment'
        ],
        correctIndex: 1,
        explanation: 'Sandbox environments provide an ethical, safe environment to evaluate attack vectors, analyze telemetry, and validate countermeasures without harming real production systems.'
      },
      {
        id: 2,
        question: 'Which of the following represents a proactive defensive measure rather than a reactive measure?',
        options: [
          'Restoring backups after a ransomware attack has completed',
          'Hardening system configurations, applying security patches, and enforcing least privilege before deployment',
          'Reviewing server crash dump logs after an outage',
          'Reporting an incident to insurance carriers'
        ],
        correctIndex: 1,
        explanation: 'Proactive defense addresses vulnerabilities prior to exploitation through system hardening, secure programming, and least-privilege configurations.'
      }
    ]
  }
}
