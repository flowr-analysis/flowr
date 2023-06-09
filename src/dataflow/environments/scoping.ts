import { LocalScope } from '../graph'
import { Environment, IEnvironment, REnvironmentInformation } from './environment'
import { guard } from '../../util/assert'

// TODO: test and fix
function copyParentList(base: REnvironmentInformation) {
  let parent: IEnvironment | undefined = base.current

  let firstNewParent: IEnvironment | undefined = undefined
  let lastParent: IEnvironment | undefined = undefined
  while(parent !== undefined) {
    const newElement = new Environment(parent.name)
    if(firstNewParent === undefined) {
      firstNewParent = newElement
    }
    newElement.memory = new Map(parent.memory)
    if(lastParent !== undefined) {
      lastParent.parent = newElement
    }
    lastParent = newElement
    parent = parent.parent
  }
  return firstNewParent
}

/** Add a new local environment scope to the stack */
export function pushLocalEnvironment(base: REnvironmentInformation): REnvironmentInformation {
  const local = new Environment(LocalScope)
  local.parent = copyParentList(base)

  return {
    current: local,
    level:   base.level + 1
  }
}

export function popLocalEnvironment(base: REnvironmentInformation): REnvironmentInformation {
  guard(base.level > 0, 'cannot remove the global/root environment')
  const parent = base.current.parent
  guard(parent !== undefined, 'level is wrong, parent is undefined even though level suggested depth > 0 (starts with 0)')
  return {
    current: parent,
    level:   base.level - 1
  }
}
