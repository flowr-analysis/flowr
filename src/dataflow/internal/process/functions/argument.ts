import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'

export function processFunctionArgument<OtherInfo>(functionCall: unknown, name: DataflowInformation<OtherInfo>,  defaultValue: DataflowInformation<OtherInfo> | undefined, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: deal with function info
  // TODO rest
  return {
    activeNodes:  [],
    in:           [], // [...arguments.in, ...functionName.in, ...arguments.activeNodes, ...functionName.activeNodes],
    out:          [], // arguments.out,
    graph:        name.graph, /* arguments.length === 0 ? new DataflowGraph() : arguments[0].currentGraph.mergeWith(...arguments.slice(1).map(p => p.currentGraph)) */
    environments: name.environments, // TODO: merge with arguments
    ast:          down.ast,
    scope:        down.activeScope
  }
}
