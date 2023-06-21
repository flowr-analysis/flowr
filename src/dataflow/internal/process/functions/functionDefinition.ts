import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { overwriteEnvironments, popLocalEnvironment, resolveByName } from '../../../environments'
import { linkInputs } from '../../linker'
import { DataflowGraph, dataflowLogger } from '../../../index'
import { ParentInformation, RFunctionDefinition } from '../../../../r-bridge'

export function processFunctionDefinition<OtherInfo>(functionDefinition: RFunctionDefinition<OtherInfo & ParentInformation>, params: DataflowInformation<OtherInfo>[], body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  dataflowLogger.trace(`Processing function definition with id ${functionDefinition.info.id}`)
  // as we know, that parameters can not duplicate, we overwrite their environments (which is the correct behavior, if someone uses non-`=` arguments in functions)
  const argsEnvironment = params.map(a => a.environments).reduce((a, b) => overwriteEnvironments(a, b), down.environments)
  const bodyEnvironment = body.environments

  const subgraph = body.graph.mergeWith(...params.map(a => a.graph))

  // TODO: count parameter a=b as assignment!
  const readInParameters = params.flatMap(a => [...a.in, ...a.activeNodes])
  const readInBody = [...body.in, ...body.activeNodes]
  // there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
  const remainingRead = linkInputs(readInBody, down.activeScope, argsEnvironment, readInParameters.slice(), body.graph, true /* functions do not have to be called */)

  dataflowLogger.trace(`Function definition with id ${functionDefinition.info.id} has ${remainingRead.length} remaining reads (of ids [${remainingRead.map(r => r.nodeId).join(', ')}])`)


  // link same-def-def with arguments
  for (const writeTarget of body.out) {
    const writeName = writeTarget.name

    const resolved = resolveByName(writeName, down.activeScope, argsEnvironment)
    if (resolved !== undefined) {
      // write-write
      for (const target of resolved) {
        subgraph.addEdge(target, writeTarget, 'same-def-def', undefined, true)
      }
    }
  }

  const outEnvironment = overwriteEnvironments(argsEnvironment, bodyEnvironment)
  for(const read of remainingRead) {
    dataflowLogger.trace(`Adding node ${read.nodeId} to function graph in environment ${JSON.stringify(outEnvironment)} `)
    subgraph.addNode({ tag: 'use', id: read.nodeId, name: read.name, environment: outEnvironment, when: 'maybe' })
  }


  // all nodes in the function graph are maybe as functions do not have to be executed
  /* for(const [_, node] of subgraph.entries()) {
    node.when = 'maybe'
  } */

  const flow = {
    activeNodes:  [],
    in:           remainingRead,
    out:          [ /* TODO: out */ ],
    graph:        subgraph,
    environments: outEnvironment,
    ast:          down.ast,
    scope:        down.activeScope
  }

  // TODO: exit points?
  const graph = new DataflowGraph()
  graph.addNode({
    tag:         'function-definition',
    id:          functionDefinition.info.id,
    name:        functionDefinition.info.id,
    environment: popLocalEnvironment(down.environments),
    scope:       down.activeScope,
    when:        'always',
    subflow:     flow
  })
  // TODO: deal with function info
  // TODO: rest
  return {
    activeNodes:  [] /* nothing escapes a function definition, but the function itself, will be forced in assignment: { nodeId: functionDefinition.info.id, scope: down.activeScope, used: 'always', name: functionDefinition.info.id as string } */,
    in:           [] /* TODO: they must be bound on call */,
    out:          [],
    graph,
    /* TODO: have params. the potential to influence their surrounding on def? */
    environments: popLocalEnvironment(down.environments),
    ast:          down.ast,
    scope:        down.activeScope
  }
}
