export type ExperimentCategory =
  | 'Web Security'
  | 'System'
  | 'Network'
  | 'Cryptography'
  | 'Authentication Security'
  | 'Malware Analysis'
export type ExperimentDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'

export interface Experiment {
  id: string
  title: string
  description: string
  category: ExperimentCategory
  difficulty: ExperimentDifficulty
  github_url: string
  github_repo_name: string
  github_issue_url: string
  aim: string
  theory: string
  objective: string
  procedure: string
  references: string
}

export const CATEGORIES: Array<'All' | ExperimentCategory> = [
  'All',
  'Web Security',
  'System',
  'Network',
  'Cryptography',
  'Authentication Security',
  'Malware Analysis'
]

export const DIFFICULTIES: Array<'All Difficulties' | ExperimentDifficulty> = [
  'All Difficulties',
  'Beginner',
  'Intermediate',
  'Advanced'
]
