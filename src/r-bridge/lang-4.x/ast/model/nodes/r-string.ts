import type { Leaf, Location, NoInfo, RNode } from '../model';
import type { RStringValue } from '../../../convert-values';
import { RType } from '../type';

/**
 * Represents a string like `"hello"`, including raw strings like `r"(hello)"`.
 * @see {@link isRString} - to check whether a node is an R string
 */
export interface RString<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.String;
	content:       RStringValue;
}

/**
 * Type guard for RString nodes.
 * @see {@link RString}
 */
export function isRString(node: RNode | undefined): node is RString {
	return node?.type === RType.String;
}