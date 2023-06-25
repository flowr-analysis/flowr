import {
  DataflowGraph, graphToMermaidUrl
} from '../../dataflow'
import { guard } from '../../util/assert'
import { DecoratedAstMap, NodeId } from '../../r-bridge'
import { log } from '../../util/log'

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

    const currentNode = dataflowIdMap.get(current)
    guard(currentNode !== undefined, () => `id: ${current} must be in dataflowIdMap is not in ${graphToMermaidUrl(dataflowGraph, dataflowIdMap)}`)

    for (const edge of currentInfo.edges.filter(e => e.type === 'read' || e.type === 'defined-by' || e.type === 'argument'  || e.type === 'calls')) {
      if (!visited.has(edge.target)) {
        visitQueue.push(edge.target)
      }
    }
  }

  slicerLogger.trace(`static slicing produced: ${JSON.stringify([...visited])}`)

  return visited
}
