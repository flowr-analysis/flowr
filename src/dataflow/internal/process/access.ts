import type { DataflowProcessorInformation } from '../../processor'
import type { ParentInformation, RAccess, RUnnamedArgument } from '../../../r-bridge'
import { RType } from '../../../r-bridge'
import type { DataflowInformation } from '../../info'
import { processNamedFunctionCall } from './functions/call/named-call-handling'

export function processAccess<OtherInfo>(node: RAccess<OtherInfo & ParentInformation>, data: DataflowProcessorInformation<OtherInfo & ParentInformation>): DataflowInformation {
	const accessed: RUnnamedArgument<OtherInfo & ParentInformation> = {
		type:     RType.Argument,
		lexeme:   node.accessed.lexeme ?? '',
		// is this correct?
		location: node.accessed.location ?? node.location,
		info:     {
			...node.info,
			id: node.info.id + '-accessed'
		},
		name:  undefined,
		value: node.accessed
	}
	data.completeAst.idMap.set(accessed.info.id, accessed)
	return processNamedFunctionCall({
		type:      RType.Symbol,
		info:      node.info,
		content:   node.operator,
		lexeme:    node.lexeme,
		location:  node.location,
		namespace: undefined
	}, [accessed, ...node.access], node.info.id, data)
}
