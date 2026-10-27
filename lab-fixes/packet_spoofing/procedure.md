# Procedure

## Requirements
* Docker & Docker Compose (`docker compose version`)
* Modern Web Browser

## Step 1 — Start the Laboratory
Run the containerized laboratory:

```bash
docker compose up -d
```

The laboratory portal binds to `http://localhost:3000`.

## Step 2 — Promiscuous Mode & Packet Anatomy
1. Open `http://localhost:3000` in your browser.
2. Navigate to **Module 1: Promiscuous Mode & Packet Anatomy**.
3. Toggle promiscuous mode `ON` and inspect incoming Ethernet frames, source/destination MAC addresses, IP headers, and packet payloads.

## Step 3 — HTTP vs HTTPS Traffic Interception
1. Navigate to **Module 2: Cleartext Inspection**.
2. Trigger simulated HTTP authentication and observe username/password fields transmitted in clear text.
3. Switch connection to HTTPS and verify that TLS 1.3 encryption prevents packet inspection.

## Step 4 — ARP Cache Poisoning (MITM)
1. Navigate to **Module 3: ARP Spoofing Sandbox**.
2. Inspect the initial legitimate ARP tables on Client and Gateway.
3. Broadcast spoofed ARP reply packets (`Gateway IP is at Attacker MAC`).
4. Verify the client's ARP cache is poisoned, redirecting all outbound traffic through the attacker's node before reaching the gateway.

## Step 5 — Teardown
```bash
docker compose down
```
