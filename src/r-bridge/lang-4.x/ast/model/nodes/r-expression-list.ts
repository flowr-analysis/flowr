import type { Base, Location, NoInfo, RNode, WithChildren } from '../model'
import type { RType } from '../type'
import type { RDelimiter } from './info'

export interface RExpressionList<Info = NoInfo> extends WithChildren<Info, RNode<Info>>, Base<Info, string | undefined>, Partial<Location> {
	readonly type:     RType.ExpressionList;
	/** encodes wrappers like `{}` or `()` */
	readonly grouping: undefined | [start: RDelimiter, end: RDelimiter]
}

