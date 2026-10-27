# Procedure

## Prerequisites
* Docker & Docker Compose (`docker compose version`)
* Modern web browser (Chrome, Firefox, Safari, Edge)

## Step 1 — Start the Laboratory Container
Launch the containerized simulation stack:

```bash
docker compose up -d
```

The lab will start and bind to `http://localhost:8080`.

## Step 2 — Factoring Challenge
1. Open `http://localhost:8080` in your browser.
2. Note the dynamically generated target modulus $n$.
3. Determine the two secret prime factors $p$ and $q$ such that $n = p \times q$.
4. Enter $p$ and $q$ and verify unlock of the key calculation module.

## Step 3 — Key Generation & Encryption
1. Calculate $\phi(n) = (p-1)(q-1)$.
2. Calculate private key exponent $d \equiv e^{-1} \pmod{\phi(n)}$.
3. Enter a plaintext numerical message $M$ ($2 \le M < n$) and compute ciphertext $C = M^e \bmod n$.

## Step 4 — Execute Chosen Ciphertext Attack (CCA)
1. Select a random blinding multiplier $R$.
2. Compute blinded ciphertext $C' = (C \times R^e) \bmod n$.
3. Submit $C'$ to the Decryption Oracle to receive blinded plaintext $M'$.
4. Multiply $M'$ by modular inverse $R^{-1} \pmod n$ to recover the original plaintext message $M$ without knowing $d$.

## Step 5 — Teardown
To stop the lab container:

```bash
docker compose down
```
