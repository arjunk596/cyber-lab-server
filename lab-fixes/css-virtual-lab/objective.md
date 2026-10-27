# Objectives

1. **Traffic Modeling**: Understand baseline legitimate client request distributions and server capacity thresholds.
2. **Denial of Service (DoS) Execution**: Launch high-volume single-source request floods to saturate server worker threads, observe queue buildup, and measure packet loss.
3. **Distributed Denial of Service (DDoS) Execution**: Coordinate botnet attacks across multiple source IPs to circumvent basic single-IP blacklist filters.
4. **Defense Mechanisms**: Implement and evaluate upstream per-source rate-limiting, IP reputation filtering, and SYN cookie mitigation.
5. **Metric Evaluation**: Quantify server health, throughput degradation, latency spikes, and availability recovery under attack mitigation.
