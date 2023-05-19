import { DataflowInformation } from '../info'
import { DataflowProcessorDown } from '../../processor'
import { guard } from '../../../util/assert'

export function processUnaryOp<OtherInfo>(op: unknown, operand: DataflowInformation<OtherInfo>, down: DataflowProcessorDown<OtherInfo>): DataflowInformation<OtherInfo> {
  guard(down.scope === operand.scope, 'unary operations can not change scopes (to my knowledge)')
  return operand
}
