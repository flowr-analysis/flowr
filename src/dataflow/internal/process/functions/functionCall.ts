import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { BuiltIn, IdentifierReference, overwriteEnvironments, resolveByName } from '../../../environments'
import { NodeId, ParentInformation, RFunctionCall, RNodeWithParent, RParameter, Type } from '../../../../r-bridge'
import { guard } from '../../../../util/assert'
import {
  DataflowGraph,
  dataflowLogger,
  FunctionArgument, NamedFunctionArgument, PositionalFunctionArgument
} from '../../../index'
// TODO: support partial matches: https://cran.r-project.org/doc/manuals/r-release/R-lang.html#Argument-matching

export function processFunctionCall<OtherInfo>(functionCall: RFunctionCall<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const functionName = processDataflowFor(functionCall.functionName, data)
  const args = functionCall.arguments.map(arg => processDataflowFor(arg, data))
  const finalGraph = new DataflowGraph()

  // we update all the usage nodes within the dataflow graph of the function name to
  // mark them as function calls, and append their argument linkages
  let functionNameId: NodeId | undefined
  for(const [nodeId] of functionName.graph.nodes()) {
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

  const resolvedDefinitions = resolveByName(functionCallName, data.activeScope, data.environments)

  for(const arg of args) {
    finalEnv = overwriteEnvironments(finalEnv, arg.environments)
    finalGraph.mergeWith(arg.graph)
    const argumentOutRefs = arg.out

    guard(argumentOutRefs.length > 0, `Argument ${JSON.stringify(arg)} has no out references, but needs one for the unnamed arg`)
    // if there are multiple, we still use the first one as it is the highest-one and therefore the most top-level arg reference
    // multiple out references can occur if the argument itself is a function call
    callArgs.push(argumentOutRefs[0])

    // add an argument edge to the final graph
    finalGraph.addEdge(functionRootId, argumentOutRefs[0], 'argument', 'always')
    // TODO: bind the argument id to the corresponding argument within the function
  }

  // TODO:
  // finalGraph.addNode(functionCall.info.id, functionCall.functionName.content, finalEnv, down.activeScope, 'always')
  // call links are added on expression level

  if(resolvedDefinitions !== undefined) {
    const trackCallIds = resolvedDefinitions.map(r => r.definedAt)

    // we get them by just choosing the rhs of the definition - TODO: this should be improved - maybe by a second call track
    const allLinkedFunctions: (RNodeWithParent | undefined)[] = trackCallIds.filter(i => i !== BuiltIn).map(id => data.completeAst.idMap.get(id))

    for(const linkedFunctionBase of allLinkedFunctions) {
      guard(linkedFunctionBase !== undefined, `A function definition in ${JSON.stringify(trackCallIds)} not found in ast`)
      if(linkedFunctionBase.type !== Type.BinaryOp) {
        dataflowLogger.trace(`function call definition base ${functionCallName} does not lead to an assignment (${functionRootId}) but got ${linkedFunctionBase.type}`)
        continue
      }
      const linkedFunction = linkedFunctionBase.rhs

      if(linkedFunction.type !== Type.FunctionDefinition) {
        dataflowLogger.trace(`function call definition base ${functionCallName} does not lead to a function definition (${functionRootId}) but got ${linkedFunction.type}`)
        continue
      }
      dataflowLogger.trace(`linking arguments for ${functionCallName} (${functionRootId}) to ${JSON.stringify(linkedFunction.location)}`)
      linkArgumentsOnCall(callArgs, linkedFunction.parameters, finalGraph)
    }
  }

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
  const remainingArguments = args.filter(a => !Array.isArray(a)) as PositionalFunctionArgument[]

  // TODO ...
  for(let i = 0; i < remainingArguments.length; i++) {
    const arg: PositionalFunctionArgument = remainingArguments[i]
    if(arg === '<value>') {
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
