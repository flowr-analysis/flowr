import type {
	DecoratedAstMap,
	ParentInformation,
	RNode,
	RUnnamedArgument
} from '../../../../../../r-bridge'
import {
	EmptyArgument,
	RType
} from '../../../../../../r-bridge'
import { rangeFrom } from '../../../../../../util/range'

export function toUnnamedArgument<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation> | undefined,
	idMap: DecoratedAstMap<OtherInfo>
): RUnnamedArgument<OtherInfo & ParentInformation> | typeof EmptyArgument {
	if(node === undefined) {
		return EmptyArgument
	}
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

export function wrapArgumentsUnnamed<OtherInfo>(
	nodes: readonly (RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined)[],
	idMap: DecoratedAstMap<OtherInfo>
) {
	return nodes.map(n => n === EmptyArgument || n?.type === RType.Argument ? n : toUnnamedArgument(n, idMap))
}