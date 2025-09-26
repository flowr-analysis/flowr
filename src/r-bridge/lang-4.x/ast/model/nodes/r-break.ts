import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';

/**
 * A `break` statement.
 */
export interface RBreak<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.Break;
}
