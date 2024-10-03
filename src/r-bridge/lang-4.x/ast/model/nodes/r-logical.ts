import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';

export type RLogicalValue = boolean;

/**
 * Represents logical values (`TRUE` or `FALSE`).
 */
export interface RLogical<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.Logical
	content:       RLogicalValue
}
