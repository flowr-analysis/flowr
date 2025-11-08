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
 *
 */
export function isRNumber(node: RNode | undefined): node is RNumber {
	return node?.type === RType.Number;
}