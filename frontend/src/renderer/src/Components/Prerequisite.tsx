import { useState, useEffect, ReactNode, MouseEvent, Dispatch, SetStateAction, useRef } from 'react'
import { CheckComponent, CheckPoint } from '@renderer/Layouts/Welcome'
import { useNavigate } from 'react-router'
import Loading from './Loading'
import Config from '../Assets/configuration.png'
import '../Sass/Components/Prerequisite.scss'
import { toast } from 'react-toastify'
import { RotateCcw } from 'lucide-react'

interface PropType {
  setCheckPoint: Dispatch<SetStateAction<CheckPoint[]>>
  setCheckComponent: Dispatch<SetStateAction<CheckComponent>>
  agreed: boolean
}

interface DepStatus {
  git: 'loading' | boolean
  docker: 'loading' | boolean
  compose: 'loading' | boolean
  dockerDaemon: 'loading' | boolean
}

interface URL {
  git: string
  docker: string
  compose: string
  dockerDaemon: string
}

const Prerequisite = ({ setCheckPoint, setCheckComponent, agreed }: PropType) => {

  const navigate = useNavigate();

  const url: URL = {
    git: 'https://git-scm.com/install',
    docker: 'https://docs.docker.com/get-started/get-docker/',
    compose: 'https://docs.docker.com/compose/',
    dockerDaemon: 'https://docs.docker.com/engine/daemon/start/'
  }

  const [depStatus, setDepStatus] = useState<DepStatus>({
    git: 'loading',
    docker: 'loading',
    compose: 'loading',
    dockerDaemon: 'loading',
  })

  const allOk = useRef<boolean>(false)

  const checkDependency = async () => {
    const [git, docker, compose, dockerDaemon] = await Promise.all([
      window.api.process.checkDependency('git'),
      window.api.process.checkDependency('docker'),
      window.api.process.checkDependency('compose'),
      window.api.process.checkDependency('dockerDaemon'),
    ])
    setDepStatus({ git, docker, compose, dockerDaemon })
    allOk.current = git === true && docker === true && compose === true && dockerDaemon === true

    if (allOk.current) {
      setCheckPoint((prev: CheckPoint[]) => {
        return prev.map((item) => {
          if (item.id == 'pr') {
            return { ...item, state: 'done' }
          }
          return item
        })
      })
    }
  }

  const renderStatus = (status: 'loading' | boolean): ReactNode => {
    if (status === 'loading') return <Loading size={15} />
    return status ? <span style={{ color: 'var(--color-success)' }}>✔</span> : <span style={{ color: 'var(--color-danger)' }}>✗</span>
  }

  useEffect(() => { checkDependency() }, [])

  const openUrl = async (e: MouseEvent<HTMLAnchorElement>, url: string): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.openURL(url)
    } catch (err) {
      toast.error('failed to open link in browser')
    }
  }

  const handleBackCheckPoint = (prev: CheckPoint[]): CheckPoint[] => {
    return prev.map((item) => {
      if (item.id == 'tc') {
        return { ...item, state: 'active' }
      }
      if (item.id == 'pr') {
        return { ...item, state: null }
      }
      return item
    })
  }

  return (
    <div className='prerequisite'>
      <div className='cp-img'>
        <img src={Config} alt="hello" />
      </div>

      <div className="cp-text">
        <h1>Prerequisite</h1>
        <p>In order to run CRCE Cyber Lab, your computer must meet the following requirements.</p>
        <div className="pr-details">
          <span className='pr-detail'>
            {renderStatus(depStatus.docker)} Docker Installed
            <a href="#" onClick={(e) => openUrl(e, url.docker)}>How?</a>
            {!depStatus.docker && <button type="button" className='retry-btn' onClick={checkDependency} title='Recheck'>
              <RotateCcw size={15} color='#fff' />
            </button>}
          </span>
          <span className='pr-detail'>
            {renderStatus(depStatus.compose)} Docker Compose V2 Installed
            <a href="#" onClick={(e) => openUrl(e, url.compose)}>How?</a>
            {!depStatus.compose && <button type="button" className='retry-btn' onClick={checkDependency} title='Recheck'>
              <RotateCcw size={15} color='#fff' />
            </button>}
          </span>
          <span className='pr-detail'>
            {renderStatus(depStatus.dockerDaemon)} Docker Daemon is running
            <a href="#" onClick={(e) => openUrl(e, url.dockerDaemon)}>How?</a>
            {!depStatus.dockerDaemon && <button type="button" className='retry-btn' onClick={checkDependency} title='Recheck'>
              <RotateCcw size={15} color='#fff' />
            </button>}
          </span>
          <span className='pr-detail'>
            {renderStatus(depStatus.git)} Git is installed
            <a href="#" onClick={(e) => openUrl(e, url.git)}>How?</a>
            {!depStatus.git && <button type="button" className='retry-btn' onClick={checkDependency} title='Recheck'>
              <RotateCcw size={15} color='#fff' />
            </button>}
          </span>
        </div>
        <div className="btn-ctn">
          <button
            type="button"
            className='back-btn'
            onClick={() => {
              setCheckPoint(handleBackCheckPoint)
              setCheckComponent('term-cond')
            }}
          >
            Back
          </button>
          <button
            type="button"
            className='next-btn'
            disabled={!allOk.current}
            onClick={() => {
              navigate('/home')
              localStorage.setItem('agreed', String(agreed))
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export default Prerequisite