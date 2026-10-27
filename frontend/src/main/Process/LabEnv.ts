export interface LabShellEnv {
  COMPOSE_PROJECT_NAME?: string
  COMPOSE_FILE?: string
}

let current: LabShellEnv = {}

export const setLabShellEnv = (env: LabShellEnv): void => {
  current = env
}

export const getLabShellEnv = (): LabShellEnv => current
