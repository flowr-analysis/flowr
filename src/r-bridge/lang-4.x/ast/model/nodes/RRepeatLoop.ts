import { Base, Location, NoInfo } from '../model'
import { Type } from '../type'
import { RExpressionList } from './RExpressionList'

/**
 * ```ts
 * repeat <body>
 * ```
 */
export interface RRepeatLoop<Info = NoInfo> extends Base<Info>, Location {
	readonly type: Type.RepeatLoop
	body:          RExpressionList<Info>
}
