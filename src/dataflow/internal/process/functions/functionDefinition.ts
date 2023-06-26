import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import {
  IdentifierReference,
  initializeCleanEnvironments,
  overwriteEnvironments,
  popLocalEnvironment,
  pushLocalEnvironment, REnvironmentInformation,
  resolveByName
} from '../../../environments'
import { linkInputs } from '../../linker'
import { DataflowGraph, dataflowLogger, DataflowMap } from '../../../index'
import { collectAllIds, ParentInformation, RFunctionDefinition } from '../../../../r-bridge'
import { retrieveExitPointsOfFunctionDefinition } from './exitPoints'
import { guard } from '../../../../util/assert'


function linkLowestClosureVariables<OtherInfo>(subgraph: DataflowGraph, outEnvironment: REnvironmentInformation, data: DataflowProcessorInformation<OtherInfo & ParentInformation>, functionDefinition: RFunctionDefinition<OtherInfo & ParentInformation>) {
  // track *all* function definitions - included those nested within the current graph
  // try to resolve their 'in' by only using the lowest scope which will be popped after this definition
  for (const [id, info] of subgraph.nodes(true)) {
    if (info.tag !== 'function-definition') {
      continue
    }
    const ingoingRefs = info.subflow.in
    const remainingIn: IdentifierReference[] = []
    for (const ingoing of ingoingRefs) {
      const env = initializeCleanEnvironments()
      env.current.memory = outEnvironment.current.memory
      const resolved = resolveByName(ingoing.name, data.activeScope, env)
      if (resolved === undefined) {
        remainingIn.push(ingoing)
        continue
      }
      dataflowLogger.trace(`Found ${resolved.length} references to open ref ${id} in closure of function definition ${functionDefinition.info.id} (${JSON.stringify(resolved)})`)
      for (const ref of resolved) {
        subgraph.addEdge(ingoing, ref, 'read', 'always')
      }
    }
    dataflowLogger.trace(`Keeping ${remainingIn.length} references to open ref ${id} in closure of function definition ${functionDefinition.info.id}`)
    info.subflow.in = remainingIn
  }
}

function prepareFunctionEnvironment<OtherInfo>(data: DataflowProcessorInformation<OtherInfo & ParentInformation>) {
  let env = initializeCleanEnvironments()
  for (let i = 0; i < data.environments.level + 1 /* add another env */; i++) {
    env = pushLocalEnvironment(env)
  }
  return { ...data, environments: env }
}

export function processFunctionDefinition<OtherInfo>(functionDefinition: RFunctionDefinition<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  dataflowLogger.trace(`Processing function definition with id ${functionDefinition.info.id}`)

  // within a function def we do not pass on the outer binds as they could be overwritten when called
  data = prepareFunctionEnvironment(data)

  const subgraph = new DataflowGraph()

  const readInParameters: IdentifierReference[] = []
  for(const param of functionDefinition.parameters) {
    const processed = processDataflowFor(param, data)
    subgraph.mergeWith(processed.graph)
    const read = [...processed.in, ...processed.activeNodes]
    linkInputs(read, data.activeScope, data.environments, readInParameters, subgraph, false)
    data = { ...data, environments: overwriteEnvironments(data.environments, processed.environments) }
  }
  const paramsEnvironments = data.environments

  const body = processDataflowFor(functionDefinition.body, data)
  // as we know, that parameters can not duplicate, we overwrite their environments (which is the correct behavior, if someone uses non-`=` arguments in functions)
  const bodyEnvironment = body.environments


  const readInBody = [...body.in, ...body.activeNodes]
  // there is no uncertainty regarding the arguments, as if a function header is executed, so is its body
  const remainingRead = linkInputs(readInBody, data.activeScope, paramsEnvironments, readInParameters.slice(), body.graph, true /* functions do not have to be called */)

  subgraph.mergeWith(body.graph)

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
  // if exit points are extra, we must link them to all dataflow nodes they relate to.
  linkExitPointsInGraph(exitPoints, subgraph, data.completeAst.idMap, data.environments)
  linkLowestClosureVariables(subgraph, outEnvironment, data, functionDefinition)

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
  return {
    activeNodes:  [] /* nothing escapes a function definition, but the function itself, will be forced in assignment: { nodeId: functionDefinition.info.id, scope: down.activeScope, used: 'always', name: functionDefinition.info.id as string } */,
    in:           [ /* TODO: keep in of parameters */ ],
    out:          [],
    graph,
    /* TODO: have params. the potential to influence their surrounding on def? */
    environments: popLocalEnvironment(data.environments),
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}


function linkExitPointsInGraph<OtherInfo>(exitPoints: string[], graph: DataflowGraph, idMap: DataflowMap<OtherInfo>, environment: REnvironmentInformation): void {
  for(const exitPoint of exitPoints) {
    const exitPointNode = graph.get(exitPoint)
    // if there already is an exit point it is either a variable or already linked
    if(exitPointNode !== undefined) {
      continue
    }
    const nodeInAst = idMap.get(exitPoint)

    guard(nodeInAst !== undefined, `Could not find exit point node with id ${exitPoint} in ast`)
    graph.addNode({ tag: 'exit-point', id: exitPoint, name: `${nodeInAst.lexeme ?? '??'}`, when: 'always', environment })

    const allIds = [...collectAllIds(nodeInAst)].filter(id => graph.get(id) !== undefined)
    for(const relatedId of allIds) {
      // TODO: custom edge type?
      if(relatedId !== exitPoint) {
        graph.addEdge(exitPoint, relatedId, 'relates', 'always')
      }
    }
  }
}

