import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';

/**
 * ```r
 * # I am a line comment
 * ```
 */
export interface RComment<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Comment;
	content:       string;
}
