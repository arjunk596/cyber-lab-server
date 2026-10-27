import React from 'react'
import type { Experiment } from '@shared/experiment'
import { SynFloodExperiment } from './SynFloodExperiment'
import { RsaExperiment } from './RsaExperiment'
import { BufferOverflowExperiment } from './BufferOverflowExperiment'
import { PacketSniffingExperiment } from './PacketSniffingExperiment'
import { DosDdosExperiment } from './DosDdosExperiment'
import { TrojanHorseExperiment } from './TrojanHorseExperiment'

interface LabExperimentRouterProps {
  experiment: Experiment
  onComplete?: () => void
}

export const LabExperimentRouter: React.FC<LabExperimentRouterProps> = ({
  experiment,
  onComplete
}) => {
  const repo = experiment.github_repo_name.toLowerCase()

  if (repo === 'css_mini') {
    return <SynFloodExperiment experiment={experiment} onComplete={onComplete} />
  }

  if (repo === 'css-lab-simulation') {
    return <RsaExperiment experiment={experiment} onComplete={onComplete} />
  }

  if (repo === 'css-lab-boa') {
    return <BufferOverflowExperiment experiment={experiment} onComplete={onComplete} />
  }

  if (repo === 'packet_spoofing') {
    return <PacketSniffingExperiment experiment={experiment} onComplete={onComplete} />
  }

  if (repo === 'css-virtual-lab') {
    return <DosDdosExperiment experiment={experiment} onComplete={onComplete} />
  }

  if (repo === 'trojan-horse-mcp') {
    return <TrojanHorseExperiment experiment={experiment} onComplete={onComplete} />
  }

  // Fallback to Syn Flood or generic if unknown
  return <SynFloodExperiment experiment={experiment} onComplete={onComplete} />
}
export default LabExperimentRouter
