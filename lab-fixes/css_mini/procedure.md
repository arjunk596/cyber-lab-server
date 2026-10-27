# Procedure

## Requirements
* Docker & Docker Compose (`docker compose version`)
* Modern Web Browser

## Step 1 — Start the Simulation Container
Run the containerized laboratory:

```bash
docker compose up -d
```

The lab binds to `http://localhost:8081`.

## Step 2 — Initial Server Baseline
1. Open `http://localhost:8081` in your browser.
2. Observe the simulated server state:
   - Server status: `Online`
   - TCP Backlog Queue capacity: `128 slots` (0 slots utilized)
   - Connection availability: `100%`

## Step 3 — Launch the SYN Flood
1. Move the attack slider to set packet generation rate (e.g. 1000 SYN/sec).
2. Click **Start Attack**.
3. Watch the half-open connection queue fill rapidly to 128/128 (`SYN_RECEIVED`).
4. Attempt a legitimate client connection and verify that incoming packets are dropped (`Connection Refused / Timed Out`).

## Step 4 — Activate SYN Cookies Defense
1. In the defenses panel, toggle **SYN Cookies (RFC 4987)** to `ON`.
2. Notice the memory backlog queue frees up immediately as stateless hashing replaces per-socket allocation.
3. Verify that legitimate connections succeed again, maintaining 100% availability even while attack packets persist.

## Step 5 — Teardown
```bash
docker compose down
```
