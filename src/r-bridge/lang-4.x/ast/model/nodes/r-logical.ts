import type { Leaf, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';

export type RLogicalValue = boolean;

/**
 * Represents logical values (`TRUE` or `FALSE`).
 */
export interface RLogical<Info = NoInfo> extends Leaf<Info>, Location {
	readonly type: RType.Logical
	content:       RLogicalValue
}

/**
 * Helper for working with {@link RLogical} AST nodes.
 */
export const RLogical = {
	/**
	 * Type guard for {@link RLogical} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RLogical<Info> {
		return node?.type === RType.Logical;
	},
	/**
	 * Checks whether a node is a logical constant with value `TRUE`.
	 */
	isTrue<Info = NoInfo>(this: void, node: RNode<Info> | undefined): boolean {
		return RLogical.is(node) && node.content;
	},
	/**
	 * Checks whether a node is a logical constant with value `FALSE`.
	 */
	isFalse<Info = NoInfo>(this: void, node: RNode<Info> | undefined): boolean {
		return RLogical.is(node) && !node.content;
	}
} as const;