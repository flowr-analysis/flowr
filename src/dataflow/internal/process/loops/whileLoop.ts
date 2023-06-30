import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { appendEnvironments } from '../../../environments'
import { linkCircularRedefinitionsWithinALoop, linkInputs, produceNameSharedIdMap } from '../../linker'
import { ParentInformation, RWhileLoop } from '../../../../r-bridge'

export function processWhileLoop<OtherInfo>(loop: RWhileLoop<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const condition = processDataflowFor(loop.condition, data)
  // TODO: out in for must be active here
  const body = processDataflowFor(loop.body, { ...data, when: 'maybe' })

  const environments = condition.environments
  const nextGraph = condition.graph.mergeWith(body.graph)

  const remainingInputs = linkInputs([...body.activeNodes, ...body.in], data.activeScope, environments, [...condition.in, ...condition.activeNodes], nextGraph, true)

  linkCircularRedefinitionsWithinALoop(nextGraph, produceNameSharedIdMap(remainingInputs), body.out)

  return {
    activeNodes:  [],
    in:           remainingInputs,
    out:          [...body.out, ...condition.out], // todo: merge etc.
    graph:        nextGraph,
    /* the body might not happen if the condition is false */
    environments: appendEnvironments(condition.environments, body.environments),
    ast:          data.completeAst,
    scope:        data.activeScope
  }
}
