# Objectives

1. **Prime Factorization Vulnerability**: Analyze why knowing secret prime factors $p$ and $q$ completely compromises RSA security by allowing direct computation of Euler's totient $\phi(n)$.
2. **Key Generation**: Compute public and private key pairs $(e, n)$ and $(d, n)$ using Euler's totient and the Extended Euclidean Algorithm:
   $$e \cdot d \equiv 1 \pmod{\phi(n)}$$
3. **Encryption & Decryption Execution**: Perform asymmetric textbook encryption $C = M^e \bmod n$ and verify reversible decryption $M = C^d \bmod n$.
4. **Chosen Ciphertext Attack (CCA) Demonstration**: Exploit the homomorphic property of unpadded RSA:
   - Generate a random blinding factor $R$ coprime to $n$.
   - Calculate blinded ciphertext $C' = (C \cdot R^e) \bmod n$.
   - Submit $C'$ to a Decryption Oracle to obtain $M' = (C')^d \bmod n$.
   - Recover original plaintext without private key $d$:
     $$M = (M' \cdot R^{-1}) \bmod n$$
5. **Mitigation Analysis**: Evaluate how modern padding standards (such as **OAEP** — Optimal Asymmetric Encryption Padding) eliminate algebraic malleability.
