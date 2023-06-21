import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { ParentInformation } from '../../../../r-bridge'
import { RArgument } from '../../../../r-bridge/lang:4.x/ast/model/nodes/RArgument'

export function processFunctionArgument<OtherInfo>(argument: RArgument<OtherInfo & ParentInformation>, name: DataflowInformation<OtherInfo> | undefined,  value: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  const graph = name !== undefined ? name.graph.mergeWith(value.graph) : value.graph

  // TODO: defined-by for default values

  return {
    activeNodes:  [],
    // active nodes of the name will be lost as they are only used to reference the corresponding parameter
    in:           [...value.in, ...value.activeNodes, ...(name === undefined ? [] : [...name.in])],
    out:          [...value.out, ...(name?.out ?? [])],
    graph:        graph,
    environments: value.environments, // TODO: merge with name?
    ast:          down.ast,
    scope:        down.activeScope
  }
}
