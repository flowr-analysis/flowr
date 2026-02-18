import type { Leaf, Location, NoInfo } from '../model';
import { RType } from '../type';

/**
 * A `break` statement.
 */
export interface RBreak<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Break;
}

/**
 * Helper for working with {@link RBreak} AST nodes.
 */
export const RBreak = {
	name: 'RBreak',
	/**
	 * Type guard for {@link RBreak} nodes.
	 */
	is<Info = NoInfo>(this: void, node: unknown): node is RBreak<Info> {
		return typeof node === 'object' && node !== null && (node as RBreak<Info>).type === RType.Break;
	}
} as const;