import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
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

/**
 * Helper for working with {@link RRepeatLoop} AST nodes.
 */
export const RRepeatLoop = {
	name: 'RRepeatLoop',
	/**
	 * Type guard for RRepeatLoop nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RRepeatLoop<Info> {
		return node?.type === RType.RepeatLoop;
	}
} as const;