import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { ParentInformation, RArgument } from '../../../../r-bridge'
import { LocalScope } from '../../../graph'

export const UnnamedArgumentPrefix = 'unnamed-argument-'

export function processFunctionArgument<OtherInfo>(argument: RArgument<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const name = argument.name === undefined ? undefined : processDataflowFor(argument.name, data)
  const value = processDataflowFor(argument.value, data)
  // we do not keep the graph of the name, as this is no node that should ever exist
  const graph = value.graph

  const argContent = argument.name?.content
  const argumentName = argContent === undefined ? `${UnnamedArgumentPrefix}${argument.info.id}` : `${argContent}-${argument.info.id}`
  graph.addNode({ tag: 'use', id: argument.info.id, name: argumentName, environment: data.environments, when: 'always' })

  const ingoingRefs = [...value.activeNodes, ...value.in, ...(name === undefined ? [] : [...name.in])]

  const findArg = ingoingRefs.find(r => r.nodeId === argument.value.info.id)
  if(findArg !== undefined) {
    // link against the root reference currently i do not know how to deal with nested function calls otherwise
    graph.addEdge(argument.info.id, findArg, 'read', 'always')
  }

  // TODO: defined-by for default values

  return {
    activeNodes:  [],
    // active nodes of the name will be lost as they are only used to reference the corresponding parameter
    in:           ingoingRefs,
    // , ...value.out, ...(name?.out ?? [])
    out:          [ { name: argumentName, scope: LocalScope, nodeId: argument.info.id, used: 'always'} ],
    graph:        graph,
    environments: value.environments, // TODO: merge with name?
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
