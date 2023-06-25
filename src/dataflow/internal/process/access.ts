import { ParentInformation, RAccess } from '../../../r-bridge'
import { DataflowInformation } from '../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import { overwriteEnvironments } from '../../environments'

export function processAccess<OtherInfo>(data: RAccess<OtherInfo & ParentInformation>, down: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const processedAccessed = processDataflowFor(data.accessed, down)
  const nextGraph = processedAccessed.graph
  const outgoing = processedAccessed.out
  const ingoing = [...processedAccessed.in, ...processedAccessed.activeNodes]
  const environments = processedAccessed.environments

  const accessedNodes = [...processedAccessed.activeNodes, ...processedAccessed.in, ...processedAccessed.out]

  if(data.operator === '[' || data.operator === '[[') {
    for(const access of data.access) {
      if(access === null) {
        continue
      }
      const processedAccess = processDataflowFor(access, down)
      nextGraph.mergeWith(processedAccess.graph)
      outgoing.push(...processedAccess.out)
      const newIngoing = [...processedAccess.in, ...processedAccess.activeNodes]
      for(const newIn of newIngoing) {
        // TODO: deal with complexity in the future by introduce a new specific node
        for(const accessedNode of accessedNodes) {
          nextGraph.addEdge(accessedNode, newIn, 'relates', 'always')
        }
      }
      ingoing.push(...newIngoing)
      overwriteEnvironments(environments, processedAccess.environments)
    }
  }

  return {
    ast:          down.completeAst,
    activeNodes:  [],
    in:           ingoing,
    out:          outgoing,
    environments: environments,
    scope:        down.activeScope,
    graph:        nextGraph
  }
}
