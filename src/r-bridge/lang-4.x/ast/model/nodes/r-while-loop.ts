import type { Base, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';
import type { RExpressionList } from './r-expression-list';

/**
 * ```r
 * while(<condition>) <body>
 * ```
 */
export interface RWhileLoop<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.WhileLoop
	condition:     RNode<Info>
	body:          RExpressionList<Info>
}
