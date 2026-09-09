import type { BrandedIdentifier } from './identifier';

/**
 * Reserved marker binding recording that a name was removed here, keyed by the removed name; the leading space
 * cannot collide with one a program writes. It is what lets a later read of the name that now resolves to
 * something else -- the built-in `sum` after `rm(sum)` -- depend on the removal that revealed it.
 */
const removalMarkerPrefix = ' rm-removal:';

/** The reserved name recording that `name` was removed. */
export function removalMarkerOf(name: BrandedIdentifier): BrandedIdentifier {
	return (removalMarkerPrefix + name);
}

/** The names a {@link removalMarkerOf|marker} was written for, so a name no removal ever took away never looks for one. */
const removedNames = new Set<BrandedIdentifier>();

/** Records that a {@link removalMarkerOf|marker} was written for `name`; see {@link anyRemovalMarker}. */
export function noteRemovalMarker(name: BrandedIdentifier): void {
	removedNames.add(name);
}

/** Whether a removal marker was ever written for `name`, so nothing else pays for looking one up. */
export function anyRemovalMarker(name: BrandedIdentifier): boolean {
	return removedNames.has(name);
}
