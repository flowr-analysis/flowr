import { log } from '../../../util/log'
import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'

export function processRepeatLoop<OtherInfo>(loop: unknown, body: DataflowInfo<OtherInfo>, _down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
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
