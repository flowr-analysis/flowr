import type { Leaf, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import type { RNumberValue } from '../../../convert-values';

/**
 * A number like `3`, `-2.14`, `1L`, or `2i`.
 * Includes numeric, integer, and complex.
 * See {@link RNumberValue} for more information.
 */
export interface RNumber<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.Number
	content:       RNumberValue
}

/**
 * Helper for working with {@link RNumber} AST nodes.
 */
export const RNumber = {
	...RNode,
	name: 'RNumber',
	/**
	 * Type guard for {@link RNumber} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RNumber<Info> {
		return node?.type === RType.Number;
	},
	/**
	 * The value `node` is written as, counting a leading unary minus (`-1`) as part of the literal;
	 * `undefined` whenever the value is not spelled out in the source.
	 */
	literalValueOf<Info = NoInfo>(this: void, node: RNode<Info> | undefined): number | undefined {
		if(RNumber.is(node)) {
			return node.content.num;
		}
		return node?.type === RType.UnaryOp && node.operator === '-' && RNumber.is(node.operand)
			? -node.operand.content.num : undefined;
	}
} as const;