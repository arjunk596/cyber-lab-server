# Procedure

## Requirements
* Docker & Docker Compose (`docker compose version`)
* Modern Web Browser

## Step 1 — Start the Simulation Container
Run the containerized laboratory:

```bash
docker compose up -d
```

The server binds to `http://localhost:5000`.

## Step 2 — Baseline Normal Traffic
1. Open `http://localhost:5000` in your browser.
2. Under Scenario Selection, select **Normal Traffic Simulation**.
3. Click **Start Simulation** and observe stable server CPU utilization (<15%), 0% packet loss, and full availability.

## Step 3 — Single-Source DoS Attack
1. Switch to the **DoS Attack** scenario.
2. Set attack intensity and launch the flood.
3. Observe server request queue saturation, elevated latency, and dropped legitimate packets.

## Step 4 — Multi-Source DDoS Attack & Mitigation
1. Select the **DDoS Attack** scenario.
2. Observe distributed botnet nodes flooding the target.
3. Enable **Rate-Limiting / Protection Filter** and verify server recovery and legitimate traffic throughput restoration.

## Step 5 — Teardown
```bash
docker compose down
```
