import { Base, Location, NoInfo, RNode } from '../model'
import { RType } from '../type'
import { RSymbol } from './RSymbol'
import { RExpressionList } from './RExpressionList'

/**
 * ```ts
 * for(<variable> in <vector>) <body>
 * ```
 */
export interface RForLoop<Info = NoInfo> extends Base<Info>, Location {
	readonly type: RType.ForLoop
	/** variable used in for-loop: <p> `for(<variable> in ...) ...`*/
	variable:      RSymbol<Info>
	/** vector used in for-loop: <p> `for(... in <vector>) ...`*/
	vector:        RNode<Info>
	/** body used in for-loop: <p> `for(... in ...) <body>`*/
	body:          RExpressionList<Info>
}
