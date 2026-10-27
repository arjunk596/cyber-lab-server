import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { ArrowLeft, Container, Loader2, Play, Square } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import type { LabLog, LabStatus } from '@shared/lab'
import type { Experiment } from '@shared/experiment'
import Terminal from '@renderer/Components/Terminal'
import '../Sass/Components/LabSimulation.scss'

interface Proptype {
  experiment: Experiment | null
}

const PHASE_LABEL: Record<LabStatus['phase'], string> = {
  idle: 'not running',
  cloning: 'cloning repository…',
  starting: 'starting containers…',
  running: 'running',
  stopping: 'cleaning up…'
}

const MAX_LOG_LINES = 400

const LabSimulation = ({ experiment }: Proptype): JSX.Element => {
  const navigate = useNavigate()
  const [status, setStatus] = useState<LabStatus>({ phase: 'idle' })
  const [logs, setLogs] = useState<LabLog[]>([])
  const logRef = useRef<HTMLDivElement | null>(null)

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
    if (!docker) toast.error('docker is not installed')
    if (!compose) toast.error('Docker compose is not installed')
    if (!dockerDaemon) toast.error('Docker daemon is not running')

    if (!(git && docker && compose && dockerDaemon)) return

    setLogs([])
    const result = await window.api.lab.start({
      url: experiment.github_url,
      repoName: experiment.github_repo_name
    })
    if (result.error) toast.error(result.error)
  }, [experiment])

  const endLab = useCallback(async () => {
    const result = await window.api.lab.stop()
    if (result.error) toast.error(result.error)
  }, [])

  const isIdle = status.phase === 'idle'
  const isBusy = status.phase === 'cloning' || status.phase === 'starting'
  const canEnd = status.phase === 'running' || status.phase === 'starting'

  return (
    <section className="lab-sim">
      <div className="heading">
        <button className="back-btn" type="button" onClick={() => navigate('/home')}>
          <ArrowLeft size={30} />
        </button>

        <div className="heading-title">
          <h2>{experiment?.title} - Simulation</h2>

          <div className="sim-actions">
            <span className={`sim-phase ${status.phase}`}>
              {isBusy && <Loader2 size={13} className="spin" />}
              {PHASE_LABEL[status.phase]}
            </span>

            {
              isIdle ?
                <button
                  className="sim-btn start-btn"
                  type="button"
                  onClick={startLab}
                  disabled={!experiment}
                >
                  <Play size={14} />
                  Start
                </button>
                :
                <button
                  className="sim-btn end-btn"
                  type="button"
                  onClick={endLab}
                  disabled={!canEnd}
                >
                  <Square size={13} />
                  {status.phase === 'stopping' ? 'Ending…' : 'End'}
                </button>
            }
          </div>
        </div>
      </div>

      <div className="sim-body">
        <section className="sim-pane">
          <div className="pane-head">
            <span className="pane-title">
              <Container size={14} />
              Docker · lab output
            </span>
            <span className="pane-meta" title={status.repoPath}>
              {status.repoName ?? 'no repository'}
            </span>
          </div>

          <div className="pane-log" ref={logRef}>
            {
              logs.length === 0 ?
                <p className="log-empty">
                  {isIdle ? 'Start the lab to stream the docker output here.' : 'Waiting for output…'}
                </p>
                :
                logs.map((entry, index) => (
                  <div key={index} className={`log-line ${entry.stream}`}>{entry.line}</div>
                ))
            }
          </div>
        </section>

        <section className="sim-pane">
          <Terminal
            cwd={
              status.phase === 'starting' || status.phase === 'running'
                ? status.repoPath
                : undefined
            }
          />
        </section>
      </div>
    </section>
  )
}

export default LabSimulation
