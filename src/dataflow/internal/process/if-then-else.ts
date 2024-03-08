import type { DataflowInformation } from '../../info'
import type { DataflowProcessorInformation } from '../../processor'
import type { ParentInformation, RIfThenElse } from '../../../r-bridge'
import { RType } from '../../../r-bridge'
import { toUnnamedArgument } from './functions/call/argument/make-argument'
import { processNamedFunctionCall } from './functions/call/named-call-handling'

export function processIfThenElse<OtherInfo>(ifThen: RIfThenElse<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const args = [
		toUnnamedArgument(ifThen.condition, data.completeAst.idMap),
		toUnnamedArgument(ifThen.then, data.completeAst.idMap),
		toUnnamedArgument(ifThen.otherwise, data.completeAst.idMap)
	]
	return processNamedFunctionCall({
		type:      RType.Symbol,
		info:      ifThen.info,
		content:   ifThen.lexeme,
		lexeme:    ifThen.lexeme,
		location:  ifThen.location,
		namespace: undefined
	}, args, ifThen.info.id, data)
}
