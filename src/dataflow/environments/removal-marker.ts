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

/** Whether `name` is such a marker rather than something the analyzed program bound. */
export function isRemovalMarker(name: BrandedIdentifier): boolean {
	return name.startsWith(removalMarkerPrefix);
}
