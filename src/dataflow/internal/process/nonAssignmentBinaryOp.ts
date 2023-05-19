import { DataflowInfo } from '../info'
import { guard } from '../../../util/assert'
import { DataflowProcessorDown } from '../../processor'
import { linkIngoingVariablesInSameScope } from '../linker'

export function processNonAssignmentBinaryOp<OtherInfo>(op: unknown, lhs: DataflowInfo<OtherInfo>, rhs: DataflowInfo<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  // TODO: produce special edges
  // TODO: fix merge of map etc.
  guard(down.scope === lhs.scope, 'non-assignment binary operations can not change scopes')
  guard(lhs.scope === rhs.scope, 'non-assignment binary operations can not bridge scopes')

  const ingoing = [...lhs.in, ...rhs.in, ...lhs.activeNodes, ...rhs.activeNodes]
  const nextGraph = lhs.graph.mergeWith(rhs.graph)
  linkIngoingVariablesInSameScope(nextGraph, ingoing)

  return {
    activeNodes: [], // binary ops require reads as without assignments there is no definition
    in:          ingoing,
    out:         [...lhs.out, ...rhs.out],
    // TODO: insert a join node?
    graph:       nextGraph,
    scope:       down.scope,
    ast:         down.ast
  }
}
