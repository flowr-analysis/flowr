import type { RAstNodeBase, Location, NoInfo, RNode, WithChildren } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';

/**
 * Holds a list of expressions (and hence may be the root of an AST, summarizing all expressions in a file).
 * The `grouping` property holds information on if the expression list is structural or created by a wrapper like `{}` or `()`.
 */
export interface RExpressionList<Info = NoInfo> extends WithChildren<Info, RNode<Info>>, RAstNodeBase<Info, string | undefined>, Partial<Location> {
	readonly type:     RType.ExpressionList;
	/** encodes wrappers like `{}` or `()` */
	readonly grouping: undefined | [start: RSymbol<Info>, end: RSymbol<Info>]
}

/**
 * Helper for working with {@link RExpressionList} AST nodes.
 */
export const RExpressionList = {
	/**
	 * Type guard for {@link RExpressionList} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RExpressionList<Info> {
		return node?.type === RType.ExpressionList;
	},
	/**
	 * Type guard for implicit {@link RExpressionList} nodes, i.e., expression lists that are not created by a wrapper like `{}`.
	 */
	isImplicit<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RExpressionList<Info>  {
		return RExpressionList.is(node) && node.grouping === undefined;
	},
	/**
	 * Returns the grouping symbol at the start of the expression list, if it exists. For example, for an expression list created by `{ ... }`, this would return the symbol for `{`.
	 */
	groupStart<Info = NoInfo>(this: void, node: RExpressionList<Info>): RSymbol<Info> | undefined {
		return node.grouping?.[0];
	},
	/**
	 * Returns the grouping symbol at the end of the expression list, if it exists. For example, for an expression list created by `{ ... }`, this would return the symbol for `}`.
	 */
	groupEnd<Info = NoInfo>(this: void, node: RExpressionList<Info>): RSymbol<Info> | undefined {
		return node.grouping?.[1];
	}
} as const;