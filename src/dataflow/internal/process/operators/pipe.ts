import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { linkIngoingVariablesInSameScope } from '../../linker'
import {  ParentInformation, Type } from '../../../../r-bridge'
import { overwriteEnvironments } from '../../../environments'
import { RPipe } from '../../../../r-bridge/lang:4.x/ast/model/nodes/RPipe'
import { dataflowLogger, graphToMermaidUrl } from '../../../index'
import { guard } from '../../../../util/assert'
import { linkReadsForArgument, UnnamedArgumentPrefix } from '../functions/argument'

export function processPipeOperation<OtherInfo>(op: RPipe<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const lhs = processDataflowFor(op.lhs, data)
  const rhs = processDataflowFor(op.rhs, data)

  // in-and outgoing are similar to that of a binary operation, we only 1) expect the rhs to be a function call and 2) modify the arguments.
  const ingoing = [...lhs.in, ...rhs.in, ...lhs.activeNodes, ...rhs.activeNodes]
  const nextGraph = lhs.graph.mergeWith(rhs.graph)
  linkIngoingVariablesInSameScope(nextGraph, ingoing)
  if(op.rhs.type !== Type.FunctionCall) {
    dataflowLogger.warn(`Expected rhs of pipe to be a function call, but got ${op.rhs.type} instead.`)
  } else {
    const maybeFunctionCallNode = nextGraph.get(op.rhs.info.id, true)
    guard(maybeFunctionCallNode !== undefined, () => `Expected function call node with id ${op.rhs.info.id} to be present in graph, but got undefined instead (graph: ${graphToMermaidUrl(nextGraph, data.completeAst.idMap)}).`)


    const functionCallNode = maybeFunctionCallNode[0]
    guard(functionCallNode.tag === 'function-call', () => `Expected function call node with id ${op.rhs.info.id} to be a function call node, but got ${functionCallNode.tag} instead.`)

    // make the lhs an argument node:
    const argId = op.lhs.info.id
    if(!nextGraph.hasNode(argId)) {
      nextGraph.addNode({ tag: 'use', id: argId, name: `${UnnamedArgumentPrefix}${argId}`, environment: data.environments, when: 'always' })
      linkReadsForArgument(op.lhs, [...lhs.activeNodes, ...lhs.in], nextGraph)
    }


    dataflowLogger.trace(`Linking pipe arg ${argId} as first argument of ${op.rhs.info.id}`)
    functionCallNode.args.unshift({
      nodeId: argId,
      name:   `${UnnamedArgumentPrefix}${argId}`,
      scope:  data.activeScope,
      used:   'always'
    })
    nextGraph.addEdge(functionCallNode.id, argId, 'argument', 'always')
  }

  return {
    activeNodes:  [],
    in:           ingoing,
    out:          [...lhs.out, ...rhs.out],
    environments: overwriteEnvironments(lhs.environments, rhs.environments),
    graph:        nextGraph,
    scope:        data.activeScope,
    ast:          data.completeAst
  }
}
