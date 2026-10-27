import React, { useState, useEffect, useRef } from 'react'
import {
  Activity,
  RotateCcw,
  Server,
  Shield,
  Skull
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../../Sass/Components/DosDdosExperiment.scss'

export interface DosDdosExperimentProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

export const DosDdosExperiment: React.FC<DosDdosExperimentProps> = () => {
  const [profile, setProfile] = useState<'normal' | 'dos' | 'ddos'>('normal')
  const [rateLimiterOn, setRateLimiterOn] = useState<boolean>(false)

  // Telemetry metrics
  const [cpuLoad, setCpuLoad] = useState<number>(8)
  const [queueSat, setQueueSat] = useState<number>(4)
  const [packetLoss, setPacketLoss] = useState<number>(0)
  const [availability, setAvailability] = useState<number>(100)
  const [serverStatus, setServerStatus] = useState<string>('Normal / Healthy')

  const [logs, setLogs] = useState<string[]>([
    '[00:00:00] Initialized baseline monitor. Target server listening on port 5050.',
    '[00:00:01] Processing benign HTTP requests across local subnet 192.168.1.0/24'
  ])

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (profile === 'normal') {
        setCpuLoad(Math.floor(6 + Math.random() * 5))
        setQueueSat(Math.floor(2 + Math.random() * 6))
        setPacketLoss(0)
        setAvailability(100)
        setServerStatus('Normal / Healthy')
      } else if (profile === 'dos') {
        if (rateLimiterOn) {
          setCpuLoad(22)
          setQueueSat(16)
          setPacketLoss(2)
          setAvailability(98)
          setServerStatus('DoS Mitigated by Single-IP Rate-Limiting')
        } else {
          setCpuLoad(88)
          setQueueSat(240)
          setPacketLoss(65)
          setAvailability(35)
          setServerStatus('CRITICAL: Single-Source DoS Flood Active')
        }
      } else if (profile === 'ddos') {
        if (rateLimiterOn) {
          // Distributed DDoS bypasses single-IP filters!
          setCpuLoad(45)
          setQueueSat(64)
          setPacketLoss(8)
          setAvailability(92)
          setServerStatus('DDoS Mitigated by Edge Token-Bucket & Anycast')
        } else {
          setCpuLoad(99)
          setQueueSat(256)
          setPacketLoss(94)
          setAvailability(0)
          setServerStatus('SERVER OFFLINE: Full Backlog & CPU Exhaustion (HTTP 503)')
        }
      }
    }, 1200)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [profile, rateLimiterOn])

  const handleSetProfile = (p: 'normal' | 'dos' | 'ddos') => {
    setProfile(p)
    const time = new Date().toTimeString().split(' ')[0]
    if (p === 'normal') {
      setLogs((prev) => [`[${time}] Restored normal traffic profile. Availability at 100%.`, ...prev])
    } else if (p === 'dos') {
      setLogs((prev) => [
        `[!] [${time}] Single-Source DoS launched from 192.168.1.105 at 2,500 req/s.`,
        ...prev
      ])
    } else if (p === 'ddos') {
      setLogs((prev) => [
        `[!] [${time}] Distributed DDoS launched across 12 Botnet nodes at 15,000 req/s!`,
        ...prev
      ])
    }
  }

  const handleToggleRateLimiter = () => {
    setRateLimiterOn(!rateLimiterOn)
    const time = new Date().toTimeString().split(' ')[0]
    setLogs((prev) => [
      `[*] [${time}] Rate Limiter & Token Bucket filter toggled to ${!rateLimiterOn ? 'ON' : 'OFF'}.`,
      ...prev
    ])
  }

  const handleReset = () => {
    setProfile('normal')
    setRateLimiterOn(false)
    setCpuLoad(8)
    setQueueSat(4)
    setPacketLoss(0)
    setAvailability(100)
    setServerStatus('Normal / Healthy')
  }

  return (
    <div className="dos-lab-view">
      {/* 4 Telemetry Metrics Gauges */}
      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-title">Server CPU Load</span>
          <div className={`metric-num ${cpuLoad > 75 ? 'danger' : cpuLoad > 30 ? 'warning' : ''}`}>
            {cpuLoad}%
          </div>
          <span className="metric-sub">Worker Threads</span>
        </div>

        <div className="metric-box">
          <span className="metric-title">Queue Saturation</span>
          <div className={`metric-num ${queueSat > 180 ? 'danger' : queueSat > 50 ? 'warning' : ''}`}>
            {queueSat} / 256
          </div>
          <span className="metric-sub">Pending Sockets</span>
        </div>

        <div className="metric-box">
          <span className="metric-title">Packet Drop Rate</span>
          <div className={`metric-num ${packetLoss > 50 ? 'danger' : packetLoss > 10 ? 'warning' : ''}`}>
            {packetLoss}%
          </div>
          <span className="metric-sub">Dropped Handshakes</span>
        </div>

        <div className="metric-box">
          <span className="metric-title">Application Availability</span>
          <div className={`metric-num ${availability < 50 ? 'danger' : availability < 90 ? 'warning' : 'success'}`}>
            {availability}%
          </div>
          <span className="metric-sub">{serverStatus}</span>
        </div>
      </div>

      {/* Attack Profiles & Mitigation Controls */}
      <div className="dos-card controls-card">
        <div className="card-top-header">
          <div className="header-icon-box">
            <Activity size={18} />
          </div>
          <div>
            <h3>Attack Profiles & Mitigation Architecture</h3>
            <span className="card-subtitle">Select simulation vectors and defense policies</span>
          </div>
        </div>

        <div className="controls-row">
          <button
            type="button"
            className={`profile-btn ${profile === 'normal' ? 'active-normal' : ''}`}
            onClick={() => handleSetProfile('normal')}
          >
            Normal User Traffic
          </button>
          <button
            type="button"
            className={`profile-btn btn-danger ${profile === 'dos' ? 'active-dos' : ''}`}
            onClick={() => handleSetProfile('dos')}
          >
            Single-Source DoS (1 IP)
          </button>
          <button
            type="button"
            className={`profile-btn btn-danger ${profile === 'ddos' ? 'active-ddos' : ''}`}
            onClick={() => handleSetProfile('ddos')}
          >
            Distributed Botnet DDoS (12 IPs)
          </button>

          <div className="divider-vert" />

          <button
            type="button"
            className={`toggle-mitigation-btn ${rateLimiterOn ? 'mitigation-active' : ''}`}
            onClick={handleToggleRateLimiter}
          >
            <Shield size={14} />
            <span>Rate-Limiter: <strong>{rateLimiterOn ? 'ACTIVE (Token Bucket)' : 'OFF'}</strong></span>
          </button>

          <button type="button" className="reset-sim-btn" onClick={handleReset} title="Reset">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Network Botnet Diagram & Telemetry Log */}
      <div className="dos-two-col">
        {/* Left: Botnet Topology Diagram */}
        <div className="dos-card topology-card">
          <h4>Attack Network Topology</h4>
          <div className="botnet-canvas">
            <div className="botnet-cluster">
              <span className="cluster-label">Botnet Zombie Swarm (12 Nodes)</span>
              <div className="botnet-nodes-grid">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`bot-node ${profile === 'ddos' ? 'attacking' : ''}`}
                    title={`Zombie Node #${i + 1}`}
                  >
                    <Skull size={14} />
                  </div>
                ))}
              </div>
            </div>

            <div className={`traffic-stream-pipe ${profile !== 'normal' ? 'flooding-pipe' : ''}`}>
              <span>{profile === 'ddos' ? '15k req/s (Flood)' : profile === 'dos' ? '2.5k req/s' : '50 req/s'}</span>
            </div>

            <div className={`target-server-node ${availability < 50 ? 'down' : ''}`}>
              <Server size={28} />
              <strong>Web Server Target</strong>
              <code>Port 5050</code>
              <span className={`status-pill ${availability > 80 ? 'pill-good' : 'pill-bad'}`}>
                {availability > 80 ? 'Online' : 'Saturated'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Packet Log */}
        <div className="dos-card logs-card">
          <h4>Live Packet & Telemetry Stream</h4>
          <div className="dos-log-stream">
            {logs.map((line, i) => (
              <div key={i} className="log-row-text">{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DosDdosExperiment
