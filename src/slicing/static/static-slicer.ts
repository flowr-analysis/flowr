import {
  BuiltIn,
  DataflowGraph,
  DataflowGraphNodeInfo,
  DataflowMap,
  FunctionArgument,
  graphToMermaidUrl,
  LocalScope
} from '../../dataflow'
import { guard } from '../../util/assert'
import { DecoratedAstMap, NodeId, NoInfo } from '../../r-bridge'
import { log } from '../../util/log'
import { resolveByName } from '../../dataflow/environments'

export const slicerLogger = log.getSubLogger({ name: "slicer" })


// TODO: include library loads

/**
 * This returns the ids to include in the slice, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode | reconstruct the slice to R code}.
 */
export function naiveStaticSlicing<OtherInfo>(dataflowGraph: DataflowGraph, dataflowIdMap: DecoratedAstMap<OtherInfo>, id: NodeId[], visited: Set<NodeId> = new Set<NodeId>()): Set<NodeId> {
  guard(id.length > 0, `must have at least one seed id to calculate slice`)
  slicerLogger.trace(`calculating slice for ${id.length} seed ids: ${JSON.stringify(id)}`)
  const visitQueue = id

  while (visitQueue.length > 0) {
    const current = visitQueue.pop()

    if (current === undefined) {
      continue
    }
    visited.add(current)

    const currentInfo = dataflowGraph.get(current)
    if(currentInfo === undefined) {
      slicerLogger.warn(`id: ${current} must be in graph but can not be found, this may be the case for exit points of function definitions, keep in slice to be sure`)
      continue
    }

    if(currentInfo.functionCall !== false) {
      slicerLogger.trace(`tracing function call for ${current} (${currentInfo.name})`)
      const args = currentInfo.functionCall
      sliceFunctionCall(current, currentInfo, dataflowGraph, dataflowIdMap, args, visited, visitQueue)
    }

    const currentNode = dataflowIdMap.get(current)
    guard(currentNode !== undefined, () => `id: ${current} must be in dataflowIdMap is not in ${graphToMermaidUrl(dataflowGraph, dataflowIdMap)}`)

    for (const edge of currentInfo.edges.filter(e => e.type === 'read' || e.type === 'defined-by' || e.type === 'argument')) {
      if (!visited.has(edge.target)) {
        visitQueue.push(edge.target)
      }
    }
  }

  slicerLogger.trace(`static slicing produced: ${JSON.stringify([...visited])}`)

  return visited
}

function getTargetEnsured(dataflowGraph: DataflowGraph, currentId: NodeId, idMap: DataflowMap<NoInfo>) {
  const currentInfo = dataflowGraph.get(currentId)
  guard(currentInfo !== undefined, () => `id: ${currentId} must be in graph but to calculate slice, but is not in ${graphToMermaidUrl(dataflowGraph, idMap)}`)
  return currentInfo
}

// TODO: abstract away into a 'getAllDefinitionsOf' function
function getAllLinkedFunctionDefinitions(functionDefinitionReadIds: NodeId[], dataflowGraph: DataflowGraph, idMap: DataflowMap<NoInfo>): [NodeId, DataflowGraphNodeInfo][] {
  const potential: NodeId[] = functionDefinitionReadIds
  const result: [NodeId, DataflowGraphNodeInfo][] = []
  while(potential.length > 0) {
    const currentId = potential.pop() as NodeId
    if(currentId === BuiltIn) {
      // do not traverse builtins
      slicerLogger.trace('skipping builtin function definition during collection')
      continue
    }
    const currentInfo = getTargetEnsured(dataflowGraph, currentId, idMap)

    if(currentInfo.subflow !== undefined) {
      result.push([currentId, currentInfo])
    }
    // trace all joined reads
    // TODO: deal with redefinitions?
    potential.push(...currentInfo.edges.filter(e => e.type === 'read' || e.type === 'defined-by' || e.type === 'calls').map(e => e.target))
  }
  return result
}

function sliceFunctionCall(id: NodeId, callerInfo: DataflowGraphNodeInfo, dataflowGraph: DataflowGraph, idMap: DataflowMap<NoInfo>, args: FunctionArgument[], visited: Set<NodeId>, visitQueue: NodeId[]) {
  slicerLogger.trace(`slicing function call with args: ${JSON.stringify(args)}`)
  // each read - maybe or not - is a linked function definition
  const functionDefinitionReadIds = callerInfo.edges.filter(e => e.type === 'read').map(e => e.target)
  const allFunctionDefinitions = getAllLinkedFunctionDefinitions(functionDefinitionReadIds, dataflowGraph, idMap)
  if(allFunctionDefinitions.length === 0) {
    slicerLogger.warn(`function call to ${callerInfo.name} with Id ${id} does not have any linked function definitions, does not have to be included in slice`)
    return
  } else {
    const allFunctionDefinitionIds = allFunctionDefinitions.map(([id, info]) => `${id}[${info.name}]`)
    slicerLogger.trace(`all linked function definitions: ${allFunctionDefinitionIds.join(', ')}`)
  }
  for(const [functionDefinitionId, functionDefinitionInfo] of allFunctionDefinitions) {
    sliceFunctionDefinition(callerInfo, functionDefinitionId, functionDefinitionInfo, dataflowGraph, idMap, args, visited, visitQueue)
  }
}

function sliceFunctionDefinition(callerInfo: DataflowGraphNodeInfo, functionDefinitionId: NodeId, info: DataflowGraphNodeInfo, dataflowGraph: DataflowGraph, idMap: DataflowMap<NoInfo>, _args: FunctionArgument[], visited: Set<NodeId>, visitQueue: NodeId[]) {
  // just slice with all exist points
  guard(info.subflow !== undefined, () => `function definition id: ${functionDefinitionId} does not have a subflow! Why does this happen here, this should be catched wayyy earlier/prevented by construction.`)
  guard(info.exitPoints !== undefined, () => `function definition id: ${functionDefinitionId} does have *undefined* linked exit points`)
  if(info.exitPoints.length === 0) {
    slicerLogger.warn(`function definition id: ${functionDefinitionId} does not have linked exit points, does not have to be included in slice`)
    return
  }

  naiveStaticSlicing(info.subflow.graph, idMap, info.exitPoints, visited)
  // TODO: trace all open reads!
  for(const openIn of info.subflow.in) {
    const defs = resolveByName(openIn.name, LocalScope, callerInfo.environment)
    if(defs === undefined) {
      continue
    }
    for(const def of defs) {
      if (!visited.has(def.nodeId)) {
        visitQueue.push(def.nodeId)
      }
    }
  }
}
