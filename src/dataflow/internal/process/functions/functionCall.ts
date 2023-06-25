import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { overwriteEnvironments, resolveByName } from '../../../environments'
import { NodeId, ParentInformation, RFunctionCall } from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import {
  DataflowGraph,
  dataflowLogger,
  FunctionArgument
} from '../../../index'
// TODO: support partial matches: https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching

export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const functionName = processDataflowFor(functionCall.functionName, data)
  const args = functionCall.arguments.map(arg => processDataflowFor(arg, data))
  const finalGraph = new DataflowGraph()

  // we update all the usage nodes within the dataflow graph of the function name to
  // mark them as function calls, and append their argument linkages
  let functionNameId: NodeId | undefined
  for(const [nodeId, _] of functionName.graph.nodes()) {
    functionNameId = nodeId
  }

  guard(functionNameId !== undefined, 'Function call name id not found')

  const functionRootId = functionCall.info.id
  const functionCallName = functionCall.functionName.content
  dataflowLogger.debug(`Using ${functionRootId} (name: ${functionCallName}) as root for the function call`)

  let finalEnv = functionName.environments

  const callArgs: FunctionArgument[] = []
  finalGraph.addNode({
    tag:         'function-call',
    id:          functionRootId,
    name:        functionCallName,
    environment: data.environments,
    when:        'always',
    scope:       data.activeScope,
    args:        callArgs // same reference
  })
  // finalGraph.addEdge(functionRootId, functionNameId, 'read', 'always')

  const resolved = resolveByName(functionCallName, data.activeScope, data.environments)
  if(resolved !== undefined) {
    for(const fn of resolved) {
      dataflowLogger.trace(`recording call from ${functionCallName} (${functionRootId}) to ${JSON.stringify(fn)}`)
      finalGraph.addEdge(functionRootId, fn.nodeId, 'calls', 'always')
    }
  }


  for(const arg of args) {
    finalEnv = overwriteEnvironments(finalEnv, arg.environments)
    finalGraph.mergeWith(arg.graph)
    const argumentOutRefs = arg.out

    // if there are multiple, we still use the first one as it is the highest-one and therefore the most top-level arg reference
    // multiple out references can occur if the argument itself is a function call
    callArgs.push(argumentOutRefs[0])

    // add an argument edge to the final graph
    for(const outgoing of argumentOutRefs) {
      finalGraph.addEdge(functionRootId, outgoing, 'argument', 'always')
    }
    // TODO: bind the argument id to the corresponding argument within the function
  }

  // TODO:
  // finalGraph.addNode(functionCall.info.id, functionCall.functionName.content, finalEnv, down.activeScope, 'always')

  const inIds = [...args.flatMap(a => [...a.in, a.activeNodes])].flat()
  inIds.push({ nodeId: functionRootId, name: functionCallName, scope: data.activeScope, used: 'always' })

  return {
    activeNodes:  [],
    in:           inIds,
    out:          [ ...functionName.out, ...args.flatMap(a => a.out)],
    graph:        finalGraph,
    environments: finalEnv,
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}

