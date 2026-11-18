import { AmbientStateName } from './ambient-state-name';
import { removedNameOf } from './removal-marker';
import type { BrandedIdentifier } from './identifier';
import { isS4ClassName } from '../internal/process/functions/call/built-in/built-in-s-four';

/**
 * Whether flowR made the name up for its own bookkeeping, so that no R code binds it: an ambient state (`#option:digits`), the
 * removal of a name (`rm(x)`), or an entry of the S4 class registry. A consumer listing what a package binds leaves these out.
 */
export function isReservedName(name: BrandedIdentifier): boolean {
	return AmbientStateName.is(name) || removedNameOf(name) !== name || isS4ClassName(name);
}
