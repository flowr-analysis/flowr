import { LocalScope } from '../graph'
import { Environment, REnvironmentInformation } from './environment'

/** Add a new local environment scope to the stack */
export function pushLocalEnvironment(base: REnvironmentInformation): REnvironmentInformation {
  const local = new Environment(LocalScope)
  return {
    global: base.global,
    local:  [local, ...base.local]
  }
}

export function popLocalEnvironment(base: REnvironmentInformation): REnvironmentInformation {
  // TODO: ensure that there always is an environment
  base.local.shift()
  return {
    global: base.global,
    local:  base.local
  }
}
