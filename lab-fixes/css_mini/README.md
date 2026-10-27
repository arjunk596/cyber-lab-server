# SYN Flood Virtual Lab

A browser-based educational simulation demonstrating how an attacker initiates half-open TCP connections in a SYN Flood attack to deplete a server's backlog connection queue, and how countermeasures such as SYN Cookies, rate limiting, and queue timeout tuning restore network availability.

## Technical Architecture
- **TCP Backlog Queue Model**: 100-slot half-open connection table.
- **Dynamic Arrival Simulation**: Legitimate vs attack SYN arrival rates.
- **Mitigation Mechanisms**: SYN Cookies (RFC 4987), Token Bucket Rate Limiting, and SYN-ACK Retry Tuning.
