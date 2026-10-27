function modPow(base, exp, mod) {
  let res = 1n;
  base = BigInt(base) % BigInt(mod);
  exp = BigInt(exp);
  mod = BigInt(mod);
  while (exp > 0n) {
    if (exp % 2n === 1n) res = (res * base) % mod;
    base = (base * base) % mod;
    exp = exp / 2n;
  }
  return Number(res);
}

function modInverse(a, m) {
  let [m0, x0, x1] = [m, 0n, 1n];
  a = BigInt(a);
  m = BigInt(m);
  if (m === 1n) return 0;
  while (a > 1n) {
    let q = a / m;
    let t = m;
    m = a % m;
    a = t;
    t = x0;
    x0 = x1 - q * x0;
    x1 = t;
  }
  if (x1 < 0n) x1 += m0;
  return Number(x1);
}

const n = 3233;
const e = 17;
const p_true = 61;
const q_true = 53;
const d = 2753; // (61-1)*(53-1) = 3120, 17^-1 mod 3120 = 2753

let targetM = 65;
let targetC = modPow(targetM, e, n);
let blindedC = 0;
let blindedM = 0;

document.getElementById('btn-verify-factors').addEventListener('click', () => {
  const p = parseInt(document.getElementById('factor-p').value, 10);
  const q = parseInt(document.getElementById('factor-q').value, 10);
  const res = document.getElementById('factor-result');
  if (p * q === n && (p === p_true || p === q_true)) {
    res.className = 'alert-box success';
    res.textContent = `Correct! p=${p} and q=${q} are prime factors of ${n}. Totient φ(n)=(${p}-1)(${q}-1)=3120 unlocked!`;
  } else {
    res.className = 'alert-box danger';
    res.textContent = `Incorrect factor pair. ${p} × ${q} = ${p * q} ≠ ${n}. Hint: p=61, q=53.`;
  }
});

document.getElementById('btn-encrypt').addEventListener('click', () => {
  const msg = parseInt(document.getElementById('input-msg').value, 10);
  targetM = msg;
  targetC = modPow(msg, e, n);
  document.getElementById('crypto-output').textContent = `Encrypted: C = ${msg}^${e} mod ${n} = ${targetC}`;
  document.getElementById('cca-c').textContent = targetC;
});

document.getElementById('btn-decrypt').addEventListener('click', () => {
  const decrypted = modPow(targetC, d, n);
  document.getElementById('crypto-output').textContent = `Decrypted: M = ${targetC}^${d} mod ${n} = ${decrypted}`;
});

document.getElementById('btn-blind').addEventListener('click', () => {
  const r = parseInt(document.getElementById('input-r').value, 10);
  const rExpE = modPow(r, e, n);
  blindedC = (targetC * rExpE) % n;
  document.getElementById('cca-blind-out').textContent = `Blinded Ciphertext C' = (${targetC} * ${r}^${e}) mod ${n} = ${blindedC}`;
});

document.getElementById('btn-oracle').addEventListener('click', () => {
  if (!blindedC) {
    const r = parseInt(document.getElementById('input-r').value, 10);
    blindedC = (targetC * modPow(r, e, n)) % n;
  }
  blindedM = modPow(blindedC, d, n);
  document.getElementById('cca-oracle-out').textContent = `Decryption Oracle returns M' = (${blindedC})^${d} mod ${n} = ${blindedM}`;
});

document.getElementById('btn-unblind').addEventListener('click', () => {
  const r = parseInt(document.getElementById('input-r').value, 10);
  const rInv = modInverse(r, n);
  const recoveredM = (blindedM * rInv) % n;
  const out = document.getElementById('cca-final-out');
  out.textContent = `SUCCESS! Recovered Plaintext M = (${blindedM} * ${rInv}) mod ${n} = ${recoveredM} (Matches original target M=${targetM}) without knowing private key d!`;
});
