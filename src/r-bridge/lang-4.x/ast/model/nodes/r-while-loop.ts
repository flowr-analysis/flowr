import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RExpressionList } from './r-expression-list';

/**
 * ```r
 * while(<condition>) <body>
 * ```
 */
export interface RWhileLoop<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.WhileLoop
	condition:     RNode<Info>
	body:          RExpressionList<Info>
}

/**
 * Helper for working with {@link RWhileLoop} AST nodes.
 */
export const RWhileLoop = {
	/**
	 * Type guard for {@link RWhileLoop} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RWhileLoop<Info> {
		return node?.type === RType.WhileLoop;
	}
} as const;