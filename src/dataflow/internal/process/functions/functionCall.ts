import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import {
  define,
  overwriteEnvironments,
  resolveByName
} from '../../../environments'
import { NodeId, ParentInformation, RFunctionCall, Type } from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import {
  DataflowGraph,
  dataflowLogger,
  FunctionArgument,
  LocalScope
} from '../../../index'
import { linkArgumentsOnCall } from '../../linker'
// TODO: support partial matches: https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching

export const UnnamedFunctionCallPrefix = 'unnamed-function-call-'


function getLastNodeInGraph<OtherInfo>(functionName: DataflowInformation<OtherInfo & ParentInformation>) {
  let functionNameId: NodeId | undefined
  for (const [nodeId] of functionName.graph.nodes()) {
    functionNameId = nodeId
  }
  return functionNameId
}


export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const named = functionCall.flavor === 'named'
  const functionName = processDataflowFor(named ? functionCall.functionName : functionCall.calledFunction, data)

  let finalEnv = functionName.environments
  // arg env contains the environments with other args defined
  let argEnv = functionName.environments
  const finalGraph = new DataflowGraph()
  const callArgs: FunctionArgument[] = []
  const args = []
  const remainingReadInArgs = []

  const functionRootId = functionCall.info.id
  // TODO: split that up so that unnamed function calls will not be resolved!

  let functionCallName: string

  if(named) {
    functionCallName = functionCall.functionName.content
    dataflowLogger.debug(`Using ${functionRootId} (name: ${functionCallName}) as root for the function call`)
  } else {
    functionCallName = `${UnnamedFunctionCallPrefix}${functionRootId}`
    dataflowLogger.debug(`Using ${functionRootId} as root for the unnamed function call`)
    // we know, that it calls the toplevel:
    finalGraph.addEdge(functionRootId, functionCall.calledFunction.info.id, 'calls', 'always')
    // keep the defined function
    finalGraph.mergeWith(functionName.graph)
  }


  for(const arg of functionCall.arguments) {
    if(arg === undefined) {
      callArgs.push('empty')
      args.push(undefined)
      continue
    }

    const processed = processDataflowFor(arg, { ...data, environments: argEnv })
    args.push(processed)

    finalEnv = overwriteEnvironments(finalEnv, processed.environments)
    argEnv = overwriteEnvironments(argEnv, processed.environments)

    finalGraph.mergeWith(processed.graph)

    guard(processed.out.length > 0, () => `Argument ${JSON.stringify(arg)} has no out references, but needs one for the unnamed arg`)
    callArgs.push(processed.out[0])

    // add an argument edge to the final graph
    finalGraph.addEdge(functionRootId, processed.out[0], 'argument', 'always')
    // resolve reads within argument
    for(const ingoing of [...processed.in, ...processed.activeNodes]) {
      const tryToResolve = resolveByName(ingoing.name, LocalScope, argEnv)

      if(tryToResolve === undefined) {
        remainingReadInArgs.push(ingoing)
      } else {
        for(const resolved of tryToResolve) {
          finalGraph.addEdge(ingoing.nodeId, resolved.nodeId,'reads', 'always')
        }
      }
    }
    if(arg.type === Type.Argument && arg.name !== undefined) {
      argEnv = define(
        { ...processed.out[0], definedAt: arg.info.id, kind: 'argument' },
        LocalScope,
        argEnv
      )
    }
  }

  // we update all the usage nodes within the dataflow graph of the function name to
  // mark them as function calls, and append their argument linkages
  const functionNameId = getLastNodeInGraph(functionName)

  guard(functionNameId !== undefined, () => `Function call name id not found for ${JSON.stringify(functionCall)}`)

  finalGraph.addNode({
    tag:         'function-call',
    id:          functionRootId,
    name:        functionCallName,
    environment: data.environments,
    when:        'always',
    scope:       data.activeScope,
    args:        callArgs // same reference
  })

  const inIds = remainingReadInArgs
  inIds.push({ nodeId: functionRootId, name: functionCallName, scope: data.activeScope, used: 'always' })

  if(!named) {
    // TODO: indirect parameter tracking!
    if(functionCall.calledFunction.type === Type.FunctionDefinition) {
      linkArgumentsOnCall(callArgs, functionCall.calledFunction.parameters, finalGraph)
    }
    // push the called function to the ids:
    inIds.push(...functionName.in, ...functionName.activeNodes)
  }

  return {
    activeNodes:  [],
    in:           inIds,
    out:          functionName.out, // we do not keep argument out as it has been linked by the function TODO: deal with foo(a <- 3)
    graph:        finalGraph,
    environments: finalEnv,
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}

