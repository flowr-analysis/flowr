import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'

export function processFunctionCall<OtherInfo>(functionCall: unknown, functionName: DataflowInformation<OtherInfo>,  parameters: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: deal with function info
  // TODO rest
  return {
    activeNodes:  [],
    in:           [], // [...parameters.in, ...functionName.in, ...parameters.activeNodes, ...functionName.activeNodes],
    out:          [], // parameters.out,
    graph:        functionName.graph, /* parameters.length === 0 ? new DataflowGraph() : parameters[0].currentGraph.mergeWith(...parameters.slice(1).map(p => p.currentGraph)) */
    environments: functionName.environments, // TODO: merge with parameters
    ast:          down.ast,
    scope:        down.scope
  }
}
