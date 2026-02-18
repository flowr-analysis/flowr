import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { OperatorInformationValue } from '../operators';
import { OperatorDatabase } from '../operators';

/**
 * Unary operations like `+` and `-`
 */
export interface RUnaryOp<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.UnaryOp;
	operator:      string;
	operand:       RNode<Info>;
}

/**
 * Helper for working with {@link RUnaryOp} AST nodes.
 */
export const RUnaryOp = {
	name: 'RUnaryOp',
	/**
	 * Type guard for {@link RUnaryOp} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RUnaryOp<Info> {
		return node?.type === RType.UnaryOp;
	},
	/**
	 * Get the operator information for a binary operator node.
	 */
	getOperatorInfo<Info = NoInfo>(node: RUnaryOp<Info>): OperatorInformationValue | undefined {
		return OperatorDatabase[node.operator];
	}
} as const;