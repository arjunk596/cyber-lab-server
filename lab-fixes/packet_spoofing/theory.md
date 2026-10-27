# Theory — Packet Sniffing, Promiscuous Mode & Protocol Analysis

## 1. Network Interface Operation
In standard operation, a Network Interface Card (NIC) examines the destination MAC address of incoming Ethernet frames. It accepts only:
1. Frames addressed directly to its own hardware MAC address.
2. Broadcast frames (`ff:ff:ff:ff:ff:ff`).
3. Registered Multicast frames.
All other frames passing along the network segment are discarded by the hardware filter.

## 2. Promiscuous Mode
When a packet analyzer (e.g., Wireshark, tcpdump, or raw socket listeners) enables **promiscuous mode**, the NIC hardware filter is disabled. The network controller passes every frame transmitted across the physical collision domain or shared network segment up to the operating system kernel for inspection.

## 3. Cleartext Protocols vs Transport Layer Security
Legacy Internet protocols transmit application payload data in unencrypted plaintext:
- **HTTP (Port 80)**: Headers, session cookies (`Set-Cookie`), form inputs, and authentication credentials pass over the wire unshielded.
- **FTP (Port 21)** and **Telnet (Port 23)**: Usernames and passwords are sent in clear text.
- **DNS (Port 53)**: Queries and answers are unencrypted, enabling domain eavesdropping and poisoning.

Under **TLS 1.3 (Transport Layer Security)**:
- Symmetric encryption (e.g., AES-GCM or ChaCha20-Poly1305) protects record layer data.
- Cryptographic handshakes negotiate ephemeral session keys via Elliptic Curve Diffie-Hellman (ECDHE).
- Eavesdroppers observing network packets only see encrypted application data records.

## 4. Address Resolution Protocol (ARP) Poisoning
On local Ethernet networks, IPv4 addresses are resolved to Layer 2 MAC addresses via ARP:
- ARP is stateless and unauthenticated; hosts accept unsolicited gratuitous ARP replies.
- An attacker can broadcast ARP replies claiming to own the IP of the default gateway.
- Switches and hosts update their ARP tables, routing LAN traffic through the attacker's machine (Man-in-the-Middle) prior to forwarding.

## 5. Defensive Countermeasures
- Strict Transport Security (HSTS) and mandatory TLS encryption.
- Dynamic ARP Inspection (DAI) on managed switches with DHCP Snooping.
- Static ARP mappings for critical infrastructure gateways.
