import { Base, Location, NoInfo } from '../model'
import { RType } from '../type'
import { RExpressionList } from './r-expression-list'

/**
 * ```ts
 * repeat <body>
 * ```
 */
export interface RRepeatLoop<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.RepeatLoop
	body:          RExpressionList<Info>
}
