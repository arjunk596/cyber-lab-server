# Objectives

1. **Packet Anatomy Analysis**: Dissect Ethernet II frames, IPv4 packets, TCP/UDP headers, and payload data bytes.
2. **Promiscuous Mode Sniffing**: Understand how network interface cards (NICs) operate in normal vs promiscuous mode to capture unsegmented LAN frames.
3. **Cleartext Protocol Inspection**: Observe HTTP, FTP, and DNS packet payloads to identify plaintext credentials and queries.
4. **ARP Spoofing Simulation**: Craft gratuitous ARP replies associating the attacker's MAC address with the default gateway IP, poisoning peer ARP caches to redirect traffic through the sniffer.
5. **Protocol Encryption Comparison**: Analyze the transition from plaintext HTTP to TLS 1.3 encrypted handshakes, demonstrating why eavesdroppers can only observe ciphertext records.
