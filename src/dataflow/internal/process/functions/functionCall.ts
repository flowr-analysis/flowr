import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'

export function processFunctionCall<OtherInfo>(functionCall: unknown, functionName: DataflowInformation<OtherInfo>,  args: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: deal with function info
  // TODO rest
  return {
    activeNodes:  [],
    in:           [], // [...args.in, ...functionName.in, ...args.activeNodes, ...functionName.activeNodes],
    out:          [], // args.out,
    graph:        functionName.graph, /* args.length === 0 ? new DataflowGraph() : args[0].currentGraph.mergeWith(...args.slice(1).map(p => p.currentGraph)) */
    environments: functionName.environments, // TODO: merge with args
    ast:          down.ast,
    scope:        down.activeScope
  }
}
