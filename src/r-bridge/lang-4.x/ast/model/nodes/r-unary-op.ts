import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';

/**
 * Unary operations like `+` and `-`
 */
export interface RUnaryOp<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.UnaryOp;
	operator:      string;
	operand:       RNode<Info>;
}

