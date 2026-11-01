import { SourceRange } from '../../../../../../util/range';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RUnnamedArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { FunctionArgument } from '../../../../../graph/graph';



/**
 * Converts a normalized node into an unnamed argument (wraps it with an argument node).
 */
export function toUnnamedArgument<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation> | undefined,
	idMap: AstIdMap<OtherInfo>
): RUnnamedArgument<OtherInfo & ParentInformation> | typeof EmptyArgument {
	if(node === undefined) {
		return EmptyArgument;
	}
	const arg: RUnnamedArgument<OtherInfo & ParentInformation> = {
		type:     RType.Argument,
		lexeme:   node.lexeme ?? '',
		location: node.location ?? SourceRange.invalid(),
		info:     {
			...node.info,
			id: node.info.id + '-arg'
		},
		name:  undefined,
		value: node
	};
	idMap.set(arg.info.id, node);
	return arg;
}


/**
 * Wraps the given nodes as unnamed arguments where necessary.
 */
export function wrapArgumentsUnnamed<OtherInfo>(
	nodes: readonly (RNode<OtherInfo & ParentInformation> | typeof EmptyArgument | undefined)[],
	idMap: AstIdMap<OtherInfo>
) {
	let needsWrap = false;
	for(let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		if(!FunctionArgument.isEmpty(n) && !RArgument.is(n)) {
			needsWrap = true;
			break;
		}
	}
	if(!needsWrap) {
		return nodes as readonly (RArgument<OtherInfo & ParentInformation> | typeof EmptyArgument)[];
	}
	const result = new Array<RUnnamedArgument<OtherInfo & ParentInformation> | RArgument<OtherInfo & ParentInformation> | typeof EmptyArgument>(nodes.length);
	for(let i = 0; i < nodes.length; i++) {
		const n = nodes[i];
		result[i] = FunctionArgument.isEmpty(n) || RArgument.is(n) ? n : toUnnamedArgument(n, idMap);
	}
	return result;
}
