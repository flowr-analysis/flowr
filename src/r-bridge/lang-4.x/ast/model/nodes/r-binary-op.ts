import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { OperatorInformationValue } from '../operators';
import { OperatorDatabase } from '../operators';

/**
 * Operators like `+`, `==`, `&&`, etc.
 */
export interface RBinaryOp<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.BinaryOp;
	operator:      string;
	lhs:           RNode<Info>;
	rhs:           RNode<Info>;
}

/**
 * Helper for working with {@link RBinaryOp} AST nodes.
 */
export const RBinaryOp = {
	/**
	 * Type guard for {@link RBinaryOp} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RBinaryOp<Info> {
		return node?.type === RType.BinaryOp;
	},
	/**
	 * Get the operator information for a binary operator node.
	 */
	getOperatorInfo<Info = NoInfo>(node: RBinaryOp<Info>): OperatorInformationValue | undefined {
		return OperatorDatabase[node.operator];
	}
} as const;