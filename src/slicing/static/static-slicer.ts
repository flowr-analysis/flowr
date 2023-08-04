import {
  DataflowGraph, DataflowGraphNodeFunctionDefinition,
  DataflowGraphNodeInfo, dataflowLogger,
  graphToMermaidUrl,
  initializeCleanEnvironments,
  LocalScope, REnvironmentInformation
} from '../../dataflow'
import { guard } from '../../util/assert'
import { collectAllIds, DecoratedAstMap, NodeId, RNodeWithParent, Type } from '../../r-bridge'
import { log } from '../../util/log'
import { getAllLinkedFunctionDefinitions } from '../../dataflow/internal/linker'
import {
  overwriteEnvironments,
  pushLocalEnvironment,
  resolveByName
} from '../../dataflow/environments'
import objectHash from 'object-hash'
import { DefaultMap } from '../../util/defaultmap'

export const slicerLogger = log.getSubLogger({ name: "slicer" })


interface NodeToSlice {
  id:                 NodeId
  /** used for calling context etc. */
  baseEnvironment:    REnvironmentInformation
  /** if we add a function call we may need it only for its side effects (e.g., a redefinition of a global variable), if so, 'returns' links will not be traced */
  onlyForSideEffects: boolean
}



type Fingerprint = string

function envFingerprint(env: REnvironmentInformation): string {
  return objectHash(env, { excludeKeys: key => key === 'id' })
}

function fingerprint(id: NodeId, envFingerprint: string, onlyForSideEffects: boolean): Fingerprint {
  return `${id}-${envFingerprint}-${onlyForSideEffects ? '0' : '1'}`
}

/**
 * This returns the ids to include in the slice, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode | reconstruct the slice to R code}.
 */
export function staticSlicing<OtherInfo>(dataflowGraph: DataflowGraph, dataflowIdMap: DecoratedAstMap<OtherInfo>, id: NodeId[], threshold = 100): { timesHitThreshold: number, result: Set<NodeId> } {
  guard(id.length > 0, `must have at least one seed id to calculate slice`)
  slicerLogger.trace(`calculating slice for ${id.length} seed ids: ${id.join(', ')}`)

  const seen = new Map<Fingerprint, NodeId>()
  const idThreshold = new DefaultMap<NodeId, number>(() => 0)

  let timesHitThreshold = 0

  // every node ships the call environment which registers the calling environment
  const visitQueue: NodeToSlice[] = id.map(i => ({ id: i, baseEnvironment: initializeCleanEnvironments(), onlyForSideEffects: false, indirection: 0 }))
  const basePrint = envFingerprint(initializeCleanEnvironments())
  for(const id of visitQueue) {
    seen.set(fingerprint(id.id, basePrint, id.onlyForSideEffects), id.id)
  }

  while (visitQueue.length > 0) {
    const current = visitQueue.pop()

    if (current === undefined) {
      continue
    }

    const idCounter = idThreshold.get(current.id)
    if(idCounter > threshold) {
      dataflowLogger.warn(`id: ${current.id} has been visited ${idCounter} times, skipping`)
      timesHitThreshold++
      continue
    } else {
      idThreshold.set(current.id, idCounter + 1)
    }

    const baseEnvFingerprint = envFingerprint(current.baseEnvironment)

    const currentInfo = dataflowGraph.get(current.id, true)
    // slicerLogger.trace(`visiting id: ${current.id} with name: ${currentInfo?.[0].name ?? '<unknown>'}`)

    if(currentInfo === undefined) {
      slicerLogger.warn(`id: ${current.id} must be in graph but can not be found, keep in slice to be sure`)
      continue
    }

    if(currentInfo[0].tag === 'function-call' && !current.onlyForSideEffects) {
      slicerLogger.trace(`${current.id} is a function call`)
      linkOnFunctionCall(current, currentInfo[0], dataflowGraph, seen, visitQueue)
    }

    const currentNode = dataflowIdMap.get(current.id)
    guard(currentNode !== undefined, () => `id: ${current.id} must be in dataflowIdMap is not in ${graphToMermaidUrl(dataflowGraph, dataflowIdMap)}`)

    for (const [target, edge] of currentInfo[1]) {
      if (edge.types.has('side-effect-on-call')) {
        const sideEffectPrint = fingerprint(target, baseEnvFingerprint, true)
        if (!seen.has(sideEffectPrint)) {
          seen.set(sideEffectPrint, target)
          visitQueue.push({ id: target, baseEnvironment: current.baseEnvironment, onlyForSideEffects: true })
        }
      } else if (edge.types.has('reads') || edge.types.has('defined-by') || edge.types.has('argument') || edge.types.has('calls') || edge.types.has('relates') || edge.types.has('defines-on-call')) {
        const print = fingerprint(target, baseEnvFingerprint, false)
        if (!seen.has(print)) {
          seen.set(print, target)
          visitQueue.push({ id: target, baseEnvironment: current.baseEnvironment, onlyForSideEffects: false })
        }
      }
    }
    for(const controlFlowDependency of addControlDependencies(currentInfo[0].id, dataflowIdMap)) {
      const print = fingerprint(controlFlowDependency, baseEnvFingerprint, false)
      if (!seen.has(print)) {
        seen.set(print, controlFlowDependency)
        visitQueue.push({ id: controlFlowDependency, baseEnvironment: current.baseEnvironment, onlyForSideEffects: false })
      }
    }
  }

  // slicerLogger.trace(`static slicing produced: ${JSON.stringify([...seen])}`)
  return { result: new Set(seen.values()), timesHitThreshold }
}


function addAllFrom(current: RNodeWithParent, collected: Set<NodeId>) {
  for (const id of collectAllIds(current)) {
    collected.add(id)
  }
}

// TODO: just add edge control flow edges to the dataflow graph c: this is horrible!
function addControlDependencies(source: NodeId, ast: DecoratedAstMap): Set<NodeId> {
  const start = ast.get(source)

  const collected = new Set<NodeId>()

  let current = start
  while(current !== undefined) {
    if(current.type === Type.If) {
      addAllFrom(current.condition, collected)
    } else if(current.type === Type.While) {
      addAllFrom(current.condition, collected)
    } else if(current.type === Type.For) {
      addAllFrom(current.variable, collected)
      // vector not needed, if required, it is  linked by defined-by
    }
    // nothing to do for repeat and rest!
    current = current.info.parent ? ast.get(current.info.parent) : undefined
  }
  return collected
}

function linkOnFunctionCall(current: NodeToSlice, callerInfo: DataflowGraphNodeInfo, dataflowGraph: DataflowGraph, seen: Map<Fingerprint, NodeId>, visitQueue: NodeToSlice[]) {
  // bind with call-local environments during slicing
  const outgoingEdges = dataflowGraph.get(callerInfo.id, true)
  guard(outgoingEdges !== undefined, () => `outgoing edges of id: ${callerInfo.id} must be in graph but can not be found, keep in slice to be sure`)

  // lift baseEnv on the same level
  let baseEnvironment = current.baseEnvironment
  let callerEnvironment = callerInfo.environment

  if(baseEnvironment.level !== callerEnvironment.level) {
    while (baseEnvironment.level < callerEnvironment.level) {
      baseEnvironment = pushLocalEnvironment(baseEnvironment)
    }
    while (baseEnvironment.level > callerEnvironment.level) {
      callerEnvironment = pushLocalEnvironment(callerEnvironment)
    }
  }

  const activeEnvironment = overwriteEnvironments(baseEnvironment, callerEnvironment)
  const baseEnvPrint = envFingerprint(baseEnvironment)

  const functionCallDefs = resolveByName(callerInfo.name, LocalScope, activeEnvironment)?.map(d => d.nodeId) ?? []

  functionCallDefs.push(...outgoingEdges[1].filter(([_, e]) => e.types.has('calls')).map(([target]) => target))

  const functionCallTargets = getAllLinkedFunctionDefinitions(new Set(functionCallDefs), dataflowGraph)

  for (const [_, functionCallTarget] of functionCallTargets) {
    // all those linked within the scopes of other functions are already linked when exiting a function definition
    for (const openIn of (functionCallTarget as DataflowGraphNodeFunctionDefinition).subflow.in) {
      const defs = resolveByName(openIn.name, LocalScope, activeEnvironment)
      if (defs === undefined) {
        continue
      }
      for (const def of defs) {
        const print = fingerprint(def.nodeId, baseEnvPrint, current.onlyForSideEffects)
        if (!seen.has(print)) {
          seen.set(print, def.nodeId)
          visitQueue.push({ id: def.nodeId, baseEnvironment, onlyForSideEffects: current.onlyForSideEffects })
        }
      }
    }

    console.log('visiting exit points of', callerInfo.name, (functionCallTarget as DataflowGraphNodeFunctionDefinition).exitPoints)
    for (const exitPoint of (functionCallTarget as DataflowGraphNodeFunctionDefinition).exitPoints) {
      const print = fingerprint(exitPoint, baseEnvPrint, current.onlyForSideEffects)
      if (!seen.has(print)) {
        seen.set(print, exitPoint)
        visitQueue.push({
          id:                 exitPoint,
          baseEnvironment:    baseEnvironment,
          onlyForSideEffects: current.onlyForSideEffects
        })
      }
    }
  }
}

