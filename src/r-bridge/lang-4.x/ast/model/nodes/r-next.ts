import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';

/**
 * A `next` statement.
 */
export interface RNext<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Next;
}
