import {
  ArrowRight,
  Bug,
  Globe,
  KeyRound,
  Lock,
  Network,
  ShieldAlert,
  Terminal
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../Sass/Components/ExperimentCard.scss'

interface ExperimentCardProps {
  experiment: Experiment
  onStart?: (experiment: Experiment) => void
}

const CATEGORY_ICONS = {
  'Web Security': Globe,
  System: Terminal,
  Network: Network,
  Cryptography: KeyRound,
  'Authentication Security': Lock,
  'Malware Analysis': Bug
} as const

const DIFFICULTY_CLASSES: Record<string, string> = {
  Beginner: 'diff-beginner',
  Intermediate: 'diff-intermediate',
  Advanced: 'diff-advanced'
}

const ExperimentCard = ({ experiment, onStart }: ExperimentCardProps) => {
  const Icon = CATEGORY_ICONS[experiment.category] ?? ShieldAlert
  const diffClass = DIFFICULTY_CLASSES[experiment.difficulty] ?? 'diff-intermediate'

  return (
    <article className="exp-card">
      <div className="exp-card-body">
        <div className="exp-card-top">
          <div className="exp-card-icon-box">
            <Icon size={18} />
          </div>
          <div className="exp-card-badges">
            <span className="exp-category-pill">{experiment.category}</span>
            <span className={`exp-diff-pill ${diffClass}`}>{experiment.difficulty}</span>
          </div>
        </div>

        <h3 className="exp-card-title">{experiment.title}</h3>
        <p className="exp-card-desc">{experiment.description}</p>
      </div>

      <div className="exp-card-footer">
        <div className="exp-card-meta-info">
          {experiment.port && (
            <span className="exp-port-tag">
              Port {experiment.port}
            </span>
          )}
        </div>

        <button
          type="button"
          className="exp-card-btn"
          onClick={() => onStart?.(experiment)}
        >
          <span>Open Lab</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </article>
  )
}

export default ExperimentCard
