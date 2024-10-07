import type { Base, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';

/**
 * Variant of the binary operator, specifically for the new, built-in pipe operator.
 */
export interface RPipe<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.Pipe;
	readonly lhs:  RNode<Info>;
	readonly rhs:  RNode<Info>;
}

