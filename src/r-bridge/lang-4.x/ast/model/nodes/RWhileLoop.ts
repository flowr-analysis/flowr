import { Base, Location, NoInfo, RNode } from '../model'
import { Type } from '../type'
import { RExpressionList } from './RExpressionList'

/**
 * ```ts
 * while ( <condition> ) <body>
 * ```
 */
export interface RWhileLoop<Info = NoInfo> extends Base<Info>, Location {
	readonly type: Type.While
	condition:     RNode<Info>
	body:          RExpressionList<Info>
}
