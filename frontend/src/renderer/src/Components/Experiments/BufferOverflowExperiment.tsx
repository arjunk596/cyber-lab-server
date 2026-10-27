import React, { useState, useEffect } from 'react'
import {
  Terminal,
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Play,
  Sparkles
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../../Sass/Components/BufferOverflowExperiment.scss'

export interface BufferOverflowExperimentProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

interface StackRow {
  addr: string
  name: string
  bytes: number[]
  target: boolean
}

export const BufferOverflowExperiment: React.FC<BufferOverflowExperimentProps> = () => {
  const [currentLevel, setCurrentLevel] = useState<number>(1)
  const [payloadInput, setPayloadInput] = useState<string>('SecretPassword')
  const [statusState, setStatusState] = useState<{
    type: 'idle' | 'success' | 'danger'
    msg: string
  }>({
    type: 'idle',
    msg: 'Ready. Enter input and click Execute Payload.'
  })

  const [regEBP, setRegEBP] = useState<string>('0xffffcfc0')
  const [regEIP, setRegEIP] = useState<string>('0x0804849b')
  const [stackRows, setStackRows] = useState<StackRow[]>([])

  const levels = {
    1: {
      title: 'Level 1: Overwriting Local Stack Variables',
      desc: 'The vulnerable function allocates a 16-byte buffer adjacent to control variable "authenticated". Overwrite authenticated != 0 to unlock root.',
      code: `void check_auth() {\n  int authenticated = 0;\n  char buffer[16];\n  printf("Enter password: ");\n  gets(buffer); // Vulnerable unbounded write!\n  if (authenticated != 0) {\n    unlock_root();\n  }\n}`,
      suggested: 'AAAAAAAAAAAAAAAA\\x01',
      defaultPayload: 'SecretPassword'
    },
    2: {
      title: 'Level 2: Frame Pointer Overwrite',
      desc: 'Overwrite the Saved Frame Pointer (EBP) to alter the stack frame on function return.',
      code: `void parse_data() {\n  char buffer[16];\n  read(0, buffer, 24);\n  // Can overwrite saved EBP to pivot stack frame!\n}`,
      suggested: 'AAAAAAAAAAAAAAAA\\x20\\xcf\\xff\\xff',
      defaultPayload: 'NormalBufferText'
    },
    3: {
      title: 'Level 3: Return Address (EIP) Hijack',
      desc: 'Supply padding to reach the Saved Return Address and overwrite EIP with 0x080484a0 to jump directly to unlock_root().',
      code: `void vuln() {\n  char buffer[16];\n  gets(buffer);\n  // EIP overwrite redirects execution flow!\n}`,
      suggested: 'AAAAAAAAAAAAAAAAAAAA\\xa0\\x84\\x04\\x08',
      defaultPayload: 'TestPadding12345678'
    }
  }

  const parsePayload = (str: string): number[] => {
    const bytes: number[] = []
    let i = 0
    while (i < str.length) {
      if (str[i] === '\\' && str[i + 1] === 'x' && i + 3 < str.length) {
        const hex = str.substr(i + 2, 2)
        bytes.push(parseInt(hex, 16))
        i += 4
      } else {
        bytes.push(str.charCodeAt(i))
        i += 1
      }
    }
    return bytes
  }

  const executeExploit = (inputStr = payloadInput, level = currentLevel) => {
    const inputBytes = parsePayload(inputStr)

    const rows: StackRow[] = [
      { addr: '0xffffcfb0', name: 'buffer[0..3]', bytes: [0, 0, 0, 0], target: false },
      { addr: '0xffffcfb4', name: 'buffer[4..7]', bytes: [0, 0, 0, 0], target: false },
      { addr: '0xffffcfb8', name: 'buffer[8..11]', bytes: [0, 0, 0, 0], target: false },
      { addr: '0xffffcfbc', name: 'buffer[12..15]', bytes: [0, 0, 0, 0], target: false },
      { addr: '0xffffcfc0', name: 'authenticated', bytes: [0, 0, 0, 0], target: level === 1 },
      { addr: '0xffffcfc4', name: 'Saved EBP', bytes: [0x00, 0xd0, 0xff, 0xff], target: level === 2 },
      { addr: '0xffffcfc8', name: 'Return Addr (EIP)', bytes: [0x9b, 0x84, 0x04, 0x08], target: level === 3 }
    ]

    let byteIdx = 0
    for (let r = 0; r < rows.length; r++) {
      for (let b = 0; b < 4; b++) {
        if (byteIdx < inputBytes.length) {
          rows[r].bytes[b] = inputBytes[byteIdx]
          byteIdx++
        }
      }
    }

    const authVal = rows[4].bytes.reduce((acc, val, idx) => acc + (val << (8 * idx)), 0)
    const ebpVal = rows[5].bytes.reduce((acc, val, idx) => acc + (val << (8 * idx)), 0)
    const eipVal = rows[6].bytes.reduce((acc, val, idx) => acc + (val << (8 * idx)), 0)

    setRegEBP('0x' + (ebpVal >>> 0).toString(16).padStart(8, '0'))
    setRegEIP('0x' + (eipVal >>> 0).toString(16).padStart(8, '0'))

    if (level === 1) {
      if (authVal !== 0) {
        setStatusState({
          type: 'success',
          msg: `Success! "authenticated" variable corrupted with 0x${authVal.toString(16)}. Root privileges unlocked!`
        })
      } else {
        setStatusState({
          type: 'idle',
          msg: 'authenticated = 0. Normal execution path. Access denied.'
        })
      }
    } else if (level === 2) {
      if (ebpVal !== 0xffffd000) {
        setStatusState({
          type: 'success',
          msg: `Success! Frame Pointer (EBP) corrupted to 0x${ebpVal.toString(16)}. Stack frame pivot achieved!`
        })
      } else {
        setStatusState({
          type: 'idle',
          msg: 'Saved EBP intact at 0xffffd000. Normal stack frame cleanup.'
        })
      }
    } else if (level === 3) {
      if (eipVal === 0x080484a0) {
        setStatusState({
          type: 'success',
          msg: 'PWNED! EIP redirected directly to unlock_root() at 0x080484a0. Arbitrary code execution achieved!'
        })
      } else if (eipVal !== 0x0804849b) {
        setStatusState({
          type: 'danger',
          msg: `Segmentation Fault (Core Dumped)! EIP corrupted with 0x${eipVal.toString(16)}, invalid memory pointer.`
        })
      } else {
        setStatusState({
          type: 'idle',
          msg: 'EIP points to 0x0804849b. Normal return to caller.'
        })
      }
    }

    setStackRows(rows)
  }

  useEffect(() => {
    executeExploit(levels[currentLevel as 1 | 2 | 3].defaultPayload, currentLevel)
  }, [currentLevel])

  const handleSelectLevel = (lvl: number) => {
    setCurrentLevel(lvl)
    setPayloadInput(levels[lvl as 1 | 2 | 3].defaultPayload)
  }

  const handleSuggest = () => {
    const sug = levels[currentLevel as 1 | 2 | 3].suggested
    setPayloadInput(sug)
    executeExploit(sug, currentLevel)
  }

  const bytesToHex = (bytes: number[]) =>
    bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')

  const bytesToAscii = (bytes: number[]) =>
    bytes.map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('')

  return (
    <div className="boa-lab-view">
      {/* Level Selection Tabs */}
      <div className="boa-level-tabs">
        {[1, 2, 3].map((lvl) => (
          <button
            key={lvl}
            type="button"
            className={`boa-level-tab ${currentLevel === lvl ? 'active' : ''}`}
            onClick={() => handleSelectLevel(lvl)}
          >
            <span>Level {lvl}:</span> {lvl === 1 ? 'Local Flag Overwrite' : lvl === 2 ? 'Frame Pointer Pivot' : 'EIP Hijack'}
          </button>
        ))}
      </div>

      {/* 3-Column Layout: Code & Inputs | Stack Visualizer | Registers & Disassembly */}
      <div className="boa-grid">
        {/* Column 1: Vulnerable Code & Payload Form */}
        <div className="boa-card">
          <div className="card-top-header">
            <div className="header-icon-box">
              <Terminal size={18} />
            </div>
            <div>
              <h3>Vulnerable C Source Program</h3>
              <span className="card-subtitle">{levels[currentLevel as 1 | 2 | 3].title}</span>
            </div>
          </div>

          <p className="boa-level-desc">{levels[currentLevel as 1 | 2 | 3].desc}</p>

          <pre className="c-source-code">
            <code>{levels[currentLevel as 1 | 2 | 3].code}</code>
          </pre>

          <div className="payload-input-group">
            <label>Input Payload (ASCII or Hex \xHH bytes):</label>
            <input
              type="text"
              value={payloadInput}
              onChange={(e) => setPayloadInput(e.target.value)}
              placeholder="e.g. AAAAAAAAAAAAAAAA\x01"
            />
          </div>

          <div className="payload-btn-row">
            <button
              type="button"
              className="boa-btn btn-primary"
              onClick={() => executeExploit(payloadInput, currentLevel)}
            >
              <Play size={13} />
              <span>Execute Payload</span>
            </button>
            <button
              type="button"
              className="boa-btn btn-secondary"
              onClick={handleSuggest}
            >
              <Sparkles size={13} />
              <span>Suggest Exploit</span>
            </button>
          </div>

          <div className={`status-alert-box alert-${statusState.type}`}>
            {statusState.type === 'success' ? (
              <CheckCircle2 size={16} />
            ) : statusState.type === 'danger' ? (
              <XCircle size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{statusState.msg}</span>
          </div>
        </div>

        {/* Column 2: Call Stack Memory Layout Visualizer */}
        <div className="boa-card stack-card">
          <div className="card-top-header">
            <div className="header-icon-box">
              <Layers size={18} />
            </div>
            <div>
              <h3>Call Stack Layout (ESP &rarr; High Memory)</h3>
              <span className="card-subtitle">IA-32 (32-bit x86 cdecl Stack Frame)</span>
            </div>
          </div>

          <div className="stack-table">
            <div className="stack-header-row">
              <span>Address</span>
              <span>Memory Bytes (Hex [ASCII])</span>
              <span>Symbol / Purpose</span>
            </div>

            {stackRows.map((row, idx) => {
              const isCorrupted =
                (row.name === 'authenticated' && statusState.type === 'success' && currentLevel === 1) ||
                (row.name === 'Saved EBP' && regEBP !== '0xffffd000' && currentLevel === 2) ||
                (row.name === 'Return Addr (EIP)' && regEIP !== '0x0804849b')

              return (
                <div
                  key={idx}
                  className={`stack-row ${row.target ? 'target' : ''} ${isCorrupted ? 'corrupted' : ''}`}
                >
                  <span className="stack-addr">{row.addr}</span>
                  <span className="stack-bytes">
                    <code>{bytesToHex(row.bytes)}</code>
                    <span className="ascii-tag">[{bytesToAscii(row.bytes)}]</span>
                  </span>
                  <span className="stack-name">
                    {row.name}
                    {row.target && <span className="target-pill">Target</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Column 3: CPU Registers & Disassembly */}
        <div className="boa-card registers-card">
          <div className="card-top-header">
            <div className="header-icon-box">
              <Cpu size={18} />
            </div>
            <div>
              <h3>IA-32 CPU Registers</h3>
              <span className="card-subtitle">Execution State</span>
            </div>
          </div>

          <div className="registers-grid">
            <div className="reg-item">
              <span className="reg-label">EAX</span>
              <code className="reg-val">0x00000000</code>
            </div>
            <div className="reg-item">
              <span className="reg-label">ECX</span>
              <code className="reg-val">0xffffd000</code>
            </div>
            <div className="reg-item">
              <span className="reg-label">ESP (Stack Pointer)</span>
              <code className="reg-val">0xffffcfb0</code>
            </div>
            <div className="reg-item">
              <span className="reg-label">EBP (Frame Pointer)</span>
              <code className={`reg-val ${regEBP !== '0xffffcfc0' ? 'highlight-val' : ''}`}>
                {regEBP}
              </code>
            </div>
            <div className="reg-item reg-full">
              <span className="reg-label">EIP (Instruction Pointer)</span>
              <code className={`reg-val ${regEIP === '0x080484a0' ? 'success-val' : regEIP !== '0x0804849b' ? 'danger-val' : ''}`}>
                {regEIP}
              </code>
            </div>
          </div>

          <div className="disasm-section">
            <h4>Disassembly Preview</h4>
            <pre className="disasm-code">
              <code>{`08048472 <check_auth>:
  push   ebp
  mov    ebp, esp
  sub    esp, 0x28
  mov    DWORD PTR [ebp-0x4], 0x0
  lea    eax, [ebp-0x14]
  push   eax
  call   08048330 <gets>
  cmp    DWORD PTR [ebp-0x4], 0x0
  jne    080484a0 <unlock_root>
  leave
  ret

080484a0 <unlock_root>:
  push   08048560 ; "FLAG{SMASH_THE_STACK}"
  call   puts
  ret`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BufferOverflowExperiment
