import { useState, useEffect, useRef } from 'react'
import splash from '../Assets/Splash.svg'
import '../Sass/Layouts/Splash.scss'
import { useNavigate } from 'react-router'
import Loading from '@renderer/Components/Loading'
import { CircleCheck, MoveRight } from 'lucide-react'

interface DepStatus {
  id: keyof HelpUrls
  label: 'Git' | 'Docker' | 'Docker Compose' | 'Docker Daemon'
  status: 'loading' | boolean
}

interface HelpUrls {
  git: string
  docker: string
  compose: string
  dockerDaemon: string
}

const url: HelpUrls = {
  git: 'https://git-scm.com/install',
  docker: 'https://docs.docker.com/get-started/get-docker/',
  compose: 'https://docs.docker.com/compose/',
  dockerDaemon: 'https://docs.docker.com/engine/daemon/start/'
}
const Splash = () => {
  const navigate = useNavigate()

  const [depStatus, setDepStatus] = useState<DepStatus[]>([
    { id: 'git', label: 'Git', status: 'loading' },
    { id: 'docker', label: 'Docker', status: 'loading' },
    { id: 'compose', label: 'Docker Compose', status: 'loading' },
    { id: 'dockerDaemon', label: 'Docker Daemon', status: 'loading' },
  ])

  const [time, setTime] = useState<number>(5)
  const [allOk, setAllOk] = useState<boolean>(false)

  const timers = useRef<{
    interval?: ReturnType<typeof setInterval>
    timeout?: ReturnType<typeof setTimeout>
  }>({})

  const clearTimers = () => {
    if (timers.current.interval) clearInterval(timers.current.interval)
    if (timers.current.timeout) clearTimeout(timers.current.timeout)
    timers.current = {}
  }

  const startCountdown = () => {
    clearTimers() 

    timers.current.interval = setInterval(() => {
      setTime(prev => (prev <= 0 ? 0 : prev - 1))
    }, 1000)

    timers.current.timeout = setTimeout(() => {
      clearTimers()
      navigate('/home')
    }, 5000)
  }

  const checkDependency = async () => {
    const [git, docker, compose, dockerDaemon] = await Promise.all([
      window.api.process.checkDependency('git'),
      window.api.process.checkDependency('docker'),
      window.api.process.checkDependency('compose'),
      window.api.process.checkDependency('dockerDaemon'),
    ])

    setDepStatus((prev) => {
      return prev.map((item) => {
        if (item.id === 'git') {
          return { ...item, status: git }
        }
        else if (item.id === 'docker') {
          return { ...item, status: docker }
        }
        else if (item.id === 'compose') {
          return { ...item, status: compose }
        }
        else if (item.id === 'dockerDaemon') {
          return { ...item, status: dockerDaemon }
        }
        else {
          return item
        }
      })
    })

    const ok = git === true && docker === true && compose === true && dockerDaemon === true
    setAllOk(ok)

    if (ok) {
      startCountdown()
    }
  }

  useEffect(() => {
    checkDependency()
    return clearTimers
  }, [])

  return (
    <div className="splash">
      <div className="splash-card">
        <div className="splash-animation">
          <img src={splash} alt="" />
        </div>

        <h1 className="splash-title">CRCE Cyber Lab</h1>
        <p className="splash-subtitle">Academic cybersecurity lab environment</p>

        <ul className="splash-checks" aria-label="Environment checks">
          {depStatus.map(({ id, label, status }) => {
            return (
              <li key={id} className="splash-check">
                <span className="splash-check-label">{label}</span>
                <span className="splash-check-state">
                  {
                    status === 'loading' ?
                      <Loading size={20} />
                      :
                      status ?
                        <span
                          className="splash-check-icon splash-check-icon--pass"
                          role="img"
                          aria-label={`${label} passed`}
                          title="Passed"
                        >
                          <CircleCheck size={20} color='var(--color-success)' />
                        </span>
                        :
                        <button
                          type="button"
                          className="splash-check-btn"
                          onClick={() => window.api.openURL(url[id])}
                        >
                          Go
                          <MoveRight size={14} />
                        </button>
                  }
                </span>
              </li>)
          })}
        </ul>

        {
          allOk ?
            <button
              type="button"
              className="splash-cta"
              onClick={() => {
                navigate('/home')
              }}
            >
              {`Let's Go (${time})`}
            </button>
            :
            <button
              type="button"
              className="splash-cta"
              onClick={checkDependency}
            >
              Recheck Dependency
            </button>
        }
      </div>
    </div>
  )
}

export default Splash
