import { LocalScope } from '../../graph'
import { Environment, Environments } from './environments'

/** Add a new local environment scope to the stack */
export function pushLocalEnvironment(base: Environments): Environments {
  const local = new Environment(LocalScope)
  return {
    global: base.global,
    local:  [local, ...base.local],
    named:  base.named
  }
}

export function popLocalEnvironment(base: Environments): Environments {
  // TODO: ensure that there always is an environment
  base.local.shift()
  return {
    global: base.global,
    local:  base.local,
    named:  base.named
  }
}
