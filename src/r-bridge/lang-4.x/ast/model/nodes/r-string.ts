import type { Leaf, Location, NoInfo, RNode } from '../model';
import type { RStringValue } from '../../../convert-values';
import { RType } from '../type';

/**
 * Represents a string like `"hello"`, including raw strings like `r"(hello)"`.
 */
export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.String;
	content:       RStringValue;
}

/**
 *
 */
export function isRString(node: RNode | undefined): node is RString {
	return node?.type === RType.String;
}