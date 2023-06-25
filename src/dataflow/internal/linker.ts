import { DataflowGraph, DataflowGraphNodeInfo, DataflowScopeName } from '../graph'
import { BuiltIn, IdentifierReference, REnvironmentInformation, resolveByName } from '../environments'
import { DefaultMap } from '../../util/defaultmap'
import { guard } from '../../util/assert'
import { log } from '../../util/log'
import { NodeId } from '../../r-bridge'
import { slicerLogger } from '../../slicing/static'

export function linkIngoingVariablesInSameScope(graph: DataflowGraph, references: IdentifierReference[]): void {
  const nameIdShares = produceNameSharedIdMap(references)
  linkReadVariablesInSameScopeWithNames(graph, nameIdShares)
}

export type NameIdMap = DefaultMap<string, IdentifierReference[]>

export function produceNameSharedIdMap(references: IdentifierReference[]): NameIdMap {
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
      graph.addEdge(base.nodeId, ids[i].nodeId, 'same-read-read', 'always', true)
    }
  }
}

export function linkFunctionCallExitPoints(graph: DataflowGraph): void {
  const calls = [...graph.nodes()]
    .filter(([_,info]) => info.tag === 'function-call')


  for(const [id, info] of calls) {
    const functionDefinitionReadIds = info.edges.filter(e => e.type === 'read' || e.type === 'calls').map(e => e.target)
    const functionDefs = getAllLinkedFunctionDefinitions(functionDefinitionReadIds, graph)
    for(const defs of functionDefs.values()) {
      guard(defs.tag === 'function-definition', () => `expected function definition, but got ${defs.tag}`)
      const exitPoints = defs.exitPoints
      for(const exitPoint of exitPoints) {
        graph.addEdge(id, exitPoint, 'returns', 'always')
      }
    }
  }
}


// TODO: abstract away into a 'getAllDefinitionsOf' function
export function getAllLinkedFunctionDefinitions(functionDefinitionReadIds: NodeId[], dataflowGraph: DataflowGraph): Map<NodeId, DataflowGraphNodeInfo> {
  const potential: NodeId[] = functionDefinitionReadIds
  const result = new Map<NodeId, DataflowGraphNodeInfo>()
  while(potential.length > 0) {
    const currentId = potential.pop() as NodeId
    if(currentId === BuiltIn) {
      // do not traverse builtins
      slicerLogger.trace('skipping builtin function definition during collection')
      continue
    }
    const currentInfo = dataflowGraph.get(currentId, true)
    if(currentInfo === undefined) {
      slicerLogger.trace(`skipping unknown link`)
      continue
    }


    if(currentInfo.subflow !== undefined) {
      result.set(currentId, currentInfo)
    }
    // trace all joined reads
    // TODO: deal with redefinitions?
    potential.push(...currentInfo.edges.filter(e => e.type === 'read' || e.type === 'defined-by' || e.type === 'calls').map(e => e.target))
  }
  return result
}

/**
 * This method links a set of read variables to definitions in an environment.
 *
 * @param referencesToLinkAgainstEnvironment - the set of references to link against the environment
 * @param scope - the scope in which the linking shall happen (probably the active scope of {@link DataflowProcessorInformation})
 * @param environmentInformation - the environment information to link against
 * @param givenInputs - the existing list of inputs that might be extended
 * @param graph - the graph to enter the found links
 * @param maybeForRemaining - each input that can not be linked, will be added to `givenInputs`. If this flag is `true`, it will be marked as `maybe`.
 *
 * @returns the given inputs, possibly extended with the remaining inputs (those of `referencesToLinkAgainstEnvironment` that could not be linked against the environment)
 */
export function linkInputs(referencesToLinkAgainstEnvironment: IdentifierReference[], scope: DataflowScopeName, environmentInformation: REnvironmentInformation, givenInputs: IdentifierReference[], graph: DataflowGraph, maybeForRemaining: boolean): IdentifierReference[] {
  for (const bodyInput of referencesToLinkAgainstEnvironment) {
    const probableTarget = resolveByName(bodyInput.name, scope, environmentInformation)
    if (probableTarget === undefined) {
      log.trace(`found no target for ${bodyInput.name} in ${scope}`)
      if(maybeForRemaining) {
        bodyInput.used = 'maybe'
      }
      givenInputs.push(bodyInput)
    } else if (probableTarget.length === 1) {
      graph.addEdge(bodyInput, probableTarget[0], 'read', undefined, true)
    } else {
      for (const target of probableTarget) {
        // we can stick with maybe even if readId.attribute is always
        graph.addEdge(bodyInput, target, 'read', undefined, true)
      }
    }
    // down.graph.get(node.id).definedAtPosition = false
  }
  return givenInputs
}

/** all loops variables which are open read (not already bound by a redefinition within the loop) get a maybe read marker to their last definition within the loop
 * e.g. with:
 * ```R
 * for(i in 1:10) {
 *  x_1 <- x_2 + 1
 * }
 * ```
 * `x_2` must get a read marker to `x_1` as `x_1` is the active redefinition in the second loop iteration.
 */
export function linkCircularRedefinitionsWithinALoop(graph: DataflowGraph, openIns: NameIdMap, outgoing: IdentifierReference[]): void {
  // first we preprocess out so that only the last definition of a given identifier survives
  // this implicitly assumes that the outgoing references are ordered
  const lastOutgoing = new Map<string, IdentifierReference>()
  for(const out of outgoing) {
    lastOutgoing.set(out.name, out)
  }
  for(const [name, targets] of openIns.entries()) {
    for(const out of lastOutgoing.values()) {
      if(out.name === name) {
        for(const target of targets) {
          graph.addEdge(target.nodeId, out.nodeId, 'read', 'maybe')
        }
      }
    }
  }
}
