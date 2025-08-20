
/**
 * given a potentially partial prefix like `hell`, this finds the matching name in the map, but only
 * if it is unique!
 *
 * @example
 * ```typescript
 * findByPrefixIfUnique('hell', { 'hello', 'bar' }) // => 'hello'
 * findByPrefixIfUnique('hell', { 'hello', 'hell' }) // => 'hell' (full match)
 * findByPrefixIfUnique('h', { 'hello', 'hell' }) // => undefined (not unique)
 * findByPrefixIfUnique('', { 'hello', 'hell' }) // => undefined (empty prefix)
 * ```
 */
export function findByPrefixIfUnique(prefix: string, keys: readonly string[] | MapIterator<string>): string | undefined {
	if(prefix === '') {
		return undefined;
	}
	let found: string | undefined = undefined;
	for(const key of keys) {
		if(key === prefix) {
			return key;
		}
		if(key.startsWith(prefix)) {
			if(found) {
				return undefined;
			}
			found = key;
		}
	}
	return found;
}