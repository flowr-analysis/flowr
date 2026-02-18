import type { Leaf, Location, NoInfo } from '../model';
import { RType } from '../type';

/**
 * ```r
 * # I am a line comment
 * ```
 */
export interface RComment<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Comment;
}

/**
 * Helper for working with {@link RComment} AST nodes.
 */
export const RComment = {
	/**
	 * Type guard for {@link RComment} nodes.
	 */
	is<Info = NoInfo>(this: void, node: unknown): node is RComment<Info> {
		return typeof node === 'object' && node !== null && (node as RComment<Info>).type === RType.Comment;
	}
} as const;