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

const CATEGORY_ACCENTS = {
  'Web Security': 'violet',
  System: 'rose',
  Network: 'sky',
  Cryptography: 'fuchsia',
  'Authentication Security': 'indigo',
  'Malware Analysis': 'amber'
} as const

const ExperimentCard = ({ experiment, onStart }: ExperimentCardProps) => {
  const Icon = CATEGORY_ICONS[experiment.category] ?? ShieldAlert
  const accent = CATEGORY_ACCENTS[experiment.category] ?? 'sky'

  return (
    <article className="exp-card">
      <div className="exp-card-body">
        <div className="exp-card-top">
          <span className={`exp-card-icon accent-${accent}`}>
            <Icon size={18} />
          </span>
          <span className="exp-card-meta">
            {experiment.category} • {experiment.difficulty}
          </span>
        </div>

        <h3 className="exp-card-title">{experiment.title}</h3>
        <p className="exp-card-desc">{experiment.description}</p>
      </div>

      <div className="exp-card-footer">
        <button
          type="button"
          className="exp-card-btn"
          onClick={() => onStart?.(experiment)}
        >
          Start Lab
          <ArrowRight size={15} />
        </button>
      </div>
    </article>
  )
}

export default ExperimentCard
