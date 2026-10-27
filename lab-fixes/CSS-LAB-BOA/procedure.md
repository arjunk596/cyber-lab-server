# Procedure

## Requirements
* Docker & Docker Compose (`docker compose version`)
* Modern Web Browser

## Step 1 — Start the Laboratory
Run the Docker Compose stack:

```bash
docker compose up -d
```

The lab web interface binds to `http://localhost:3000`.

## Step 2 — Level 1: Overwriting Local Stack Variables
1. Navigate to Level 1 in the browser UI.
2. Inspect the vulnerable C source code allocating a 16-byte buffer adjacent to a control flag variable.
3. Supply input exceeding 16 bytes (e.g. `AAAAAAAAAAAAAAAA\x01`) to flip the flag variable and unlock Level 2.

## Step 3 — Level 2: Saved Frame Pointer Overwrite
1. Analyze the stack layout in the WebAssembly visualizer.
2. Determine the distance between the start of the buffer and the Saved Frame Pointer (`EBP`).
3. Overwrite the boundary and observe function epilogue behavior.

## Step 4 — Level 3: Instruction Pointer Hijack
1. Identify the memory address of the hidden target function (e.g. `win()`).
2. Construct an exploit payload: `[Padding to Return Address] + [Target Address in Little-Endian Format]`.
3. Send the payload and verify execution redirection to the target function.

## Step 5 — Teardown
```bash
docker compose down
```
