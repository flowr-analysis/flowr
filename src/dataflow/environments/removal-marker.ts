import type { BrandedIdentifier } from './identifier';
import { CacheScope, GlobalCaches } from '../../util/global-caches';

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
/**
 * Bounds {@link removedNames}. It may not forget a name while an environment holding its marker lives (in this or any
 * other analyzer), so past the bound every name counts as possibly removed, which costs a lookup but is never wrong.
 */
const MaxRemovedNames = 65_536;
let saturated = false;
GlobalCaches.register('removed-names', CacheScope.Process, () => removedNames.size, () => {
	/* forgetting names is unsafe, so releasing it means giving up on the shortcut */
	saturated = true;
	removedNames.clear();
}, MaxRemovedNames);

/** Records that a {@link removalMarkerOf|marker} was written for `name`; see {@link anyRemovalMarker}. */
export function noteRemovalMarker(name: BrandedIdentifier): void {
	if(saturated) {
		return;
	} else if(removedNames.size >= MaxRemovedNames) {
		saturated = true;
		removedNames.clear();
	} else {
		removedNames.add(name);
	}
}

/** Whether a removal marker may have been written for `name`, so nothing else pays for looking one up. */
export function anyRemovalMarker(name: BrandedIdentifier): boolean {
	return saturated || removedNames.has(name);
}
