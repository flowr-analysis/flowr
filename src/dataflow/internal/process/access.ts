import type { DataflowProcessorInformation } from '../../processor'
import type { ParentInformation, RAccess } from '../../../r-bridge'
import { RType } from '../../../r-bridge'
import type { DataflowInformation } from '../../info'
import { processNamedFunctionCall } from './functions/call/named-call-handling'
import { toUnnamedArgument } from './functions/call/argument/make-argument'

export function processAccess<OtherInfo>(node: RAccess<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const accessed = toUnnamedArgument(node.accessed, data.completeAst.idMap)
	return processNamedFunctionCall({
		type:      RType.Symbol,
		info:      node.info,
		content:   node.operator,
		lexeme:    node.lexeme,
		location:  node.location,
		namespace: undefined
	}, [accessed, ...node.access], node.info.id, data)
}
