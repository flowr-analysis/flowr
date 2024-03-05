import type { DecoratedAstMap, ParentInformation, RNode, RUnnamedArgument } from '../../../../../r-bridge'
import { RType } from '../../../../../r-bridge'
import { rangeFrom } from '../../../../../util/range'

export function toUnnamedArgument<OtherInfo>(node: RNode<OtherInfo & ParentInformation>, idMap: DecoratedAstMap<OtherInfo>): RUnnamedArgument<OtherInfo & ParentInformation> {
	const arg: RUnnamedArgument<OtherInfo & ParentInformation> = {
		type:     RType.Argument,
		lexeme:   node.lexeme ?? '',
		// is this correct?
		location: node.location ?? rangeFrom(-1, -1, -1, -1),
		info:     {
			...node.info,
			id: node.info.id + '-arg'
		},
		name:  undefined,
		value: node
	}
	idMap.set(arg.info.id, node)
	return arg
}
