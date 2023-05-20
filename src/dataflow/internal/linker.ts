import { DataflowGraph } from '../graph'
import { IdentifierReference, REnvironmentInformation, resolveByName } from '../environments'
import { DefaultMap } from '../../util/defaultmap'
import { guard } from '../../util/assert'
import { DataflowProcessorDown } from '../processor'

/* TODO: use environments for the default map */
export function linkIngoingVariablesInSameScope(graph: DataflowGraph, references: IdentifierReference[]): void {
  const nameIdShares = produceNameSharedIdMap(references)
  linkReadVariablesInSameScopeWithNames(graph, nameIdShares)
}

export function produceNameSharedIdMap(references: IdentifierReference[]): DefaultMap<string, IdentifierReference[]> {
  const nameIdShares = new DefaultMap<string, IdentifierReference[]>(() => [])
  for(const reference of references) {
    nameIdShares.get(reference.name).push(reference)
  }
  return nameIdShares
}

export function linkReadVariablesInSameScopeWithNames(graph: DataflowGraph, nameIdShares: DefaultMap<string, IdentifierReference[]>) {
  for (const ids of nameIdShares.values()) {
    if (ids.length <= 1) {
      continue
    }
    const base = ids[0]
    for (let i = 1; i < ids.length; i++) {
      // TODO: include the attribute? probably not, as same-edges are independent of structure
      graph.addEdge(base.nodeId, ids[i].nodeId, 'same-read-read', 'always')
    }
  }
}

export function setDefinitionOfNode(graph: DataflowGraph, reference: IdentifierReference): void {
  const node = graph.get(reference.nodeId)
  guard(node !== undefined, () => `node must be defined for ${JSON.stringify(reference)} to set definition scope to ${reference.scope}`)
  guard(node.definedAtPosition === false || node.definedAtPosition === reference.scope, () => `node must not be previously defined at position or have same scope for ${JSON.stringify(reference)}`)
  node.definedAtPosition = reference.scope
}

export function linkInputs<OtherInfo>(refererncesToLinkAgainstEnvironment: IdentifierReference[], down: DataflowProcessorDown<OtherInfo>, environmentInformation: REnvironmentInformation, setInputs: IdentifierReference[], graph: DataflowGraph): IdentifierReference[] {
  for (const bodyInput of refererncesToLinkAgainstEnvironment) {
    const probableTarget = resolveByName(bodyInput.name, down.scope, environmentInformation)
    if (probableTarget === undefined) {
      setInputs.push(bodyInput)
    } else if (probableTarget.length === 1) {
      graph.addEdge(bodyInput, probableTarget[0], 'read')
    } else {
      for (const target of probableTarget) {
        // we can stick with maybe even if readId.attribute is always
        graph.addEdge(bodyInput, target, 'read')
      }
    }
    // down.graph.get(node.id).definedAtPosition = false
  }
  return setInputs
}
