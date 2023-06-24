import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import {
  initializeCleanEnvironments,
  overwriteEnvironments,
  popLocalEnvironment,
  pushLocalEnvironment,
  resolveByName
} from '../../../environments'
import { linkInputs } from '../../linker'
import { DataflowGraph, dataflowLogger } from '../../../index'
import { ParentInformation, RFunctionDefinition } from '../../../../r-bridge'
import { retrieveExitPointsOfFunctionDefinition } from './exitPoints'


export function processFunctionDefinition<OtherInfo>(functionDefinition: RFunctionDefinition<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  dataflowLogger.trace(`Processing function definition with id ${functionDefinition.info.id}`)
  // within a function def we do not pass on the outer binds as they could be overwritten when called
  let env = initializeCleanEnvironments()
  for(let i = 0; i < data.environments.level + 1 /* add another env */; i++) {
    env = pushLocalEnvironment(env)
  }
  data = { ...data, environments: env }
  // TODO: update
  const params = []
  for(const param of functionDefinition.parameters) {
    const processed = processDataflowFor(param, data)
    params.push(processed)
    data = { ...data, environments: processed.environments }
  }
  const paramsEnvironments = data.environments

  const body = processDataflowFor(functionDefinition.body, data)
  // as we know, that parameters can not duplicate, we overwrite their environments (which is the correct behavior, if someone uses non-`=` arguments in functions)
  const bodyEnvironment = body.environments

  const subgraph = body.graph.mergeWith(...params.map(a => a.graph))

  // TODO: count parameter a=b as assignment!
  const readInParameters = params.flatMap(a => [...a.in, ...a.activeNodes])
  const readInBody = [...body.in, ...body.activeNodes]
  // there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
  const remainingRead = linkInputs(readInBody, data.activeScope, paramsEnvironments, readInParameters.slice(), body.graph, true /* functions do not have to be called */)

  dataflowLogger.trace(`Function definition with id ${functionDefinition.info.id} has ${remainingRead.length} remaining reads (of ids [${remainingRead.map(r => r.nodeId).join(', ')}])`)


  // link same-def-def with arguments
  for (const writeTarget of body.out) {
    const writeName = writeTarget.name

    const resolved = resolveByName(writeName, data.activeScope, paramsEnvironments)
    if (resolved !== undefined) {
      // write-write
      for (const target of resolved) {
        subgraph.addEdge(target, writeTarget, 'same-def-def', undefined, true)
      }
    }
  }

  const outEnvironment = overwriteEnvironments(paramsEnvironments, bodyEnvironment)
  for(const read of remainingRead) {
    dataflowLogger.trace(`Adding node ${read.nodeId} to function graph in environment ${JSON.stringify(outEnvironment)} `)
    subgraph.addNode({ tag: 'use', id: read.nodeId, name: read.name, environment: outEnvironment, when: 'maybe' })
  }


  const flow = {
    activeNodes:  [],
    in:           remainingRead,
    out:          [ /* TODO: out */ ],
    graph:        subgraph,
    environments: outEnvironment,
    ast:          data.completeAst,
    scope:        data.activeScope
  }

  const exitPoints = retrieveExitPointsOfFunctionDefinition(functionDefinition)

  // TODO: exit points?
  const graph = new DataflowGraph()
  graph.addNode({
    tag:         'function-definition',
    id:          functionDefinition.info.id,
    name:        functionDefinition.info.id,
    environment: popLocalEnvironment(data.environments),
    scope:       data.activeScope,
    when:        'always',
    subflow:     flow,
    exitPoints
  })
  // TODO: deal with function info
  // TODO: rest
  return {
    activeNodes:  [] /* nothing escapes a function definition, but the function itself, will be forced in assignment: { nodeId: functionDefinition.info.id, scope: down.activeScope, used: 'always', name: functionDefinition.info.id as string } */,
    in:           [] /* TODO: they must be bound on call */,
    out:          [],
    graph,
    /* TODO: have params. the potential to influence their surrounding on def? */
    environments: popLocalEnvironment(data.environments),
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
