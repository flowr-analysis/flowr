import type { RAstNodeBase, Location, NoInfo } from '../model';
import type { RType } from '../type';
import type { RExpressionList } from './r-expression-list';

/**
 * ```r
 * repeat <body>
 * ```
 */
export interface RRepeatLoop<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.RepeatLoop
	body:          RExpressionList<Info>
}
