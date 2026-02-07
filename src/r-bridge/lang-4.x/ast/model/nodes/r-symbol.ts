import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';
import { RNa, RNull } from '../../../convert-values';
import type { Identifier } from '../../../../../dataflow/environments/identifier';


/**
 *
 */
export function isSpecialSymbol(symbol: RSymbol): boolean {
	return symbol.content === RNull || symbol.content === RNa;
}

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
