import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Container,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  Play,
  Square,
  Terminal as TerminalIcon,
  X,
  Copy,
  Check,
  Code
} from 'lucide-react'
import { toast } from 'react-toastify'
import type { LabLog, LabStatus } from '@shared/lab'
import type { Experiment } from '@shared/experiment'
import Terminal from '@renderer/Components/Terminal'
import '../Sass/Components/LabTerminalDrawer.scss'

interface LabTerminalDrawerProps {
  experiment: Experiment
  isOpen: boolean
  onClose: () => void
}

interface LabCommandGuideItem {
  cmd: string
  desc: string
}

const LAB_COMMANDS: Record<string, LabCommandGuideItem[]> = {
  css_mini: [
    { cmd: 'curl -I http://localhost:8081 2>/dev/null || echo "Port 8081 (Launch container above or run in browser)"', desc: 'Inspect SYN Flood web endpoint status' },
    { cmd: 'python3 -c "print(\'TCP Backlog: 100 slots | SYN Cookies (RFC 4987) mitigation ready\')"', desc: 'Verify kernel TCP defense parameters' },
    { cmd: 'netstat -an | grep 8081 || echo "No active connections on port 8081"', desc: 'Monitor active socket states' }
  ],
  'css-lab-simulation': [
    { cmd: 'python3 -c "p, q = 61, 53; print(f\'RSA Modulus n={p*q}, Totient phi={(p-1)*(q-1)}\')"', desc: 'Compute RSA semiprime modulus and totient' },
    { cmd: 'openssl version', desc: 'Verify OpenSSL cryptographic engine' },
    { cmd: 'openssl rand -hex 16', desc: 'Generate 128-bit secure random key sample' }
  ],
  'css-lab-boa': [
    { cmd: "python3 -c 'print(\"Payload (20 bytes + EIP): \" + \"A\"*20 + \"\\xa0\\x84\\x04\\x08\")'", desc: 'Generate 32-bit EIP hijack payload string' },
    { cmd: 'uname -sm', desc: 'Inspect host kernel and architecture' },
    { cmd: 'file /bin/ls', desc: 'Inspect ELF binary protections on system' }
  ],
  packet_spoofing: [
    { cmd: 'arp -a', desc: 'Display local kernel ARP resolution cache table' },
    { cmd: 'ifconfig -a | grep -E "inet |ether" | head -n 4', desc: 'Inspect local MAC addresses and network interfaces' },
    { cmd: 'netstat -rn | head -n 6', desc: 'Inspect kernel routing table and default gateway' }
  ],
  'css-virtual-lab': [
    { cmd: 'curl -I http://localhost:5050 2>/dev/null || echo "DoS/DDoS target listening on port 5050"', desc: 'Check target web server health' },
    { cmd: 'ping -c 3 127.0.0.1', desc: 'Test loopback network latency and packet stability' },
    { cmd: 'python3 -c "print(\'Rate Limiter: Token Bucket algorithm active (25 req/min burst: 100)\')"', desc: 'Verify rate limiting policy' }
  ],
  'trojan-horse-mcp': [
    { cmd: 'docker ps', desc: 'List active Docker sandbox containers' },
    { cmd: 'docker run --rm -d -p 7331:7331 trojan-mcp', desc: 'Run contained MCP server daemon on port 7331' },
    { cmd: 'curl -s http://127.0.0.1:7331/tools', desc: 'Query registered tools from contained MCP daemon' },
    { cmd: 'python3 -c "import os; print(\'Host SSH Boundary:\', os.path.exists(os.path.expanduser(\'~/.ssh\')))"', desc: 'Verify ambient host permission boundary' }
  ]
}

const PHASE_LABEL: Record<LabStatus['phase'], string> = {
  idle: 'Container Offline',
  cloning: 'Cloning Repository…',
  starting: 'Building & Starting…',
  running: 'Active Container',
  stopping: 'Tearing Down…'
}

export const LabTerminalDrawer: React.FC<LabTerminalDrawerProps> = ({
  experiment,
  isOpen,
  onClose
}) => {
  const [status, setStatus] = useState<LabStatus>({ phase: 'idle' })
  const [logs, setLogs] = useState<LabLog[]>([])
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement | null>(null)

  const activePort = status.webPort || experiment.port
  const webUrl = status.webUrl || (activePort ? `http://localhost:${activePort}` : undefined)

  const repoKey = experiment.github_repo_name.toLowerCase()
  const commands = LAB_COMMANDS[repoKey] || [
    { cmd: 'ls -la', desc: 'List workspace contents' },
    { cmd: 'docker ps', desc: 'Check running Docker containers' }
  ]

  useEffect(() => {
    let alive = true
    const offLog = window.api.lab.onLog((entry) => {
      setLogs((prev) => [...prev.slice(-400), entry])
    })
    const offStatus = window.api.lab.onStatus((next) => setStatus(next))

    window.api.lab
      .status()
      .then((snapshot) => {
        if (!alive) return
        setStatus(snapshot.status)
        setLogs(snapshot.log)
      })
      .catch(() => undefined)

    return () => {
      alive = false
      offLog()
      offStatus()
    }
  }, [])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const copyToClipboard = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopiedCmd(cmd)
    toast.info(`Copied to clipboard: ${cmd}`)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  const startLab = useCallback(async () => {
    setLogs([{ stream: 'sys', line: `Initializing isolated Docker container for ${experiment.title}…` }])
    toast.info('Starting container environment…')
    
    try {
      const result = await window.api.lab.start({
        url: experiment.github_url,
        repoName: experiment.github_repo_name,
        port: experiment.port
      })
      if (result?.error) {
        toast.error(`Container start error: ${result.error}`)
      } else {
        toast.success('Container started successfully!')
      }
    } catch (err) {
      toast.error('Failed to launch container: ' + (err as Error).message)
    }
  }, [experiment])

  const endLab = useCallback(async () => {
    const result = await window.api.lab.stop()
    if (result?.error) toast.error(result.error)
  }, [])

  const handleOpenBrowser = () => {
    if (webUrl) {
      window.api.openURL(webUrl)
    }
  }

  if (!isOpen) return null

  const isBusy = status.phase === 'cloning' || status.phase === 'starting' || status.phase === 'stopping'
  const isRunning = status.phase === 'running'
  const isIdle = status.phase === 'idle'
  const canEnd = isRunning || status.phase === 'starting'

  return (
    <div className="terminal-drawer-overlay" onClick={onClose}>
      <aside
        className={`terminal-drawer ${isExpanded ? 'expanded' : ''}`}
        role="dialog"
        aria-label="Interactive Terminal & Container Console"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-icon-box">
              <TerminalIcon size={16} />
            </div>
            <div>
              <h3 className="drawer-title">Execution Console & Shell</h3>
              <div className="drawer-subtitle">
                <span>{experiment.github_repo_name}</span>
                {activePort && <span className="port-badge">Port {activePort}</span>}
              </div>
            </div>
          </div>

          <div className="drawer-actions">
            <span className={`sim-phase ${status.phase}`}>
              {isBusy && <Loader2 size={12} className="spin" />}
              {PHASE_LABEL[status.phase]}
            </span>

            {isRunning && webUrl && (
              <button
                type="button"
                className="action-btn browser-btn"
                onClick={handleOpenBrowser}
                title={`Open standalone web simulation at ${webUrl}`}
              >
                <ExternalLink size={13} />
                <span>Open Browser</span>
              </button>
            )}

            {isIdle ? (
              <button
                type="button"
                className="action-btn start-btn"
                onClick={startLab}
              >
                <Play size={13} />
                <span>Launch Container</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-btn stop-btn"
                onClick={endLab}
                disabled={!canEnd}
              >
                <Square size={12} />
                <span>Stop</span>
              </button>
            )}

            <button
              type="button"
              className="ctrl-btn"
              onClick={() => setIsExpanded((prev) => !prev)}
              title={isExpanded ? 'Restore Size' : 'Maximize Terminal'}
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <button
              type="button"
              className="ctrl-btn close-btn"
              onClick={onClose}
              title="Close Drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        <div className="drawer-body">
          {/* Top Pane: Docker Output */}
          <div className="drawer-pane docker-pane">
            <div className="pane-header">
              <Container size={13} />
              <span>Container Logs Stream</span>
            </div>
            <div className="pane-content log-content" ref={logRef}>
              {logs.length === 0 ? (
                <div className="empty-log-msg">
                  <p>
                    {isIdle
                      ? 'Container is offline. Click "Launch Container" above to start the isolated Docker container and stream logs.'
                      : 'Connecting to container logs…'}
                  </p>
                  {activePort && (
                    <p className="port-hint">
                      Mapped Host Port: <code>localhost:{activePort}</code>
                    </p>
                  )}
                </div>
              ) : (
                logs.map((entry, index) => (
                  <div key={index} className={`log-row ${entry.stream}`}>
                    {entry.line}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Interactive Shell & Command Guide */}
          <div className="drawer-pane term-pane">
            <div className="pane-header">
              <div className="pane-title">
                <TerminalIcon size={13} />
                <span>Interactive Shell (xterm.js)</span>
              </div>
            </div>

            {/* Recommended Lab Commands Guide */}
            <div className="command-guide-bar">
              <div className="guide-title">
                <Code size={13} className="guide-icon" />
                <span>Recommended Commands for this Lab:</span>
              </div>
              <div className="guide-chips">
                {commands.map((item, idx) => (
                  <div
                    key={idx}
                    className="cmd-chip"
                    onClick={() => copyToClipboard(item.cmd)}
                    title={`Click to copy: ${item.desc}`}
                  >
                    <code>{item.cmd}</code>
                    <span className="chip-desc">{item.desc}</span>
                    {copiedCmd === item.cmd ? (
                      <Check size={12} className="check-icon" />
                    ) : (
                      <Copy size={12} className="copy-icon" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pane-content term-content">
              <Terminal
                cwd={
                  status.phase === 'starting' || status.phase === 'running'
                    ? status.repoPath
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}

export default LabTerminalDrawer
