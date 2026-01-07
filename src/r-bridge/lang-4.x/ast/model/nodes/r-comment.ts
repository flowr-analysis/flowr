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
 * Checks whether the given node is an R comment.
 */
export function isRComment<Info = NoInfo>(node: unknown): node is RComment<Info> {
	return typeof node === 'object' && node !== null && (node as RComment<Info>).type === RType.Comment;
}