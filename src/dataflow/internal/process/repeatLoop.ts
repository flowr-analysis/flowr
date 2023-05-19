import { log } from '../../../util/log'
import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'

export function processRepeatLoop<OtherInfo>(loop: unknown, body: DataflowInformation<OtherInfo>, _down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  // TODO
  log.error('repeat loop not implemented')
  return body
  /* {
    activeNodes: [],
    in:          [...body.in, ...body.activeNodes.map(id => ({attribute: 'maybe' as const, id: id.id}))],
    out:         body.out,
    graph:       body.graph
  } */
}
