import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'
import { linkCircularRedefinitionsWithinALoop, produceNameSharedIdMap } from '../../linker'

export function processRepeatLoop<OtherInfo>(loop: unknown, body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  const graph = body.graph
  const namedIdShares = produceNameSharedIdMap([...body.in, ...body.activeNodes])
  linkCircularRedefinitionsWithinALoop(graph, namedIdShares, body.out)

  return {
    activeNodes:  [],
    in:           [...body.in, ...body.activeNodes],
    out:          body.out,
    environments: body.environments,
    ast:          down.ast,
    scope:        down.activeScope,
    graph:        body.graph
  }
}
