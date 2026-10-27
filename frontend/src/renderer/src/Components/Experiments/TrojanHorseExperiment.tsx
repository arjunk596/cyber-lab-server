import React, { useState } from 'react'
import {
  Bug,
  Terminal,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Laptop
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../../Sass/Components/TrojanHorseExperiment.scss'

export interface TrojanHorseExperimentProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

export const TrojanHorseExperiment: React.FC<TrojanHorseExperimentProps> = ({ onOpenTerminal }) => {
  const [sandboxActive, setSandboxActive] = useState<boolean>(true)
  const [executedPayload, setExecutedPayload] = useState<boolean>(false)
  const [simCommand, setSimCommand] = useState<string>('cat ~/.ssh/id_rsa')
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    '[*] MCP Server initialized on 127.0.0.1:7331',
    '[*] Tool registered: "code_analyzer" (Legitimate appearance)',
    '[*] Background daemon listening for execution triggers...'
  ])

  const handleExecuteMalware = () => {
    setExecutedPayload(true)
    const time = new Date().toTimeString().split(' ')[0]

    if (!sandboxActive) {
      // Uncontained Host Execution
      setTerminalOutput((prev) => [
        `[!] [${time}] CRITICAL: Trojan payload executed directly on Host Machine!`,
        `[!] Command executed: "${simCommand}" under UID 501 (Current User)`,
        `[!] EXFILTRATED: ~/.ssh/id_rsa (RSA Private Key 4096-bit)`,
        `[!] Reverse shell established to 198.51.100.24:4444`,
        `[!] Host environment fully compromised!`,
        ...prev
      ])
    } else {
      // Container Sandbox Active
      setTerminalOutput((prev) => [
        `[*] [${time}] Trojan payload executed inside isolated Docker container.`,
        `[+] Attempted command: "${simCommand}"`,
        `[+] ACCESS DENIED: /root/.ssh does not exist in container namespace.`,
        `[+] Host filesystem is NOT mounted. Container filesystem is strictly isolated.`,
        `[+] Outbound reverse shell to external LAN BLOCKED by container network policy.`,
        `[+] Blast radius contained to disposable sandbox container.`,
        ...prev
      ])
    }
  }

  const handleReset = () => {
    setExecutedPayload(false)
    setTerminalOutput([
      '[*] MCP Server initialized on 127.0.0.1:7331',
      '[*] Tool registered: "code_analyzer" (Legitimate appearance)',
      '[*] Ready for experiment execution.'
    ])
  }

  return (
    <div className="trojan-lab-view">
      {/* Top Controls Card */}
      <div className="trojan-card config-card">
        <div className="card-top-header">
          <div className="header-icon-box danger-box">
            <Bug size={18} />
          </div>
          <div>
            <h3>Model Context Protocol (MCP) Trojan Deception & Sandbox Evaluation</h3>
            <span className="card-subtitle">Analyze how malicious tooling executes and how Docker containment mitigates privilege abuse</span>
          </div>
        </div>

        <div className="config-grid">
          <div className="config-item">
            <label>Execution Containment Mode:</label>
            <div className="mode-toggle-group">
              <button
                type="button"
                className={`mode-btn ${!sandboxActive ? 'active-host' : ''}`}
                onClick={() => { setSandboxActive(false); setExecutedPayload(false); }}
              >
                <ShieldAlert size={14} />
                <span>Uncontained Host Execution</span>
              </button>
              <button
                type="button"
                className={`mode-btn ${sandboxActive ? 'active-sandbox' : ''}`}
                onClick={() => { setSandboxActive(true); setExecutedPayload(false); }}
              >
                <ShieldCheck size={14} />
                <span>Docker Sandbox Isolation</span>
              </button>
            </div>
          </div>

          <div className="config-item">
            <label>Attacker Simulated Injected Command:</label>
            <div className="cmd-input-row">
              <input
                type="text"
                value={simCommand}
                onChange={(e) => setSimCommand(e.target.value)}
                placeholder="e.g. cat ~/.ssh/id_rsa or whoami"
              />
              <button
                type="button"
                className="trojan-run-btn"
                onClick={handleExecuteMalware}
              >
                <Play size={13} />
                <span>Trigger Trojan Payload</span>
              </button>
              <button
                type="button"
                className="trojan-reset-btn"
                onClick={handleReset}
                title="Reset"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Containment Diagram & Security Telemetry */}
      <div className="trojan-two-col">
        {/* Left: Containment Visualizer */}
        <div className="trojan-card containment-card">
          <h4>Execution Boundary & Blast Radius Analysis</h4>
          <div className="boundary-visualizer">
            <div className={`host-layer ${!sandboxActive && executedPayload ? 'compromised' : 'secured'}`}>
              <div className="layer-title">
                <Laptop size={16} />
                <span>Host Operating System (macOS / Linux)</span>
              </div>
              <div className="host-resources">
                <span className="res-tag">Host SSH Keys (~/.ssh)</span>
                <span className="res-tag">System Keychain & Credentials</span>
                <span className="res-tag">Developer Tokens (.env)</span>
              </div>

              {sandboxActive ? (
                <div className="sandbox-boundary">
                  <div className="sandbox-header">
                    <ShieldCheck size={14} />
                    <span>Docker Container Isolation Boundary (Ubuntu 24.04)</span>
                  </div>
                  <div className="sandbox-body">
                    <span className="sand-prop">Ephemeral Filesystem</span>
                    <span className="sand-prop">Bound to 127.0.0.1</span>
                    <span className="sand-prop">Dropped Capabilities</span>
                  </div>
                  <div className="trojan-process">
                    <Bug size={14} />
                    <span>Trojan MCP Server Process (PID 1)</span>
                  </div>
                </div>
              ) : (
                <div className="uncontained-process">
                  <Bug size={16} />
                  <span>Trojan Process Running Directly as Host User (UID 501)</span>
                </div>
              )}
            </div>
          </div>

          {/* Outcome Status Box */}
          {executedPayload && (
            <div className={`impact-alert-box ${!sandboxActive ? 'impact-danger' : 'impact-success'}`}>
              {!sandboxActive ? (
                <>
                  <AlertTriangle size={20} />
                  <div>
                    <strong>HOST COMPROMISE DETECTED:</strong>
                    <p>
                      Because the Trojan executed without sandbox containment, it leveraged the user&apos;s
                      ambient permissions to access private SSH keys and initiate an outbound reverse shell!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>CONTAINMENT SUCCESSFUL:</strong>
                    <p>
                      The Docker sandbox effectively isolated the malicious process. Sensitive host files
                      remained completely inaccessible to the Trojan command!
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Real-time Execution & Telemetry Log */}
        <div className="trojan-card console-card">
          <div className="console-header">
            <h4>Process & Telemetry Output</h4>
            <button
              type="button"
              className="open-terminal-link"
              onClick={onOpenTerminal}
            >
              <Terminal size={12} />
              <span>Container Terminal</span>
            </button>
          </div>
          <div className="console-stream">
            {terminalOutput.map((line, i) => (
              <div key={i} className="stream-line">{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TrojanHorseExperiment
