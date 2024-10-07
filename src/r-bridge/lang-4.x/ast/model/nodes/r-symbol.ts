import type { Leaf, Location, Namespace, NoInfo } from '../model';
import type { RType } from '../type';
import { RNa, RNull } from '../../../convert-values';

export function isSpecialSymbol(symbol: RSymbol): boolean {
	return symbol.content === RNull || symbol.content === RNa;
}

/**
 * Represents identifiers (variables).
 */
export interface RSymbol<Info = NoInfo, T extends string = string> extends Leaf<Info>, Namespace, Location {
	readonly type: RType.Symbol;
	content:       T;
}
