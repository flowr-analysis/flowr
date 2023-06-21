import { DataflowGraph, graphToMermaidUrl } from '../../dataflow'
import { guard } from '../../util/assert'
import { DecoratedAstMap, NodeId } from '../../r-bridge'
import { SourcePosition } from '../../util/range'
import { log } from '../../util/log'

export const slicerLogger = log.getSubLogger({ name: "slicer" })


export function locationToId<OtherInfo>(location: SourcePosition, dataflowIdMap: DecoratedAstMap<OtherInfo>): NodeId | undefined {
  for(const [id, values] of dataflowIdMap.entries()) {
    if(values.location && values.location.start.line === location.line && values.location.start.column === location.column) {
      slicerLogger.trace(`resolving id ${id} for location ${JSON.stringify(location)}`)
      return id
    }
  }
  return undefined
}

export function conventionalCriteriaToId<OtherInfo>(line: number, name: string, dataflowIdMap: DecoratedAstMap<OtherInfo>): NodeId | undefined {
  for(const [id, values] of dataflowIdMap.entries()) {
    if(values.location && values.location.start.line === line && values.lexeme === name) {
      slicerLogger.trace(`resolving id ${id} for line ${line} and name ${name}`)
      return id
    }
  }
  return undefined
}


/**
 * This returns the ids to include in the slice, when slicing with the given seed id's (must be at least one).
 * <p>
 * The returned ids can be used to {@link reconstructToCode | reconstruct the slice to R code}.
 */
export function naiveStaticSlicing<OtherInfo>(dataflowGraph: DataflowGraph, dataflowIdMap: DecoratedAstMap<OtherInfo>, id: NodeId[]): Set<NodeId> {
  guard(id.length > 0, `must have at least one seed id to calculate slice`)
  const visitQueue = id
  const visited = new Set<NodeId>()

  while (visitQueue.length > 0) {
    const current = visitQueue.pop()

    if (current === undefined) {
      continue
    }
    visited.add(current)

    const currentInfo = dataflowGraph.get(current)
    guard(currentInfo !== undefined, () => `current id: ${current} to calculate slice must be in graph but is not in ${graphToMermaidUrl(dataflowGraph, dataflowIdMap)}`)
    const currentNode = dataflowIdMap.get(current)
    guard(currentNode !== undefined, () => `current id: ${current} to calculate slice must be in dataflowIdMap is not in ${graphToMermaidUrl(dataflowGraph, dataflowIdMap)}`)

    for (const edge of currentInfo.edges.filter(e => e.type === 'read' || e.type === 'defined-by' || e.type === 'parameter')) {
      if (!visited.has(edge.target)) {
        visitQueue.push(edge.target)
      }
    }
  }

  slicerLogger.trace(`static slicing produced: ${JSON.stringify([...visited])}`)

  return visited
}
