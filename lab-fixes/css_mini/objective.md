# Objectives

1. **Protocol Analysis**: Examine the TCP three-way handshake sequence (`SYN` &rarr; `SYN-ACK` &rarr; `ACK`) and state machine transitions (`LISTEN`, `SYN_RECEIVED`, `ESTABLISHED`).
2. **Backlog Queue Depletion**: Demonstrate how spoofed `SYN` packets with unreachable source addresses leave connections in `SYN_RECEIVED` state until timeouts expire.
3. **Denial of Service Observation**: Measure how queue saturation rejects incoming connections from legitimate clients, dropping service availability to zero.
4. **SYN Cookie Defense**: Activate stateless cryptographic SYN cookie validation to eliminate the need for server memory allocation prior to handshake completion.
5. **Mitigation Trade-Offs**: Compare performance under standard TCP queues vs SYN Cookies vs IP filtering under high packet rates.
