export type LabPhase = 'idle' | 'cloning' | 'starting' | 'running' | 'stopping'

export interface LabStatus {
  phase: LabPhase
  repoName?: string
  repoPath?: string
  error?: string
}

export type LabLogStream = 'out' | 'err' | 'sys'

export interface LabLog {
  stream: LabLogStream
  line: string
}

export interface LabStartOptions {
  url: string
  repoName?: string
}

export interface LabSnapshot {
  status: LabStatus
  log: LabLog[]
}
