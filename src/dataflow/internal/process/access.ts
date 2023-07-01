import { ParentInformation, RAccess } from '../../../r-bridge'
import { DataflowInformation } from '../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../processor'
import { overwriteEnvironments } from '../../environments'

export function processAccess<OtherInfo>(node: RAccess<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const processedAccessed = processDataflowFor(node.accessed, data)
  const nextGraph = processedAccessed.graph
  const outgoing = processedAccessed.out
  const ingoing = processedAccessed.in
  const environments = processedAccessed.environments

  const accessedNodes = [...processedAccessed.activeNodes, ...processedAccessed.in, ...processedAccessed.out]

  if(node.operator === '[' || node.operator === '[[') {
    for(const access of node.access) {
      if(access === null) {
        continue
      }
      const processedAccess = processDataflowFor(access, data)
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
    ast:          data.completeAst,
    activeNodes:  processedAccessed.activeNodes /* keep active nodes in case of assignments etc */,
    in:           ingoing,
    out:          outgoing,
    environments: environments,
    scope:        data.activeScope,
    graph:        nextGraph
  }
}
