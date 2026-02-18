import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { RExpressionList } from './r-expression-list';

/**
 * ```r
 * for(<variable> in <vector>) <body>
 * ```
 */
export interface RForLoop<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.ForLoop
	/** variable used in for-loop: <p> `for(<variable> in ...) ...`*/
	variable:      RSymbol<Info>
	/** vector used in for-loop: <p> `for(... in <vector>) ...`*/
	vector:        RNode<Info>
	/** body used in for-loop: <p> `for(... in ...) <body>`*/
	body:          RExpressionList<Info>
}

export const RForLoop = {
	/**
	 * Type guard for RForLoop nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RForLoop<Info> {
		return node?.type === RType.ForLoop;
	}
} as const;