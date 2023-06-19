import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { overwriteEnvironments } from '../../../environments'
import { ParentInformation, RFunctionCall } from '../../../../r-bridge'

export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, functionName: DataflowInformation<OtherInfo>, args: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: deal with function info
  // TODO rest

  let finalEnv = functionName.environments
  let finalGraph = functionName.graph
  for(const arg of args) {
    finalEnv = overwriteEnvironments(finalEnv, arg.environments)
    finalGraph = finalGraph.mergeWith(arg.graph)
  }

  // TODO: 
  // finalGraph.addNode(functionCall.info.id, functionCall.functionName.content, finalEnv, down.activeScope, 'always')

  return {
    activeNodes:  [],
    in:           [...args.flatMap(a => [...a.in, a.activeNodes]), ...functionName.in, ...functionName.activeNodes].flat(),
    out:          [...functionName.out, ...args.flatMap(a => a.out)],
    graph:        finalGraph,
    environments: finalEnv,
    ast:          down.ast,
    scope:        down.activeScope
  }
}
