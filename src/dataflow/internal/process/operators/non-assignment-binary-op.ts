import type { DataflowInformation } from '../../../info'
import type { DataflowProcessorInformation } from '../../../processor'
import type { ParentInformation, RBinaryOp } from '../../../../r-bridge'
import { RType } from '../../../../r-bridge'
import { toUnnamedArgument } from '../functions/call/argument/make-argument'
import { processNamedFunctionCall } from '../functions/call/named-call-handling'

export function processNonAssignmentBinaryOp<OtherInfo>(op: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const lhs = toUnnamedArgument(op.lhs, data.completeAst.idMap)
	const rhs = toUnnamedArgument(op.rhs, data.completeAst.idMap)

	return processNamedFunctionCall({
		type:      RType.Symbol,
		info:      op.info,
		content:   op.operator,
		lexeme:    op.lexeme,
		location:  op.location,
		namespace: undefined
	}, [lhs, rhs], op.info.id, data)
}
