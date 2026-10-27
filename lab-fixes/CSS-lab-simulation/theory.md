# Theory — RSA Cryptosystem & Chosen Ciphertext Attack

## 1. Mathematical Foundation of RSA
The RSA cryptosystem (Rivest, Shamir, and Adleman, 1978) is an asymmetric public-key cryptosystem based on number theory:
1. Two distinct prime numbers $p$ and $q$ are selected.
2. The public modulus is computed: $n = p \cdot q$.
3. Euler's totient function is:
   $$\phi(n) = (p - 1)(q - 1)$$
4. A public exponent $e$ is chosen such that $1 < e < \phi(n)$ and $\gcd(e, \phi(n)) = 1$.
5. The private exponent $d$ is derived as the modular multiplicative inverse of $e$:
   $$d \equiv e^{-1} \pmod{\phi(n)} \iff e \cdot d \equiv 1 \pmod{\phi(n)}$$

## 2. Encryption and Decryption
For a plaintext message $M$ where $0 \le M < n$:
* **Encryption**: $C = M^e \bmod n$
* **Decryption**: $M = C^d \bmod n$

Correctness is guaranteed by Euler's Theorem ($M^{\phi(n)} \equiv 1 \pmod n$ for $\gcd(M, n)=1$).

## 3. Vulnerability 1: Factoring Challenge
The security of RSA rests entirely on the assumption that factoring a large semiprime $n$ into $p$ and $q$ is computationally infeasible. If an adversary discovers $p$ and $q$:
1. They immediately compute $\phi(n) = (p - 1)(q - 1)$.
2. They compute $d \equiv e^{-1} \pmod{\phi(n)}$ using the Extended Euclidean Algorithm.
3. Every ciphertext encrypted under $(e, n)$ can now be decrypted.

## 4. Vulnerability 2: Chosen Ciphertext Attack (CCA)
Textbook RSA is **homomorphic with respect to multiplication**:
$$E(M_1) \cdot E(M_2) \equiv (M_1^e)(M_2^e) \equiv (M_1 \cdot M_2)^e \equiv E(M_1 \cdot M_2) \pmod n$$

An attacker with access to a Decryption Oracle (a service that decrypts arbitrary ciphertexts except the target $C$) can recover $M$ as follows:
1. Choose an arbitrary random multiplier $R$ where $\gcd(R, n) = 1$.
2. Compute $C' = (C \cdot R^e) \bmod n$.
3. Submit $C'$ to the oracle. The oracle decrypts:
   $$M' = (C')^d = (C \cdot R^e)^d \equiv (M^e \cdot R^e)^d \equiv (M \cdot R)^{ed} \equiv M \cdot R \pmod n$$
4. The attacker computes modular inverse $R^{-1} \bmod n$.
5. The attacker recovers original message:
   $$M \equiv M' \cdot R^{-1} \pmod n$$
