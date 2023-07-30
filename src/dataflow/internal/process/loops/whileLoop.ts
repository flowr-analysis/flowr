import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import {
  appendEnvironments,
  makeAllMaybe,
} from '../../../environments'
import { linkCircularRedefinitionsWithinALoop, linkInputs, produceNameSharedIdMap } from '../../linker'
import { ParentInformation, RWhileLoop } from '../../../../r-bridge'

export function processWhileLoop<OtherInfo>(loop: RWhileLoop<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const condition = processDataflowFor(loop.condition, data)
  data = { ...data, environments: condition.environments }
  // TODO: out in for must be active here
  const body = processDataflowFor(loop.body, data)

  const environments = condition.environments
  const nextGraph = condition.graph.mergeWith(body.graph)

  const finalEnvironments = appendEnvironments(condition.environments, body.environments)

  const remainingInputs = linkInputs([
    ...makeAllMaybe(body.activeNodes, nextGraph, finalEnvironments),
    ...makeAllMaybe(body.in, nextGraph, finalEnvironments)],
  data.activeScope, environments, [...condition.in, ...condition.activeNodes], nextGraph, true)

  linkCircularRedefinitionsWithinALoop(nextGraph, produceNameSharedIdMap(remainingInputs), body.out)

  return {
    activeNodes:  [],
    in:           remainingInputs,
    out:          [...makeAllMaybe(body.out, nextGraph, finalEnvironments), ...condition.out], // todo: merge etc.
    graph:        nextGraph,
    /* the body might not happen if the condition is false */
    environments: finalEnvironments,
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
