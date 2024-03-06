import type { ParentInformation, RBinaryOp } from '../../../../r-bridge'
import { RType } from '../../../../r-bridge'
import type { DataflowProcessorInformation } from '../../../processor'
import { dataflowLogger } from '../../../index'
import type { DataflowInformation } from '../../../info'
import { processNamedFunctionCall } from '../functions/call/named-call-handling'
import { toUnnamedArgument } from '../functions/call/argument/make-argument'

export function processAssignment<OtherInfo>(op: RBinaryOp<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	dataflowLogger.trace(`Processing assignment with id ${op.info.id}`)
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
