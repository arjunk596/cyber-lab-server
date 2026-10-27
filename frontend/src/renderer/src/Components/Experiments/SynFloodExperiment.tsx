import React, { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2,
  Laptop,
  Lock,
  Play,
  RotateCcw,
  Server,
  Skull,
  Square,
  Activity
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../../Sass/Components/SynFloodExperiment.scss'

export interface SynFloodExperimentProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

interface LogEntry {
  timeStr: string
  simTime: string
  level: 'info' | 'warning' | 'danger' | 'success'
  message: string
}

const TOTAL_SLOTS = 100

export const SynFloodExperiment: React.FC<SynFloodExperimentProps> = ({
  experiment: _experiment,
  onOpenTerminal: _onOpenTerminal,
  onComplete: _onComplete
}) => {
  const [activeStep, setActiveStep] = useState<number>(5)
  const [stepStatus, setStepStatus] = useState<Record<number, 'done' | 'ready' | 'locked'>>({
    1: 'done',
    2: 'done',
    3: 'done',
    4: 'done',
    5: 'ready',
    6: 'locked',
    7: 'locked',
    8: 'locked',
    9: 'locked'
  })

  const [simState, setSimState] = useState<'idle' | 'baseline' | 'flooding' | 'stopped' | 'mitigated'>('flooding')
  const [attackLevel, setAttackLevel] = useState<'Low' | 'Medium' | 'Extreme'>('Medium')
  const [simSeconds, setSimSeconds] = useState<number>(16)
  const [queueCount, setQueueCount] = useState<number>(99)
  const [networkStatus, setNetworkStatus] = useState<'Healthy' | 'Degraded' | 'Unavailable'>('Degraded')

  const [floatingAlert, setFloatingAlert] = useState<{ text: string; type: 'warning' | 'danger' | 'success' } | null>({
    text: 'Warning: Server is now Degraded (simulated, t = 9 s).',
    type: 'warning'
  })

  const [slots, setSlots] = useState<Array<'free' | 'syn' | 'legit'>>(() => {
    const arr = Array(TOTAL_SLOTS).fill('free')
    for (let i = 0; i < 99; i++) {
      arr[i] = i === 12 ? 'legit' : 'syn'
    }
    return arr
  })

  const [logs, setLogs] = useState<LogEntry[]>([
    { timeStr: '10:18:24', simTime: 't = 7 s', level: 'warning', message: 'The connection queue passed 90% (92/100)' },
    { timeStr: '10:18:23', simTime: 't = 5 s', level: 'warning', message: 'Server state changed: Healthy to Under Pressure' },
    { timeStr: '10:18:22', simTime: 't = 4 s', level: 'warning', message: 'The connection queue passed 50% (58/100)' },
    { timeStr: '10:18:20', simTime: 't = 0 s', level: 'warning', message: 'SYN flood started at medium level: 15 SYN/s, 80% never complete (simulated). No defences enabled.' },
    { timeStr: '10:18:01', simTime: 't = 20 s', level: 'success', message: 'Baseline generated: average availability 100%, server Healthy.' },
    { timeStr: '10:17:49', simTime: 't = 0 s', level: 'info', message: 'Baseline traffic started: 5 legitimate SYN/s (simulated). No defences enabled.' },
    { timeStr: '10:17:45', simTime: 't = 0 s', level: 'info', message: 'Lab initialised. Step 1: review the theory.' }
  ])

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (simState === 'flooding') {
      intervalRef.current = setInterval(() => {
        setSimSeconds((s) => {
          const next = s >= 40 ? 40 : s + 1
          if (next >= 21) {
            setNetworkStatus('Unavailable')
            setFloatingAlert({ text: 'Danger: Server is now Unavailable (simulated, t = 21 s).', type: 'danger' })
          } else if (next >= 9) {
            setNetworkStatus('Degraded')
            setFloatingAlert({ text: 'Warning: Server is now Degraded (simulated, t = 9 s).', type: 'warning' })
          }
          return next
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [simState])

  const handleGenerateBaseline = () => {
    setSimState('baseline')
    setSimSeconds(5)
    setQueueCount(15)
    setNetworkStatus('Healthy')
    setFloatingAlert({ text: 'Normal: Legitimate TCP handshakes operating smoothly.', type: 'success' })
    const next = Array(TOTAL_SLOTS).fill('free')
    for (let i = 0; i < 15; i++) next[i] = 'legit'
    setSlots(next)
    setLogs((prev) => [
      {
        timeStr: new Date().toTimeString().split(' ')[0],
        simTime: 't = 1 s',
        level: 'success',
        message: 'Generated baseline traffic: 5 legitimate SYN/s. Response time: 24ms. Zero loss.'
      },
      ...prev
    ])
    setStepStatus((s) => ({ ...s, 2: 'done', 3: 'ready' }))
    setActiveStep(3)
  }

  const handleStartFlood = () => {
    setSimState('flooding')
    setSimSeconds(0)
    setQueueCount(99)
    const next = Array(TOTAL_SLOTS).fill('free')
    for (let i = 0; i < 99; i++) next[i] = i === 12 ? 'legit' : 'syn'
    setSlots(next)
    setLogs((prev) => [
      {
        timeStr: new Date().toTimeString().split(' ')[0],
        simTime: 't = 0 s',
        level: 'warning',
        message: `SYN flood started at ${attackLevel.toLowerCase()} level. Spoofed TCP SYNs flooding backlog queue.`
      },
      ...prev
    ])
    setStepStatus((s) => ({ ...s, 3: 'done', 4: 'done', 5: 'ready' }))
    setActiveStep(5)
  }

  const handleStopFlood = () => {
    setSimState('stopped')
    setStepStatus((s) => ({ ...s, 5: 'done', 6: 'ready' }))
    setActiveStep(6)
    setLogs((prev) => [
      {
        timeStr: new Date().toTimeString().split(' ')[0],
        simTime: `t = ${simSeconds} s`,
        level: 'info',
        message: 'Simulation stopped by user. Analyzing remaining half-open connection degradation.'
      },
      ...prev
    ])
  }

  const handleReset = () => {
    setSimState('idle')
    setSimSeconds(0)
    setQueueCount(0)
    setNetworkStatus('Healthy')
    setFloatingAlert(null)
    setSlots(Array(TOTAL_SLOTS).fill('free'))
    setActiveStep(1)
    setStepStatus({
      1: 'ready',
      2: 'locked',
      3: 'locked',
      4: 'locked',
      5: 'locked',
      6: 'locked',
      7: 'locked',
      8: 'locked',
      9: 'locked'
    })
  }

  return (
    <div className="syn-flood-lab-view">
      {/* 2-Column Main Workspace */}
      <div className="syn-grid">
        {/* Left Side: 9-Step Workflow */}
        <aside className="syn-steps-col">
          <div className="syn-card steps-card">
            <h3 className="card-header-title">Experiment Steps</h3>
            <div className="steps-list">
              {[
                { num: 1, label: 'Review the lab' },
                { num: 2, label: 'Generate baseline traffic' },
                { num: 3, label: 'Launch the SYN flood' },
                { num: 4, label: 'Observe the impact' },
                { num: 5, label: 'Stop the attack' },
                { num: 6, label: 'Enable mitigation' },
                { num: 7, label: 'Compare the results' },
                { num: 8, label: "Defender's workshop" },
                { num: 9, label: 'Test your knowledge' }
              ].map((step) => {
                const status = stepStatus[step.num] || 'locked'
                const isCurrent = activeStep === step.num
                return (
                  <div
                    key={step.num}
                    className={`step-row ${status} ${isCurrent ? 'current' : ''}`}
                    onClick={() => status !== 'locked' && setActiveStep(step.num)}
                  >
                    <div className="step-check">
                      {status === 'done' ? (
                        <CheckCircle2 size={16} className="check-icon" />
                      ) : status === 'locked' ? (
                        <Lock size={12} className="lock-icon" />
                      ) : (
                        <span className="num-circle">{step.num}</span>
                      )}
                    </div>
                    <span className="step-label">{step.label}</span>
                    <span className={`step-badge badge-${status}`}>
                      {status === 'done' ? 'Done' : status === 'ready' ? 'Ready' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Active Step Guidance */}
          <div className="syn-card active-step-card">
            <div className="step-guide-tag">Step {activeStep} of 9: Stop the attack</div>
            <p className="step-guide-body">
              Press <strong>Stop</strong> whenever you have seen enough queue exhaustion and
              telemetry degradation on screen so you can analyze the consequences.
            </p>
          </div>
        </aside>

        {/* Center / Right: Topology & Queue Grid */}
        <div className="syn-stage-col">
          {/* Network Topology Panel */}
          <div className="syn-card topology-card">
            <div className="topology-header">
              <h3>Network Topology</h3>
              <div className="topology-legend">
                <span className="leg-item"><span className="leg-dot dot-blue" /> Legitimate</span>
                <span className="leg-item"><span className="leg-dot dot-dark" /> Attack</span>
              </div>
            </div>

            <div className="topology-canvas">
              {/* Left Top: Legitimate Client */}
              <div className="topo-node node-client">
                <div className="node-icon-box">
                  <Laptop size={18} />
                </div>
                <div className="node-text">
                  <strong>Legitimate Client</strong>
                  <span>192.168.1.50</span>
                </div>
              </div>

              {/* Left Bottom: Simulated Traffic Generator */}
              <div className="topo-node node-attacker">
                <div className="node-icon-box">
                  <Skull size={18} />
                </div>
                <div className="node-text">
                  <strong>Simulated Traffic Generator</strong>
                  <span>Spoofed IPs</span>
                </div>
              </div>

              {/* Center: Target Server */}
              <div className="topo-node node-server">
                <div className="node-icon-box">
                  <Server size={20} />
                </div>
                <div className="node-text">
                  <strong>Target Server</strong>
                  <span>192.168.1.10:80</span>
                </div>
              </div>

              {/* Right: TCP Connection Queue (10x10 Matrix) */}
              <div className="queue-container">
                <div className="queue-box-header">
                  <Server size={14} />
                  <span>TCP Connection Queue</span>
                </div>
                <div className="slots-matrix-100">
                  {slots.map((state, idx) => (
                    <div key={idx} className={`slot-dot slot-${state}`} />
                  ))}
                </div>
                <div className="queue-footer">
                  <strong>{queueCount} / 100 pending</strong>
                </div>
              </div>

              {/* Network Status Box */}
              <div className={`status-callout status-${networkStatus.toLowerCase()}`}>
                <Activity size={16} />
                <div>
                  <span className="stat-label">Network Status</span>
                  <span className="stat-value">{networkStatus}</span>
                </div>
              </div>

              {/* Floating Alert Pill */}
              {floatingAlert && (
                <div className={`floating-pill-alert alert-${floatingAlert.type}`}>
                  <span className="pill-dot" />
                  <span>{floatingAlert.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Docked Toolbar */}
          <div className="syn-toolbar-card">
            <button
              type="button"
              className="toolbar-btn baseline-btn"
              onClick={handleGenerateBaseline}
              disabled={simState === 'flooding'}
            >
              Generate Baseline Traffic
            </button>

            <div className="attack-level-group">
              <label>Attack level:</label>
              <select
                value={attackLevel}
                onChange={(e) => setAttackLevel(e.target.value as typeof attackLevel)}
                disabled={simState === 'flooding'}
              >
                <option value="Low">Low (5 SYN/s)</option>
                <option value="Medium">Medium (15 SYN/s)</option>
                <option value="Extreme">Extreme (50 SYN/s)</option>
              </select>
            </div>

            {simState === 'flooding' ? (
              <button
                type="button"
                className="toolbar-btn stop-sim-btn"
                onClick={handleStopFlood}
              >
                <Square size={13} />
                Stop Simulation
              </button>
            ) : (
              <button
                type="button"
                className="toolbar-btn start-flood-btn"
                onClick={handleStartFlood}
              >
                <Play size={13} />
                Start SYN Flood
              </button>
            )}

            <button
              type="button"
              className="toolbar-btn reset-btn"
              onClick={handleReset}
              title="Reset Lab"
            >
              <RotateCcw size={13} />
            </button>

            {/* Progress / Timeline Bar */}
            <div className="toolbar-timeline">
              <div className="timeline-label">
                <span className="timeline-dot" />
                <span>SYN flood ({attackLevel.toLowerCase()}) — {simSeconds} / 40 simulated seconds</span>
              </div>
              <div className="timeline-track">
                <div
                  className="timeline-bar-fill"
                  style={{ width: `${(simSeconds / 40) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Live Experiment Log Table */}
          <div className="syn-card log-card">
            <h3 className="card-header-title">Experiment Log</h3>
            <div className="log-table-scroll">
              <table className="log-table">
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={index} className={`log-row log-${log.level}`}>
                      <td className="col-time">{log.timeStr}</td>
                      <td className="col-simtime">({log.simTime})</td>
                      <td className="col-badge">
                        <span className={`badge-pill pill-${log.level}`}>
                          ● {log.level.toUpperCase()}
                        </span>
                      </td>
                      <td className="col-msg">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SynFloodExperiment
