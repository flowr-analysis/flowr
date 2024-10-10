import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';
import type { RStringValue } from '../../../convert-values';

/**
 * Represents a string like `"hello"`, including raw strings like `r"(hello)"`.
 */
export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.String;
	content:       RStringValue;
}
