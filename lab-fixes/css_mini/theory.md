# Theory — TCP Handshake Vulnerability & SYN Flood Attacks

## 1. The Normal TCP 3-Way Handshake
Establishing a reliable TCP stream involves three messages:
1. **Client &rarr; Server (`SYN`)**: Client sends a segment with `SYN` flag set and initial sequence number $ISN_c$.
2. **Server &rarr; Client (`SYN-ACK`)**: Server allocates a Transmission Control Block (TCB) in its backlog connection queue, chooses $ISN_s$, and acknowledges: $ACK = ISN_c + 1$.
3. **Client &rarr; Server (`ACK`)**: Client acknowledges $ACK = ISN_s + 1$. Connection transitions to `ESTABLISHED`.

## 2. The Vulnerability
The server allocates state memory (TCB) upon receiving the initial `SYN`, *before* the client proves its identity or completes the handshake.

## 3. The SYN Flood Attack
An attacker floods the victim with high volumes of `SYN` packets with forged (spoofed) source IP addresses:
1. The server receives each `SYN` and allocates backlog memory.
2. The server replies with `SYN-ACK` to spoofed, non-existent, or uncooperative addresses.
3. The server never receives the final `ACK`.
4. The half-open connection stays in the `SYN_RECV` queue for minutes until timeout.
5. The backlog table becomes completely full: all subsequent connection attempts from legitimate users are dropped.

## 4. Defenses
* **SYN Cookies**: The server does NOT allocate a connection table entry upon receiving a `SYN`. Instead, it encodes the connection parameters into the 32-bit $ISN_s$ using a cryptographic hash:
  $$ISN_s = h(\text{src\_ip}, \text{dst\_ip}, \text{ports}, \text{secret}) \pmod{2^{24}} + t$$
  When the legitimate client sends back `ACK`, the server validates the hash and creates the connection dynamically.
* **TCP SYN Cache**: Allocating reduced memory stubs instead of full TCB structures.
* **Reducing SYN-ACK Retries**: Lowering `tcp_synack_retries` to release hung sockets sooner.
