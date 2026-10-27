import { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef, Activity } from 'react'
import { BookOpen, Flag, List, Play, Target, BookOpenText, type LucideIcon, Bug } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import type { Experiment } from '@shared/experiment'
import LabInfo from '@renderer/Components/LabInfo'
import '../Sass/Layouts/Lab.scss'
import LabSimulation from '@renderer/Components/LabSimulation'

interface Proptype {
  setMenuVisiblity: Dispatch<SetStateAction<boolean>>
}

interface Section {
  key: string
  label: string
  icon: LucideIcon
}

const section: Section[] = [
  { key: 'aim', label: 'Aim', icon: Flag },
  { key: 'theory', label: 'Theory', icon: BookOpen },
  { key: 'objective', label: 'Objective', icon: Target },
  { key: 'procedure', label: 'Procedure', icon: List },
  { key: 'references', label: 'Reference', icon: BookOpenText },
  { key: 'simulation', label: 'Simulation', icon: Play }

] as const

const Lab = ({ setMenuVisiblity }: Proptype) => {
  const navigate = useNavigate()

  const experiment: Experiment | null = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('lab-experiment')
      if (saved) return JSON.parse(saved) as Experiment
    } catch { }
    return null
  }, [])

  const [labInfo, setLabInfo] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [currBtnInfo, setcurrBtnInfo] = useState<string>('aim')
  const [error, setError] = useState<boolean>(false)
  const [labRunning, setLabRunning] = useState<boolean>(false)
  const latestRef = useRef({ experiment, currBtnInfo })
  latestRef.current = { experiment, currBtnInfo }

  useEffect(() => {
    return () => {
      if (!window.location.hash.startsWith('#/lab')) {
        void window.api.lab.stop()
      }
    }
  }, [])

  useEffect(() => {
    let alive = true
    const off = window.api.lab.onStatus((next) => setLabRunning(next.phase === 'running'))
    window.api.lab.status()
      .then((snapshot) => { if (alive) setLabRunning(snapshot.status.phase === 'running') })
      .catch(() => undefined)
    return () => {
      alive = false
      off()
    }
  }, [])

  const refetch = useCallback(() => {
    const { experiment: s, currBtnInfo: k } = latestRef.current
    if (!s?.[k]) return Promise.resolve()
    return fetchLabInfo(s[k], k)
  }, [])

  const fetchLabInfo = async (url: string, currBtnInfo: string) => {
    try {
      setcurrBtnInfo(currBtnInfo)
      setLoading(true)
      const res = await fetch(url);
      const data: string = await res.text();
      setLabInfo(data)
      setError(false)
    }
    catch (e) {
      setLoading(false)
      setError(true)
      setLabInfo('')
      if (!navigator.onLine) {
        toast.error(String('Device is Offline'))
      }
      else {
        toast.error(String(e))
      }

    }
    finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!experiment) {
      navigate('/home', { replace: true })
      return
    }

    fetchLabInfo(experiment.aim, 'aim')
    setMenuVisiblity(false)
  }, [])

  return (
    <section className='lab'>
      <div className="sidebar">
        <div className="btn-ctn">
          {
            section.map((item) => {
              return (
                <button
                  key={item.key}
                  className={item.key === currBtnInfo ? 'active' : ''}
                  type="button"
                  onClick={() => {
                    if (!experiment) return
                    fetchLabInfo(experiment[item.key], item.key)
                  }}
                >
                  {<item.icon />}{item.label}
                  {
                    item.key === 'simulation' && labRunning &&
                    <span className="lab-live-dot" title="Lab is running" />
                  }
                </button>
              )
            })
          }
        </div>
        <button
          type="button"
          className='report-issue-btn'
          onClick={() => {
            if (!experiment) return
            window.api.openURL(experiment.github_issue_url)
          }}
        >
          <Bug size={18} />Report Lab Issue
        </button>
      </div>

      <Activity mode={currBtnInfo === 'simulation' ? 'hidden' : 'visible'}>
        <LabInfo
          refetch={refetch}
          error={error}
          experiment={experiment}
          currBtnInfo={currBtnInfo}
          loading={loading}
          labInfo={labInfo}
        />
      </Activity>

      <Activity mode={currBtnInfo === 'simulation' ? 'visible' : 'hidden'}>
        <LabSimulation experiment={experiment}/>
      </Activity>
    </section >
  )
}

export default Lab
