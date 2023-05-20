import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'
import {
  appendEnvironments,
  initializeCleanEnvironments,
  makeAllMaybe,
} from '../../environments'
import { linkInputs } from '../linker'

export function processWhileLoop<OtherInfo>(loop: unknown, condition: DataflowInformation<OtherInfo>,
                                            body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // link for previous line (TODO: ship environments and so one in a general way)
  const environments = condition.environments ?? initializeCleanEnvironments()
  const nextGraph = condition.graph.mergeWith(body.graph)

  const remainingInputs = linkInputs(makeAllMaybe([...body.activeNodes, ...body.in]), down, environments, [...condition.in, ...condition.activeNodes], nextGraph)
  // TODO bind against definitions in condition?
  return {
    activeNodes:  [],
    in:           remainingInputs,
    out:          [...makeAllMaybe(body.out), ...condition.out], // todo: merge etc.
    graph:        nextGraph,
    /* the body might not happen if the condition is false */
    environments: appendEnvironments(condition.environments, body.environments),
    ast:          down.ast,
    scope:        down.scope
  }
}
