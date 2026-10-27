import React, { useState } from 'react'
import {
  KeyRound,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle2,
  HelpCircle
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../../Sass/Components/RsaExperiment.scss'

export interface RsaExperimentProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let res = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod
    base = (base * base) % mod
    exp = exp / 2n
  }
  return res
}

function modInverse(a: bigint, m: bigint): bigint {
  let [m0, x0, x1] = [m, 0n, 1n]
  if (m === 1n) return 0n
  while (a > 1n) {
    const q = a / m
    let t = m
    m = a % m
    a = t
    t = x0
    x0 = x1 - q * x0
    x1 = t
  }
  if (x1 < 0n) x1 += m0
  return x1
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) {
    const t = b
    b = a % b
    a = t
  }
  return a
}

export const RsaExperiment: React.FC<RsaExperimentProps> = () => {
  // Prime variables
  const [p, setP] = useState<number>(61)
  const [q, setQ] = useState<number>(53)
  const [e, setE] = useState<number>(17)

  // Computed values
  const n = BigInt(p) * BigInt(q)
  const phi = BigInt(p - 1) * BigInt(q - 1)
  const isCoprime = phi > 0n && gcd(BigInt(e), phi) === 1n
  const d = isCoprime ? modInverse(BigInt(e), phi) : 0n

  // Encryption / Decryption Sandbox
  const [msgInput, setMsgInput] = useState<number>(65)
  const [encryptedC, setEncryptedC] = useState<bigint | null>(() => {
    try {
      return modPow(BigInt(65), BigInt(17), BigInt(61 * 53))
    } catch {
      return null
    }
  })
  const [decryptedM, setDecryptedM] = useState<bigint | null>(null)

  // Chosen Ciphertext Attack (CCA) State
  const [ccaStep, setCcaStep] = useState<number>(1)
  const [rBlinding, setRBlinding] = useState<number>(2)
  const [blindedC, setBlindedC] = useState<bigint | null>(null)
  const [oracleDecrypted, setOracleDecrypted] = useState<bigint | null>(null)
  const [recoveredPlaintext, setRecoveredPlaintext] = useState<bigint | null>(null)

  // Factoring Challenge State
  const [factorP, setFactorP] = useState<string>('')
  const [factorQ, setFactorQ] = useState<string>('')
  const [factorResult, setFactorResult] = useState<{ status: 'success' | 'error'; msg: string } | null>(null)

  const handleEncrypt = () => {
    if (!isCoprime || d === 0n) return
    const c = modPow(BigInt(msgInput), BigInt(e), n)
    setEncryptedC(c)
    setDecryptedM(null)
  }

  const handleDecrypt = () => {
    if (!encryptedC || d === 0n) return
    const m = modPow(encryptedC, d, n)
    setDecryptedM(m)
  }

  // CCA Attack Step 1: Blind Ciphertext
  const handleCcaBlind = () => {
    if (!encryptedC) return
    const rBig = BigInt(rBlinding)
    const rExpE = modPow(rBig, BigInt(e), n)
    const cPrime = (encryptedC * rExpE) % n
    setBlindedC(cPrime)
    setCcaStep(2)
  }

  // CCA Attack Step 2: Query Oracle
  const handleCcaQueryOracle = () => {
    if (blindedC === null || d === 0n) return
    // The oracle decrypts C' without knowing it is a blinded target C
    const mPrime = modPow(blindedC, d, n)
    setOracleDecrypted(mPrime)
    setCcaStep(3)
  }

  // CCA Attack Step 3: Unblind and Recover M
  const handleCcaUnblind = () => {
    if (oracleDecrypted === null) return
    const rBig = BigInt(rBlinding)
    const rInv = modInverse(rBig, n)
    const recovered = (oracleDecrypted * rInv) % n
    setRecoveredPlaintext(recovered)
    setCcaStep(4)
  }

  const handleVerifyFactors = () => {
    const pVal = parseInt(factorP, 10)
    const qVal = parseInt(factorQ, 10)
    if (isNaN(pVal) || isNaN(qVal)) {
      setFactorResult({ status: 'error', msg: 'Please enter valid integer factors.' })
      return
    }
    if (pVal * qVal === Number(n) && (pVal === p || pVal === q)) {
      setFactorResult({
        status: 'success',
        msg: `Factoring Successful! Found prime factors p=${pVal} and q=${qVal}. Private key d is compromised!`
      })
    } else {
      setFactorResult({
        status: 'error',
        msg: `Incorrect factor pair. ${pVal} × ${qVal} = ${pVal * qVal} ≠ ${n}. Hint: p=61, q=53.`
      })
    }
  }

  return (
    <div className="rsa-lab-view">
      {/* Parameters & Key Generation Panel */}
      <div className="rsa-card keys-card">
        <div className="card-top-header">
          <div className="header-icon-box">
            <KeyRound size={18} />
          </div>
          <div>
            <h3>RSA Key Generation & Mathematical Foundation</h3>
            <span className="card-subtitle">Asymmetric Key Pair: Public (e, n) & Private (d, n)</span>
          </div>
        </div>

        <div className="keys-grid">
          <div className="key-input-group">
            <label>Prime p:</label>
            <input
              type="number"
              value={p}
              onChange={(e) => setP(parseInt(e.target.value, 10) || 61)}
            />
          </div>
          <div className="key-input-group">
            <label>Prime q:</label>
            <input
              type="number"
              value={q}
              onChange={(e) => setQ(parseInt(e.target.value, 10) || 53)}
            />
          </div>
          <div className="key-input-group">
            <label>Public Exponent e:</label>
            <input
              type="number"
              value={e}
              onChange={(e) => setE(parseInt(e.target.value, 10) || 17)}
            />
          </div>
        </div>

        {/* Computed Mathematical Outputs */}
        <div className="math-readout">
          <div className="readout-item">
            <span className="readout-label">Modulus n = p × q:</span>
            <code className="readout-val">{n.toString()}</code>
          </div>
          <div className="readout-item">
            <span className="readout-label">Totient φ(n) = (p-1)(q-1):</span>
            <code className="readout-val">{phi.toString()}</code>
          </div>
          <div className="readout-item">
            <span className="readout-label">gcd(e, φ(n)) = 1:</span>
            <span className={`readout-status ${isCoprime ? 'good' : 'bad'}`}>
              {isCoprime ? 'Valid Coprime' : 'Invalid (gcd ≠ 1)'}
            </span>
          </div>
          <div className="readout-item">
            <span className="readout-label">Private Key d ≡ e⁻¹ (mod φ):</span>
            <code className="readout-val d-key">{d.toString()}</code>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Encryption Sandbox + Chosen Ciphertext Attack */}
      <div className="rsa-two-col">
        {/* Left Column: Encryption Sandbox */}
        <div className="rsa-card sandbox-card">
          <div className="card-top-header">
            <div className="header-icon-box">
              <Lock size={18} />
            </div>
            <div>
              <h3>Textbook Encryption & Decryption Sandbox</h3>
              <span className="card-subtitle">C ≡ Mᵉ (mod n) &nbsp;•&nbsp; M ≡ Cᵈ (mod n)</span>
            </div>
          </div>

          <div className="sandbox-form">
            <label>Plaintext Message M (Integer 0 &le; M &lt; n):</label>
            <div className="input-action-row">
              <input
                type="number"
                value={msgInput}
                onChange={(e) => setMsgInput(parseInt(e.target.value, 10) || 0)}
              />
              <button type="button" className="rsa-btn encrypt-btn" onClick={handleEncrypt}>
                <Lock size={13} />
                <span>Encrypt M</span>
              </button>
              <button
                type="button"
                className="rsa-btn decrypt-btn"
                onClick={handleDecrypt}
                disabled={encryptedC === null}
              >
                <Unlock size={13} />
                <span>Decrypt C</span>
              </button>
            </div>

            {encryptedC !== null && (
              <div className="crypto-result-box">
                <div className="result-line">
                  <span className="res-tag">Ciphertext C:</span>
                  <code>{encryptedC.toString()}</code>
                </div>
                {decryptedM !== null && (
                  <div className="result-line success">
                    <span className="res-tag">Decrypted M:</span>
                    <code>{decryptedM.toString()}</code>
                    {decryptedM === BigInt(msgInput) && (
                      <span className="match-badge">
                        <CheckCircle2 size={13} /> Plaintext Matched!
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Chosen Ciphertext Attack (CCA) */}
        <div className="rsa-card cca-card">
          <div className="card-top-header">
            <div className="header-icon-box danger-box">
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3>Chosen Ciphertext Attack (CCA) Demonstration</h3>
              <span className="card-subtitle">Exploiting RSA Multiplicative Malleability</span>
            </div>
          </div>

          <p className="cca-desc">
            The attacker intercepts ciphertext <code>C = {encryptedC?.toString() ?? '2790'}</code> but does not have
            private key <code>d</code>. The victim oracle refuses to decrypt <code>C</code>, but can be tricked
            into decrypting a blinded ciphertext <code>C&apos;</code>!
          </p>

          <div className="cca-steps-workflow">
            {/* Step 1: Blinding */}
            <div className={`cca-step-box ${ccaStep >= 1 ? 'active' : ''}`}>
              <div className="step-label">Step 1: Blind the Ciphertext</div>
              <div className="step-actions">
                <span>Blinding factor r:</span>
                <input
                  type="number"
                  value={rBlinding}
                  onChange={(e) => setRBlinding(parseInt(e.target.value, 10) || 2)}
                  style={{ width: 60 }}
                />
                <button type="button" className="rsa-btn" onClick={handleCcaBlind}>
                  Calculate C&apos; = (C × rᵉ) mod n
                </button>
              </div>
              {blindedC !== null && (
                <div className="cca-step-output">
                  Blinded Ciphertext C&apos; = <code>{blindedC.toString()}</code>
                </div>
              )}
            </div>

            {/* Step 2: Query Oracle */}
            <div className={`cca-step-box ${ccaStep >= 2 ? 'active' : ''}`}>
              <div className="step-label">Step 2: Submit Blinded C&apos; to Decryption Oracle</div>
              <button
                type="button"
                className="rsa-btn oracle-btn"
                onClick={handleCcaQueryOracle}
                disabled={blindedC === null}
              >
                Request Decryption Oracle on C&apos;
              </button>
              {oracleDecrypted !== null && (
                <div className="cca-step-output">
                  Oracle returns M&apos; = (C&apos;)ᵈ mod n = <code>{oracleDecrypted.toString()}</code> (where M&apos; = M × r)
                </div>
              )}
            </div>

            {/* Step 3: Unblind */}
            <div className={`cca-step-box ${ccaStep >= 3 ? 'active' : ''}`}>
              <div className="step-label">Step 3: Unblind to Recover Target Plaintext M</div>
              <button
                type="button"
                className="rsa-btn unblind-btn"
                onClick={handleCcaUnblind}
                disabled={oracleDecrypted === null}
              >
                Compute M = (M&apos; × r⁻¹) mod n
              </button>
              {recoveredPlaintext !== null && (
                <div className="cca-step-output victory">
                  <CheckCircle2 size={16} />
                  <span>
                    PWNED! Recovered Secret M = <code>{recoveredPlaintext.toString()}</code> (Zero knowledge of private key d required!)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Factoring Challenge Card */}
      <div className="rsa-card factor-card">
        <div className="card-top-header">
          <div className="header-icon-box">
            <HelpCircle size={18} />
          </div>
          <div>
            <h3>Factoring Challenge: Vulnerability of Small Moduli</h3>
            <span className="card-subtitle">Find the two prime factors of n = {n.toString()}</span>
          </div>
        </div>

        <div className="factor-form">
          <div className="factor-inputs">
            <input
              type="text"
              placeholder="Factor p"
              value={factorP}
              onChange={(e) => setFactorP(e.target.value)}
            />
            <span>&times;</span>
            <input
              type="text"
              placeholder="Factor q"
              value={factorQ}
              onChange={(e) => setFactorQ(e.target.value)}
            />
            <button type="button" className="rsa-btn" onClick={handleVerifyFactors}>
              Verify Prime Factorization
            </button>
          </div>

          {factorResult && (
            <div className={`factor-alert ${factorResult.status}`}>
              {factorResult.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RsaExperiment
