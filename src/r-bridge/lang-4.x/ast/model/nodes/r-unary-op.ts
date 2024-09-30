import type { Base, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';

/**
 * Unary operations like `+` and `-`
 */
export interface RUnaryOp<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.UnaryOp;
	operator:      string;
	operand:       RNode<Info>;
}

