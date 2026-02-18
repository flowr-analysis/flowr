import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RExpressionList } from './r-expression-list';

/**
 * ```r
 * if(<condition>) <then> [else <otherwise>]
 * ```
 */
export interface RIfThenElse<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.IfThenElse;
	condition:     RNode<Info>;
	then:          RExpressionList<Info>;
	otherwise?:    RExpressionList<Info>;
}

/**
 * Helper for working with {@link RIfThenElse} AST nodes.
 */
export const RIfThenElse = {
	/**
	 * Type guard for {@link RIfThenElse} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RIfThenElse<Info> {
		return node?.type === RType.IfThenElse;
	}
} as const;