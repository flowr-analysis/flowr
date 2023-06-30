import {
  DataflowGraph,
  DataflowGraphNodeInfo,
  graphToMermaidUrl,
  initializeCleanEnvironments,
  LocalScope, REnvironmentInformation
} from '../../dataflow'
import { guard } from '../../util/assert'
import { DecoratedAstMap, NodeId } from '../../r-bridge'
import { log } from '../../util/log'
import { getAllLinkedFunctionDefinitions } from '../../dataflow/internal/linker'
import { overwriteEnvironments, pushLocalEnvironment, resolveByName } from '../../dataflow/environments'
import objectHash from 'object-hash'

export const slicerLogger = log.getSubLogger({ name: "slicer" })


interface NodeToSlice {
  id:                 NodeId
  /** used for calling context etc. */
  baseEnvironment:    REnvironmentInformation
  /** if we add a function call we may need it only for its side effects (e.g., a redefinition of a global variable), if so, 'returns' links will not be traced */
  onlyForSideEffects: boolean
}



type Fingerprint = string

function fingerprint(visited: NodeToSlice): Fingerprint {
  // we do not use ids of envs in case of (in-)finite recursion
  const envFingerprint = objectHash(visited.baseEnvironment, { excludeKeys: key => key === 'id' })
  return `${visited.id}-${envFingerprint}-${visited.onlyForSideEffects ? '0' : '1'}`
}
/**
 * This returns the ids to include in the slice, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode | reconstruct the slice to R code}.
 */
export function naiveStaticSlicing<OtherInfo>(dataflowGraph: DataflowGraph, dataflowIdMap: DecoratedAstMap<OtherInfo>, id: NodeId[]) {
  guard(id.length > 0, `must have at least one seed id to calculate slice`)
  slicerLogger.trace(`calculating slice for ${id.length} seed ids: ${JSON.stringify(id)}`)

  const visited = new Map<Fingerprint, NodeId>()
  // every node ships the call environment which registers the calling environment
  const visitQueue: NodeToSlice[] = id.map(i => ({ id: i, baseEnvironment: initializeCleanEnvironments(), onlyForSideEffects: false }))

  while (visitQueue.length > 0) {
    const current = visitQueue.pop()

    if (current === undefined) {
      continue
    }
    visited.set(fingerprint(current), current.id)

    const currentInfo = dataflowGraph.get(current.id, true)

    slicerLogger.trace(`visiting id: ${current.id} (${current.onlyForSideEffects ? 'only for side effects' : 'full'}) with name: ${currentInfo?.[0].name ?? '<unknown>'}`)

    if(currentInfo === undefined) {
      slicerLogger.warn(`id: ${current.id} must be in graph but can not be found, keep in slice to be sure`)
      continue
    }

    if(currentInfo[0].tag === 'function-call') {
      slicerLogger.trace(`${current.id} is a function call`)
      linkOnFunctionCall(current, currentInfo[0], dataflowGraph, visited, visitQueue)
    }

    const currentNode = dataflowIdMap.get(current.id)
    guard(currentNode !== undefined, () => `id: ${current.id} must be in dataflowIdMap is not in ${graphToMermaidUrl(dataflowGraph, dataflowIdMap)}`)

    const liveEdges = [...currentInfo[1]].filter(([_, e]) => e.types.has('read') || e.types.has('defined-by') || e.types.has('argument') || e.types.has('calls') || e.types.has('relates') || (!current.onlyForSideEffects && e.types.has('returns')) || e.types.has('defines-on-call') || e.types.has('side-effect-on-call'))
    for (const [target, edge] of liveEdges) {
      const envEdge = { id: target, baseEnvironment: current.baseEnvironment, onlyForSideEffects: edge.types.has('side-effect-on-call') }
      if (!visited.has(fingerprint(envEdge))) {
        slicerLogger.trace(`adding id: ${target} to visit queue`)
        visitQueue.push(envEdge)
      }
    }
  }

  slicerLogger.trace(`static slicing produced: ${JSON.stringify([...visited])}`)

  return new Set(visited.values())
}


function linkOnFunctionCall(current: NodeToSlice, callerInfo: DataflowGraphNodeInfo, dataflowGraph: DataflowGraph, visited: Map<Fingerprint, NodeId>, visitQueue: NodeToSlice[]) {
  // bind with call-local environments during slicing
  const outgoingEdges = dataflowGraph.get(callerInfo.id, true)
  guard(outgoingEdges !== undefined, () => `outgoing edges of id: ${callerInfo.id} must be in graph but can not be found, keep in slice to be sure`)

  // lift baseEnv on the same level
  let baseEnvironment = current.baseEnvironment
  while(baseEnvironment.level < callerInfo.environment.level) {
    baseEnvironment = pushLocalEnvironment(baseEnvironment)
  }
  const activeEnvironment = overwriteEnvironments(baseEnvironment, callerInfo.environment)

  const functionCallDefs = resolveByName(callerInfo.name, LocalScope, activeEnvironment)?.map(d => d.nodeId) ?? []

  functionCallDefs.push(...[...outgoingEdges[1]].filter(([_, e]) => e.types.has('calls')).map(([target]) => target))

  const functionCallTargets = getAllLinkedFunctionDefinitions(new Set(functionCallDefs), dataflowGraph)

  for (const [_, functionCallTarget] of functionCallTargets) {
    guard(functionCallTarget.tag === 'function-definition', () => `expected function definition, but got ${functionCallTarget.tag}`)
    // all those linked within the scopes of other functions are already linked when exiting a function definition
    for (const openIn of functionCallTarget.subflow.in) {
      const defs = resolveByName(openIn.name, LocalScope, activeEnvironment)
      if (defs === undefined) {
        continue
      }
      for (const def of defs) {
        const nodeToSlice = { id: def.nodeId, baseEnvironment: activeEnvironment, onlyForSideEffects: current.onlyForSideEffects }
        if (!visited.has(fingerprint(nodeToSlice))) {
          visitQueue.push(nodeToSlice)
        }
      }
    }

    if(!current.onlyForSideEffects) {
      for (const exitPoint of functionCallTarget.exitPoints) {
        const nodeToSlice = {
          id:                 exitPoint,
          baseEnvironment:    activeEnvironment,
          onlyForSideEffects: current.onlyForSideEffects
        }
        if (!visited.has(fingerprint(nodeToSlice))) {
          visitQueue.push(nodeToSlice)
        }
      }
    }
  }
}

