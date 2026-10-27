# Theory — DoS and DDoS Attacks & Defense Mechanisms

## 1. Denial of Service (DoS)
A Denial of Service (DoS) attack aims to disrupt normal operations of a targeted server, service, or network by overwhelming it with a flood of illegitimate requests or exploiting protocol vulnerabilities to exhaust server resources (CPU, RAM, network bandwidth, socket queues).

## 2. Distributed Denial of Service (DDoS)
A Distributed Denial of Service (DDoS) attack achieves resource exhaustion using multiple compromised computer systems (a *botnet*) distributed across global networks. Because requests originate from hundreds or thousands of distinct IP addresses:
* Simple single-IP rate-limiting or firewall drop rules are insufficient.
* Distinguishing legitimate traffic from attack traffic becomes computationally challenging.

## 3. Attack Vectors Simulated
* **Volumetric Request Floods**: Overwhelming server HTTP worker pools.
* **TCP SYN Floods**: Exploiting the 3-way handshake to fill the half-open backlog connection queue.
* **UDP Amplification**: Saturating network egress and ingress pipelines.

## 4. Mitigation Strategies
* **Token Bucket / Leaky Bucket Rate Limiting**: Capping the maximum allowable requests per unit time from any given subnet.
* **SYN Cookies**: Encoding TCP state into the Initial Sequence Number (ISN) to eliminate connection queue state allocation.
* **Edge Scrubbing**: Diverting high-volume traffic through cloud scrubbing filters before reaching origin servers.
