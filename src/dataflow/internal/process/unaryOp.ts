import { DataflowInfo } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { guard } from '../../../util/assert'

export function processUnaryOp<OtherInfo>(op: unknown, operand: DataflowInfo<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInfo<OtherInfo> {
  guard(down.scope === operand.scope, 'unary operations can not change scopes (to my knowledge)')

  return operand
}
