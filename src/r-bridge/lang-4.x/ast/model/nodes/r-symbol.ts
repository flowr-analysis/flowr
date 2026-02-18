import type { Leaf, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import { RNa, RNull } from '../../../convert-values';
import type { Identifier } from '../../../../../dataflow/environments/identifier';

/**
 * Represents identifiers (variables) such as `x` in `x <- 42` or `a::foo` in `a::foo()`.
 * See {@link Identifier} for more information about how identifiers are represented.
 * @typeParam Info - can be used to store additional information about the node
 * @typeParam T    - the type used to represent the identifier, by default {@link Identifier}
 */
export interface RSymbol<Info = NoInfo, T extends Identifier = Identifier> extends Leaf<Info>, Location {
	readonly type: RType.Symbol;
	content:       T;
}

/**
 * Helper for working with {@link RSymbol} AST nodes.
 */
export const RSymbol = {
	/**
	 * Type guard for {@link RSymbol} nodes.
	 * @see {@link RSymbol.isSpecial} - to check whether a symbol is a special symbol like `NA` or `NULL`
	 */
	is<OtherInfo = NoInfo>(this: void, node: RNode<OtherInfo> | undefined): node is RSymbol<OtherInfo> {
		return node?.type === RType.Symbol;
	},
	/**
	 * Type guard for special symbols, i.e. `NA` and `NULL`.
	 * @see {@link RNa} - for the value of `NA`
	 * @see {@link RNull} - for the value of `NULL`
	 * @see {@link RSymbol.is} - to check whether a node is a symbol at all
	 */
	isSpecial<OtherInfo = NoInfo>(this: void, node: RNode<OtherInfo> | undefined): node is RSymbol<OtherInfo, typeof RNull | typeof RNa> {
		return RSymbol.is(node) && (node.content === RNull || node.content === RNa);
	}
} as const;