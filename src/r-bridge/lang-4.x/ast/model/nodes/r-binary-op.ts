import type { Base, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';

/**
 * Operators like `+`, `==`, `&&`, etc.
 */
export interface RBinaryOp<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.BinaryOp;
	operator:      string;
	lhs:           RNode<Info>;
	rhs:           RNode<Info>;
}

