export type LabPhase = 'idle' | 'cloning' | 'starting' | 'running' | 'stopping'

export interface LabStatus {
  phase: LabPhase
  repoName?: string
  repoPath?: string
  webPort?: number
  webUrl?: string
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
  port?: number
}

export interface LabSnapshot {
  status: LabStatus
  log: LabLog[]
}
