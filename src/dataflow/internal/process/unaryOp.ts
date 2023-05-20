import { DataflowInformation } from '../info'

export function processUnaryOp<OtherInfo>(_op: unknown, operand: DataflowInformation<OtherInfo>): DataflowInformation<OtherInfo> {
  /* nothing has to happen to our knowledge */
  return operand
}
