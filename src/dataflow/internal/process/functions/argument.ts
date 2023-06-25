import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { ParentInformation, RArgument } from '../../../../r-bridge'
import { LocalScope } from '../../../graph'

export const UnnamedArgumentPrefix = 'unnamed-argument-'

export function processFunctionArgument<OtherInfo>(argument: RArgument<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const name = argument.name === undefined ? undefined : processDataflowFor(argument.name, data)
  const value = processDataflowFor(argument.value, data)
  const graph = name !== undefined ? name.graph.mergeWith(value.graph) : value.graph

  const argContent = argument.name?.content
  const argumentName = argContent === undefined ? `${UnnamedArgumentPrefix}${argument.info.id}` : `${argContent}-${argument.info.id}`
  graph.addNode({ tag: 'use', id: argument.info.id, name: argumentName, environment: data.environments, when: 'always' })

  const ingoingRefs = [...value.in, ...value.activeNodes, ...(name === undefined ? [] : [...name.in])]
  for(const ingoingRef of ingoingRefs) {
    graph.addEdge(argument.info.id, ingoingRef, 'read', 'always')
  }

  // TODO: defined-by for default values

  return {
    activeNodes:  [],
    // active nodes of the name will be lost as they are only used to reference the corresponding parameter
    in:           ingoingRefs,
    out:          [ { name: argumentName, scope: LocalScope, nodeId: argument.info.id, used: 'always'}, ...value.out, ...(name?.out ?? [])],
    graph:        graph,
    environments: value.environments, // TODO: merge with name?
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
