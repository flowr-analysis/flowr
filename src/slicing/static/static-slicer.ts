import { DataflowGraph } from "../../dataflow/graph"
import { IdType } from "../../dataflow/id"
import { guard } from "../../util/assert"
import { DataflowMap } from "../../dataflow/extractor"
import { log } from "../../util/log"

/** returns the line numbers to include, TODO: add ast etc., TODO: include braces and paranethesis as additional ast information so we can add the closing/opening brace into the slice!  */
export function naiveLineBasedSlicing<OtherInfo>(dataflowGraph: DataflowGraph, dataflowIdMap: DataflowMap<OtherInfo>, id: IdType): Set<number> {
  const lines = new Set<number>()
  const visitQueue = [id]
  const visited = []

  while (visitQueue.length > 0) {
    const current = visitQueue.pop()

    if (current === undefined) {
      continue
    }
    visited.push(current)

    const currentInfo = dataflowGraph.get(current)
    guard(currentInfo !== undefined, `current id:${id} to calculate slice must be in graph`)
    const currentNode = dataflowIdMap.get(current)
    guard(currentNode !== undefined, `current id:${id} to calculate slice must be in dataflowIdMap`)
    if(currentNode.location === undefined) {
      log.warn(`current id:${id} to calculate slice has no location (${JSON.stringify(currentNode)})`)
    } else {
      for(let lineNumber = currentNode.location.start.line; lineNumber <= currentNode.location.end.line; lineNumber++) {
        lines.add(lineNumber)
      }
    }

    for (const edge of currentInfo.edges.filter(e => e.type === 'read' || e.type === 'defined-by')) {
      if (!visited.includes(edge.target)) {
        visitQueue.push(edge.target)
      }
    }
  }

  return lines
}
