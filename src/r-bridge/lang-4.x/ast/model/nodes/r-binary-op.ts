import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import { BuiltInOperators, type OperatorFacts } from '../../../../../dataflow/environments/default-builtin-config/operators';

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
 * @helper ast
 */
export const RBinaryOp = {
	...RNode,
	name: 'RBinaryOp',
	/**
	 * Type guard for {@link RBinaryOp} nodes.
	 * @lintIgnore node-is node-is-optional
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RBinaryOp<Info> {
		return node?.type === RType.BinaryOp;
	},
	/**
	 * Get the operator information for a binary operator node.
	 */
	getOperatorInfo<Info = NoInfo>(node: RBinaryOp<Info>): OperatorFacts | undefined {
		return BuiltInOperators.byName[node.operator];
	}
} as const;