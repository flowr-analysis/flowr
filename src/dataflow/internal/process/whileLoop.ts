import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { appendEnvironments, makeAllMaybe } from '../environments'

export function processWhileLoop<OtherInfo>(loop: unknown, condition: DataflowInformation<OtherInfo>,
                                            body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO: guards for same scopes etc.
  // TODO bind against definitions in condition?
  return {
    activeNodes:  [],
    in:           [...condition.in, ...body.in, ...condition.activeNodes, ...makeAllMaybe(body.activeNodes) /* TODO: .map(id => ({attribute: 'maybe' as const, id: id.id})) */],
    out:          [...makeAllMaybe(body.out), ...condition.out], // todo: merge etc.
    graph:        condition.graph.mergeWith(body.graph),
    /* the body might not happen if the condition is false */
    environments: appendEnvironments(condition.environments, body.environments),
    ast:          down.ast,
    scope:        down.scope
  }
}
