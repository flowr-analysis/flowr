import type { RAstNodeBase, Location, NoInfo, RNode, WithChildren } from '../model';
import type { RType } from '../type';
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

