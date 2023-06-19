import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { overwriteEnvironments } from '../../../environments'
import { NodeId, ParentInformation, RFunctionCall } from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import { DataflowGraphNodeInfo, dataflowLogger, FunctionArgument } from '../../../index'
// TODO: support partial matches: https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching

export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, functionName: DataflowInformation<OtherInfo>, args: DataflowInformation<OtherInfo>[], down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  let finalGraph = functionName.graph

  // we update all the usage nodes within the dataflow graph of the function name to
  // mark them as function calls, and append their argument linkages
  let functionRootId: NodeId | undefined
  let functionRootInfo: DataflowGraphNodeInfo | undefined
  for(const [nodeId, nodeInfo] of finalGraph.nodes()) {
    if(nodeInfo.definedAtPosition !== false) {
      continue
    }
    functionRootId = nodeId
    functionRootInfo = nodeInfo
  }

  guard(functionRootId !== undefined && functionRootInfo !== undefined, 'Function call root id | root info not found')

  dataflowLogger.debug(`Using ${functionRootId} (name: ${functionRootInfo.name}) as root for the function call`)

  let finalEnv = functionName.environments

  const callArgs: FunctionArgument[] = []
  functionRootInfo.functionCall = callArgs

  for(const arg of args) {
    finalEnv = overwriteEnvironments(finalEnv, arg.environments)
    finalGraph = finalGraph.mergeWith(arg.graph)
    const ingoingRefs = [...arg.in, ...arg.activeNodes]
    guard(ingoingRefs.length <= 1, `TODO: deal with multiple ingoing nodes in case of function calls etc for ${JSON.stringify(ingoingRefs)}`)

    callArgs.push(ingoingRefs[0])

    // add an argument edge to the final graph
    // TODO: deal with redefinitions within arguments
    for(const ingoing of ingoingRefs) {
      finalGraph.addEdge(functionRootId, ingoing, 'argument', 'always')
    }
    // TODO: bind the argument id to the corresponding argument within the function
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
