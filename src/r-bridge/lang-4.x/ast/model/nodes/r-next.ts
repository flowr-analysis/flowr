import type { Leaf, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';

/**
 * A `next` statement.
 */
export interface RNext<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Next;
}

/**
 * Helper for working with {@link RNext} AST nodes.
 */
export const RNext = {
	name: 'RNext',
	/**
	 * Type guard for {@link RNext} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RNext<Info> {
		return node?.type === RType.Next;
	}
} as const;