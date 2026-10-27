import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { ArrowLeft, Container, ExternalLink, Loader2, Play, Square, Terminal as TerminalIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import type { LabLog, LabStatus } from '@shared/lab'
import type { Experiment } from '@shared/experiment'
import Terminal from '@renderer/Components/Terminal'
import '../Sass/Components/LabSimulation.scss'

interface Proptype {
  experiment: Experiment | null
  onBackToTheory?: () => void
}

const PHASE_LABEL: Record<LabStatus['phase'], string> = {
  idle: 'Container Offline',
  cloning: 'Cloning Repository…',
  starting: 'Building & Starting…',
  running: 'Container Active',
  stopping: 'Tearing Down…'
}

const MAX_LOG_LINES = 500

const LabSimulation = ({ experiment, onBackToTheory }: Proptype): JSX.Element => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<LabStatus>({ phase: 'idle' })
  const [logs, setLogs] = useState<LabLog[]>([])
  const logRef = useRef<HTMLDivElement | null>(null)

  const activePort = status.webPort || experiment?.port
  const webUrl = status.webUrl || (activePort ? `http://localhost:${activePort}` : undefined)

  useEffect(() => {
    let alive = true

    const offLog = window.api.lab.onLog((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry]
        return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next
      })
    })
    const offStatus = window.api.lab.onStatus((next) => setStatus(next))

    window.api.lab.status()
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
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  const startLab = useCallback(async () => {
    if (!experiment) {
      toast.error('Experiment details are missing')
      return
    }

    const [git, docker, compose, dockerDaemon] = await Promise.all([
      window.api.process.checkDependency('git'),
      window.api.process.checkDependency('docker'),
      window.api.process.checkDependency('compose'),
      window.api.process.checkDependency('dockerDaemon')
    ])

    if (!git) toast.error('Git is not installed')
    if (!docker) toast.error('Docker is not installed')
    if (!compose) toast.error('Docker Compose is not installed')
    if (!dockerDaemon) toast.error('Docker daemon is not running')

    if (!(git && docker && compose && dockerDaemon)) return

    setLogs([])
    const result = await window.api.lab.start({
      url: experiment.github_url,
      repoName: experiment.github_repo_name,
      port: experiment.port
    })
    if (result.error) toast.error(result.error)
  }, [experiment])

  const endLab = useCallback(async () => {
    const result = await window.api.lab.stop()
    if (result.error) toast.error(result.error)
  }, [])

  const handleOpenBrowser = useCallback(() => {
    if (webUrl) {
      window.api.openURL(webUrl)
    } else {
      toast.info('No web port configured for this lab container.')
    }
  }, [webUrl])

  const isIdle = status.phase === 'idle'
  const isBusy = status.phase === 'cloning' || status.phase === 'starting'
  const canEnd = status.phase === 'running' || status.phase === 'starting'
  const isRunning = status.phase === 'running'

  return (
    <section className="lab-sim">
      <div className="heading">
        <button
          className="back-btn"
          type="button"
          onClick={() => (onBackToTheory ? onBackToTheory() : navigate('/home'))}
          title="Return"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="heading-title">
          <div>
            <h2>{experiment?.title}</h2>
            <div className="sim-meta-sub">
              <span>Runtime Engine: Docker Compose</span>
              {activePort && <span className="port-badge">Port {activePort}</span>}
            </div>
          </div>

          <div className="sim-actions">
            <span className={`sim-phase ${status.phase}`}>
              {isBusy && <Loader2 size={13} className="spin" />}
              {PHASE_LABEL[status.phase]}
            </span>

            {isRunning && webUrl && (
              <button
                className="sim-btn browser-btn"
                type="button"
                onClick={handleOpenBrowser}
                title={`Open standalone web simulation at ${webUrl}`}
              >
                <ExternalLink size={13} />
                Open in Web Browser
              </button>
            )}

            {isIdle ? (
              <button
                className="sim-btn start-btn"
                type="button"
                onClick={startLab}
                disabled={!experiment}
              >
                <Play size={13} />
                Launch Container
              </button>
            ) : (
              <button
                className="sim-btn end-btn"
                type="button"
                onClick={endLab}
                disabled={!canEnd}
              >
                <Square size={12} />
                {status.phase === 'stopping' ? 'Terminating…' : 'Stop Lab'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="sim-body">
        <section className="sim-pane">
          <div className="pane-head">
            <span className="pane-title">
              <Container size={14} />
              Container Execution Logs
            </span>
            <span className="pane-meta" title={status.repoPath}>
              {status.repoName ?? 'unattached'}
            </span>
          </div>

          <div className="pane-log" ref={logRef}>
            {logs.length === 0 ? (
              <div className="log-empty">
                <p>
                  {isIdle
                    ? 'Lab container is currently stopped. Click "Launch Container" to spin up the local environment and stream logs here.'
                    : 'Awaiting container output stream…'}
                </p>
                {activePort && (
                  <p className="log-hint">
                    Target container binding: <code>localhost:{activePort}</code>
                  </p>
                )}
              </div>
            ) : (
              logs.map((entry, index) => (
                <div key={index} className={`log-line ${entry.stream}`}>
                  {entry.line}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="sim-pane">
          <div className="pane-head">
            <span className="pane-title">
              <TerminalIcon size={14} />
              Interactive Shell Session
            </span>
            <span className="pane-meta">xterm.js</span>
          </div>
          <div className="terminal-wrap">
            <Terminal
              cwd={
                status.phase === 'starting' || status.phase === 'running'
                  ? status.repoPath
                  : undefined
              }
            />
          </div>
        </section>
      </div>
    </section>
  )
}

export default LabSimulation
