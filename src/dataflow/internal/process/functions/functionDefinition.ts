import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { popLocalEnvironment } from '../../../environments'

export function processFunctionDefinition<OtherInfo>(functionCall: unknown, args: DataflowInformation<OtherInfo>[], body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  const bodyEnvironemnt = body.environments


  // TODO: deal with function info
  // TODO rest
  return {
    activeNodes:  [],
    in:           [], // [...args.in, ...functionName.in, ...args.activeNodes, ...functionName.activeNodes],
    out:          [], // args.out,
    graph:        body.graph, /* args.length === 0 ? new DataflowGraph() : args[0].currentGraph.mergeWith(...args.slice(1).map(p => p.currentGraph)) */
    environments: popLocalEnvironment(body.environments), // TODO: merge with args
    ast:          down.ast,
    scope:        down.activeScope
  }
}
