import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import {
  BuiltIn, define, IdentifierDefinition,
  IdentifierReference,
  overwriteEnvironments,
  resolveByName
} from '../../../environments'
import { NodeId, ParentInformation, RFunctionCall, RNodeWithParent, RParameter, Type } from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import {
  DataflowGraph,
  dataflowLogger,
  FunctionArgument, LocalScope, NamedFunctionArgument, PositionalFunctionArgument
} from '../../../index'
// TODO: support partial matches: https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching

export const UnnamedFunctionCallPrefix = 'unnamed-function-call-'


function getLastNodeInGraph<OtherInfo>(functionName: DataflowInformation<OtherInfo & ParentInformation>) {
  let functionNameId: NodeId | undefined
  for (const [nodeId] of functionName.graph.nodes()) {
    functionNameId = nodeId
  }
  return functionNameId
}


function linkArgumentsForAllNamedArguments<OtherInfo>(resolvedDefinitions: IdentifierDefinition[], data: DataflowProcessorInformation<OtherInfo & ParentInformation>, functionCallName: string, functionRootId: NodeId, callArgs: FunctionArgument[], finalGraph: DataflowGraph) {
  const trackCallIds = resolvedDefinitions.map(r => r.definedAt)

  // we get them by just choosing the rhs of the definition - TODO: this should be improved - maybe by a second call track
  const allLinkedFunctions: (RNodeWithParent | undefined)[] = trackCallIds.filter(i => i !== BuiltIn).map(id => data.completeAst.idMap.get(id))

  for (const linkedFunctionBase of allLinkedFunctions) {
    guard(linkedFunctionBase !== undefined, `A function definition in ${JSON.stringify(trackCallIds)} not found in ast`)
    if (linkedFunctionBase.type !== Type.BinaryOp) {
      dataflowLogger.trace(`function call definition base ${functionCallName} does not lead to an assignment (${functionRootId}) but got ${linkedFunctionBase.type}`)
      continue
    }
    const linkedFunction = linkedFunctionBase.rhs

    if (linkedFunction.type !== Type.FunctionDefinition) {
      dataflowLogger.trace(`function call definition base ${functionCallName} does not lead to a function definition (${functionRootId}) but got ${linkedFunction.type}`)
      continue
    }
    dataflowLogger.trace(`linking arguments for ${functionCallName} (${functionRootId}) to ${JSON.stringify(linkedFunction.location)}`)
    linkArgumentsOnCall(callArgs, linkedFunction.parameters, finalGraph)
  }
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
          finalGraph.addEdge(ingoing.nodeId, resolved.nodeId,'read', 'always')
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

  if(named) {
    const resolvedDefinitions = resolveByName(functionCallName, data.activeScope, data.environments)
    if (resolvedDefinitions !== undefined) {
      linkArgumentsForAllNamedArguments(resolvedDefinitions, data, functionCallName, functionRootId, callArgs, finalGraph)
    } else {
      dataflowLogger.debug(`Could not resolve function call ${functionCallName} (${functionRootId})`)
    }
  } else {
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


// TODO: in some way we need to remove the links for the default argument if it is given by the user on call - this could be done with 'when' but for now we do not do it as we expect such situations to be rare
function linkArgumentsOnCall(args: FunctionArgument[], params: RParameter<ParentInformation>[], graph: DataflowGraph): void {
  const nameArgMap = new Map<string, IdentifierReference | '<value>'>(args.filter(Array.isArray) as NamedFunctionArgument[])
  const nameParamMap = new Map<string, RParameter<ParentInformation>>(params.map(p => [p.name.content, p]))

  const specialDotParameter = params.find(p => p.special)

  // all parameters matched by name
  const matchedParameters = new Set<string>()


  // first map names
  for(const [name, arg] of nameArgMap) {
    if(arg === '<value>') {
      dataflowLogger.trace(`skipping value argument for ${name}`)
      continue
    }
    const param = nameParamMap.get(name)
    if(param !== undefined) {
      dataflowLogger.trace(`mapping named argument "${name}" to parameter "${param.name.content}"`)
      graph.addEdge(arg.nodeId, param.name.info.id, 'defines-on-call', 'always')
      matchedParameters.add(name)
    } else if(specialDotParameter !== undefined) {
      dataflowLogger.trace(`mapping named argument "${name}" to dot-dot-dot parameter`)
      graph.addEdge(arg.nodeId, specialDotParameter.name.info.id, 'defines-on-call', 'always')
    }
  }

  const remainingParameter = params.filter(p => !matchedParameters.has(p.name.content))
  const remainingArguments = args.filter(a => !Array.isArray(a)) as (PositionalFunctionArgument | 'empty')[]

  // TODO ...
  for(let i = 0; i < remainingArguments.length; i++) {
    const arg: PositionalFunctionArgument | 'empty' = remainingArguments[i]
    if(arg === '<value>' || arg === 'empty') {
      dataflowLogger.trace(`skipping value argument for ${i}`)
      continue
    }
    if(remainingParameter.length <= i) {
      if(specialDotParameter !== undefined) {
        dataflowLogger.trace(`mapping unnamed argument ${i} (id: ${arg.nodeId}) to dot-dot-dot parameter`)
        graph.addEdge(arg.nodeId, specialDotParameter.name.info.id, 'defines-on-call', 'always')
      } else {
        dataflowLogger.error(`skipping argument ${i} as there is no corresponding parameter - R should block that`)
      }
      continue
    }
    const param = remainingParameter[i]
    dataflowLogger.trace(`mapping unnamed argument ${i} (id: ${arg.nodeId}) to parameter "${param.name.content}"`)
    graph.addEdge(arg.nodeId, param.name.info.id, 'defines-on-call', 'always')
  }
}
