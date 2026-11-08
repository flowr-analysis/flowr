import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import { BuiltInOperators, type OperatorFacts } from '../../../../../dataflow/environments/default-builtin-config/base-operators';

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
 * @helper ast
 */
export const RUnaryOp = {
	...RNode,
	name: 'RUnaryOp',
	/**
	 * Type guard for {@link RUnaryOp} nodes.
	 * @lintIgnore node-is node-is-optional
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RUnaryOp<Info> {
		return node?.type === RType.UnaryOp;
	},
	/**
	 * Get the operator information for a binary operator node.
	 */
	getOperatorInfo<Info = NoInfo>(node: RUnaryOp<Info>): OperatorFacts | undefined {
		return BuiltInOperators.byName[node.operator];
	}
} as const;