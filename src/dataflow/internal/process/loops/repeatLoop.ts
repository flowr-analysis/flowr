import { DataflowInformation } from '../../info'
import { DataflowProcessorDown } from '../../../processor'

export function processRepeatLoop<OtherInfo>(loop: unknown, body: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  return {
    activeNodes:  [],
    in:           [...body.in, ...body.activeNodes],
    out:          body.out,
    environments: body.environments,
    ast:          down.ast,
    scope:        down.scope,
    graph:        body.graph
  }
}
