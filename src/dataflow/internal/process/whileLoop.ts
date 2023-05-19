import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'

export function processWhileLoop<OtherInfo>(loop: unknown, condition: DataflowInfo<OtherInfo>,
                                            body: DataflowInfo<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  // TODO: guards for same scopes etc.
  // TODO
  return {
    activeNodes: [],
    in:          [...condition.in, ...body.in, ...condition.activeNodes, ...body.activeNodes /* TODO: .map(id => ({attribute: 'maybe' as const, id: id.id})) */],
    out:         [...body.out, ...condition.out], // todo: merge etc.
    graph:       condition.graph.mergeWith(body.graph),
    ast:         down.ast,
    scope:       down.scope
  }
}
