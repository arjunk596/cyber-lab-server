import React from 'react'
import type { Experiment } from '@shared/experiment'
import { LabExperimentRouter } from './Experiments/LabExperimentRouter'
import '../Sass/Components/LabExperimentView.scss'

interface LabExperimentViewProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

export const LabExperimentView: React.FC<LabExperimentViewProps> = ({
  experiment,
  onComplete
}) => {
  return (
    <div className="lab-experiment-container">
      <LabExperimentRouter experiment={experiment} onComplete={onComplete} />
    </div>
  )
}

export default LabExperimentView
