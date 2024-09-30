import type { Base, Location, NoInfo, RNode } from '../model';
import type { RType } from '../type';
import type { RExpressionList } from './r-expression-list';

/**
 * ```r
 * if(<condition>) <then> [else <otherwise>]
 * ```
 */
export interface RIfThenElse<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.IfThenElse;
	condition:     RNode<Info>;
	then:          RExpressionList<Info>;
	otherwise?:    RExpressionList<Info>;
}
