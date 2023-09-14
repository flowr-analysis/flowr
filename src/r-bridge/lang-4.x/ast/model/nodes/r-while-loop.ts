import { Base, Location, NoInfo, RNode } from '../model'
import { RType } from '../type'
import { RExpressionList } from './r-expression-list'

/**
 * ```ts
 * while ( <condition> ) <body>
 * ```
 */
export interface RWhileLoop<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.WhileLoop
	condition:     RNode<Info>
	body:          RExpressionList<Info>
}
