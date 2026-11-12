import type { BrandedIdentifier } from './identifier';

const removalMarkerPrefix = ' rm-removal:';

/** The reserved name recording that `name` was removed. */
export function removalMarkerOf(name: BrandedIdentifier): BrandedIdentifier {
	return (removalMarkerPrefix + name);
}

/** The name a {@link removalMarkerOf|marker} records the removal of, or the name itself if it is no marker. */
export function removedNameOf(name: BrandedIdentifier): BrandedIdentifier {
	return name.startsWith(removalMarkerPrefix) ? name.slice(removalMarkerPrefix.length) : name;
}

const removedNames = new Set<BrandedIdentifier>();

/** Records that a {@link removalMarkerOf|marker} was written for `name`; see {@link anyRemovalMarker}. */
export function noteRemovalMarker(name: BrandedIdentifier): void {
	removedNames.add(name);
}

/** Whether a removal marker was ever written for `name`, so nothing else pays for looking one up. */
export function anyRemovalMarker(name: BrandedIdentifier): boolean {
	return removedNames.has(name);
}
