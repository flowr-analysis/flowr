import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { appendEnvironments } from '../environments'

export function processWhileLoop<OtherInfo>(loop: unknown, condition: DataflowInfo<OtherInfo>,
                                            body: DataflowInfo<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  // TODO: guards for same scopes etc.
  // TODO bind against definitions in condition?
  return {
    activeNodes:  [],
    in:           [...condition.in, ...body.in, ...condition.activeNodes, ...body.activeNodes /* TODO: .map(id => ({attribute: 'maybe' as const, id: id.id})) */],
    out:          [...body.out, ...condition.out], // todo: merge etc.
    graph:        condition.graph.mergeWith(body.graph),
    /* the body might not happen if the condition is false */
    environments: appendEnvironments(condition.environments, body.environments),
    ast:          down.ast,
    scope:        down.scope
  }
}
