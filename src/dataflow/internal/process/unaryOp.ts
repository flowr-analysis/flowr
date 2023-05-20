import { DataflowInformation } from '../info'

export function processUnaryOp<OtherInfo>(_op: unknown, operand: DataflowInformation<OtherInfo>): DataflowInformation<OtherInfo> {
  return operand
}
