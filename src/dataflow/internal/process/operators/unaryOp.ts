import { DataflowInformation } from '../../info'
import { DataflowProcessorInformation, processDataflowFor } from '../../../processor'
import { ParentInformation, RUnaryOp } from '../../../../r-bridge'

export function processUnaryOp<OtherInfo>(op: RUnaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	/* nothing has to happen to our knowledge */
	return processDataflowFor(op.operand, data)
}
