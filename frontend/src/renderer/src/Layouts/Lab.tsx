import React, { Dispatch, SetStateAction, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  Bug,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  List,
  Sparkles,
  Target,
  Terminal as TerminalIcon,
  type LucideIcon
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'react-toastify'
import type { Experiment } from '@shared/experiment'
import LabInfo from '@renderer/Components/LabInfo'
import LabExperimentView from '@renderer/Components/LabExperimentView'
import LabDefencesView from '@renderer/Components/LabDefencesView'
import LabQuizView from '@renderer/Components/LabQuizView'
import LabReviewView from '@renderer/Components/LabReviewView'
import LabTerminalDrawer from '@renderer/Components/LabTerminalDrawer'
import LabFeedbackModal from '@renderer/Components/LabFeedbackModal'
import LabReportIssueModal from '@renderer/Components/LabReportIssueModal'
import '../Sass/Layouts/Lab.scss'

interface Proptype {
  setMenuVisiblity: Dispatch<SetStateAction<boolean>>
}

export type LabWorkflowStage = 'theory' | 'experiment' | 'defences' | 'quiz' | 'review'

interface StageMeta {
  id: LabWorkflowStage
  num: string
  label: string
}

const STAGES: StageMeta[] = [
  { id: 'theory', num: '01', label: 'Theory' },
  { id: 'experiment', num: '02', label: 'Experiment' },
  { id: 'defences', num: '03', label: 'Defences' },
  { id: 'quiz', num: '04', label: 'Quiz' },
  { id: 'review', num: '05', label: 'Review' }
]

interface TheorySection {
  key: string
  label: string
  icon: LucideIcon
}

const THEORY_SECTIONS: TheorySection[] = [
  { key: 'aim', label: 'Aim', icon: Flag },
  { key: 'objective', label: 'Objective', icon: Target },
  { key: 'theory', label: 'Theory', icon: BookOpen },
  { key: 'procedure', label: 'Procedure', icon: List },
  { key: 'references', label: 'References', icon: BookOpenText }
]

const Lab: React.FC<Proptype> = ({ setMenuVisiblity }) => {
  const navigate = useNavigate()

  const experiment: Experiment | null = useMemo(() => {
    try {
      const saved = sessionStorage.getItem('lab-experiment')
      if (saved) return JSON.parse(saved) as Experiment
    } catch {
      // ignore
    }
    return null
  }, [])

  // Workflow Stage State
  const [currentStage, setCurrentStage] = useState<LabWorkflowStage>('theory')
  const [completedStages, setCompletedStages] = useState<Set<LabWorkflowStage>>(new Set(['theory']))
  const [quizScore, setQuizScore] = useState<number>(0)
  const [isQuizPassed, setIsQuizPassed] = useState<boolean>(false)

  // Modals & Drawers
  const [isTerminalOpen, setIsTerminalOpen] = useState<boolean>(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false)
  const [isIssueModalOpen, setIsIssueModalOpen] = useState<boolean>(false)

  // Theory docs state
  const [currTheoryKey, setCurrTheoryKey] = useState<string>('aim')
  const [labInfo, setLabInfo] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<boolean>(false)
  const [labRunning, setLabRunning] = useState<boolean>(false)

  const latestRef = useRef({ experiment, currTheoryKey })
  latestRef.current = { experiment, currTheoryKey }

  useEffect(() => {
    return () => {
      if (!window.location.hash.startsWith('#/lab')) {
        void window.api.lab.stop()
      }
    }
  }, [])

  useEffect(() => {
    let alive = true
    const off = window.api.lab.onStatus((next) => {
      if (alive) setLabRunning(next.phase === 'running')
    })
    window.api.lab
      .status()
      .then((snapshot) => {
        if (alive) setLabRunning(snapshot.status.phase === 'running')
      })
      .catch(() => undefined)

    return () => {
      alive = false
      off()
    }
  }, [])

  const fetchTheoryContent = async (url: string, key: string) => {
    if (!experiment) return
    try {
      setCurrTheoryKey(key)
      setLoading(true)

      // 1. Try local verified backend documentation first (eliminates 404s completely)
      try {
        const localRes = await fetch(
          `http://localhost:8000/docs/${experiment.github_repo_name}/${key}`
        )
        if (localRes.ok) {
          const localData = await localRes.text()
          if (localData && localData.trim().length > 0) {
            setLabInfo(localData)
            setError(false)
            return
          }
        }
      } catch {
        // Fallback to remote url
      }

      // 2. Fetch from remote repository raw url
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: string = await res.text()
      setLabInfo(data)
      setError(false)
    } catch (e) {
      setError(true)
      setLabInfo('')
      if (!navigator.onLine) {
        toast.error('Device is offline')
      } else {
        toast.error(`Unable to load ${key} documentation`)
      }
    } finally {
      setLoading(false)
    }
  }

  const refetch = useCallback(() => {
    const { experiment: s, currTheoryKey: k } = latestRef.current
    if (!s?.[k]) return Promise.resolve()
    return fetchTheoryContent(s[k], k)
  }, [])

  useEffect(() => {
    if (!experiment) {
      navigate('/home', { replace: true })
      return
    }

    fetchTheoryContent(experiment.aim, 'aim')
    setMenuVisiblity(false)
  }, [experiment, navigate, setMenuVisiblity])

  // Sequential Stage Navigation
  const currentStageIndex = STAGES.findIndex((s) => s.id === currentStage)
  const prevStage = currentStageIndex > 0 ? STAGES[currentStageIndex - 1] : null
  const nextStage = currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null

  const goToStage = (stageId: LabWorkflowStage) => {
    setCurrentStage(stageId)
    // Mark as visited/completed
    setCompletedStages((prev) => new Set([...prev, stageId]))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNextStage = () => {
    if (nextStage) {
      goToStage(nextStage.id)
    }
  }

  const handlePrevStage = () => {
    if (prevStage) {
      goToStage(prevStage.id)
    }
  }

  const handleExperimentComplete = () => {
    setCompletedStages((prev) => new Set([...prev, 'experiment']))
    toast.success('Hands-on experiment completed! Proceed to Defences.')
  }

  const handleQuizPass = (score: number) => {
    setQuizScore(score)
    setIsQuizPassed(true)
    setCompletedStages((prev) => new Set([...prev, 'quiz']))
    toast.success(`Quiz passed with ${score}%! You are now eligible for certification.`)
  }

  if (!experiment) return null

  return (
    <section className="lab-workspace">
      {/* Top Application Sub-Header */}
      <div className="lab-top-nav no-print">
        <div className="nav-left">
          <button
            type="button"
            className="back-btn"
            onClick={() => navigate('/home')}
            title="Return to Experiment Catalog"
          >
            <ArrowLeft size={16} />
            <span>Catalogue</span>
          </button>

          <div className="lab-title-group">
            <h1 className="lab-title">{experiment.title}</h1>
            <span className="lab-category-tag">{experiment.category}</span>
          </div>
        </div>

        {/* 5-Stage Sequential Learning Workflow Navigation */}
        <div className="mode-tabs">
          {STAGES.map((s) => {
            const isActive = currentStage === s.id
            const isDone = completedStages.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                className={`mode-pill ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                onClick={() => goToStage(s.id)}
              >
                {isDone && !isActive ? (
                  <CheckCircle2 size={13} className="pill-check" />
                ) : (
                  <span className="pill-num">{s.num}</span>
                )}
                <span>{s.label}</span>
              </button>
            )
          })}

          {/* Contextual Terminal Drawer Toggle */}
          <button
            type="button"
            className={`mode-pill terminal-pill ${isTerminalOpen ? 'active' : ''}`}
            onClick={() => setIsTerminalOpen((prev) => !prev)}
            title="Open Contextual Terminal Drawer"
          >
            <TerminalIcon size={13} />
            <span>Terminal</span>
            {labRunning && <span className="running-dot" title="Container active" />}
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="lab-content-area">
        {/* Stage 01: Theory */}
        {currentStage === 'theory' && (
          <div className="theory-layout">
            <aside className="theory-sidebar no-print">
              <div className="theory-btn-group">
                {THEORY_SECTIONS.map((sec) => {
                  const Icon = sec.icon
                  return (
                    <button
                      key={sec.key}
                      type="button"
                      className={`theory-nav-item ${sec.key === currTheoryKey ? 'active' : ''}`}
                      onClick={() => fetchTheoryContent(experiment[sec.key], sec.key)}
                    >
                      <Icon size={15} />
                      <span>{sec.label}</span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                className="report-issue-btn"
                onClick={() => setIsIssueModalOpen(true)}
                title="Report an issue or submit direct feedback for this lab"
              >
                <Bug size={14} />
                <span>Report Lab Issue</span>
              </button>
            </aside>

            <main className="theory-main">
              <LabInfo
                refetch={refetch}
                error={error}
                experiment={experiment}
                currBtnInfo={currTheoryKey}
                loading={loading}
                labInfo={labInfo}
              />
            </main>
          </div>
        )}

        {/* Stage 02: Real Hands-On Experiment */}
        {currentStage === 'experiment' && (
          <div className="experiment-layout">
            <LabExperimentView
              experiment={experiment}
              onOpenTerminal={() => setIsTerminalOpen(true)}
              onComplete={handleExperimentComplete}
            />
          </div>
        )}

        {/* Stage 03: Lab-Specific Defences */}
        {currentStage === 'defences' && (
          <div className="defences-layout">
            <LabDefencesView experiment={experiment} />
          </div>
        )}

        {/* Stage 04: Lab-Specific Quiz Assessment */}
        {currentStage === 'quiz' && (
          <div className="quiz-layout">
            <LabQuizView
              repoName={experiment.github_repo_name}
              labTitle={experiment.title}
              onPass={handleQuizPass}
            />
          </div>
        )}

        {/* Stage 05: Review, Student Verification & Certificate */}
        {currentStage === 'review' && (
          <div className="review-layout">
            <LabReviewView
              experiment={experiment}
              isQuizCompleted={isQuizPassed}
              quizScore={quizScore}
              onOpenFeedback={() => setIsFeedbackOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Sequential Stage Bottom Navigation Footer */}
      <footer className="lab-stage-nav-footer no-print">
        <div className="nav-footer-inner">
          <div className="footer-left">
            {prevStage ? (
              <button
                type="button"
                className="stage-nav-btn prev"
                onClick={handlePrevStage}
              >
                <ChevronLeft size={16} />
                <span>Previous: {prevStage.label}</span>
              </button>
            ) : (
              <div />
            )}
          </div>

          <div className="footer-center">
            <span className="stage-status-text">
              Stage {currentStageIndex + 1} of {STAGES.length}:{' '}
              <strong>{STAGES[currentStageIndex].label}</strong>
            </span>
          </div>

          <div className="footer-right">
            {nextStage ? (
              <button
                type="button"
                className="stage-nav-btn next primary"
                onClick={handleNextStage}
              >
                <span>Next: {nextStage.label}</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="stage-nav-btn next feedback-btn"
                onClick={() => setIsFeedbackOpen(true)}
              >
                <Sparkles size={15} />
                <span>Submit Feedback</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Contextual Pop-up Terminal Drawer */}
      <LabTerminalDrawer
        isOpen={isTerminalOpen}
        onClose={() => setIsTerminalOpen(false)}
        experiment={experiment}
      />

      {/* Post-Lab Feedback Modal */}
      <LabFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        experimentId={experiment.id}
        labTitle={experiment.title}
      />

      {/* In-App Lab Issue & Feedback Reporting Modal */}
      <LabReportIssueModal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        experiment={experiment}
      />
    </section>
  )
}

export default Lab
