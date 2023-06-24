import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation } from '../../../processor'
import { linkCircularRedefinitionsWithinALoop, produceNameSharedIdMap } from '../../linker'
import { ParentInformation, RRepeatLoop } from '../../../../r-bridge'

export function processRepeatLoop<OtherInfo>(loop: RRepeatLoop<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation<OtherInfo> {
  const graph = body.graph
  const namedIdShares = produceNameSharedIdMap([...body.in, ...body.activeNodes])
  linkCircularRedefinitionsWithinALoop(graph, namedIdShares, body.out)

  return {
    activeNodes:  [],
    in:           [...body.in, ...body.activeNodes],
    out:          body.out,
    environments: body.environments,
    ast:          data.completeAst,
    scope:        data.activeScope,
    graph:        body.graph
  }
}
