import type { Leaf, Location, NoInfo, RNode } from '../model';
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
	/**
	 * Type guard for {@link RNumber} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RNumber<Info> {
		return node?.type === RType.Number;
	}
} as const;