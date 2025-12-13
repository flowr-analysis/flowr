
/**
 * Given a potentially partial prefix like `hell`, this finds the matching name in the keys, but only
 * if it is unique!
 * Please note, that `...` is considered special here, anything *afteR* `...` will not be matched by prefix but only by exact name,
 * following R's pmatch semantics.
 * @example
 * ```typescript
 * findByPrefixIfUnique('hello', [ 'hello', 'bar' ]) // => 'hello'
 * findByPrefixIfUnique('hell', [ 'hello', 'bar' ]) // => 'hello'
 * findByPrefixIfUnique('hell', [ 'hello', 'hell' ]) // => 'hell' (full/exact match)
 * findByPrefixIfUnique('hell', [ 'bar', '...', 'hello' ]) // => undefined (not matched due to being after `...`)
 * findByPrefixIfUnique('h', [ 'hello', 'hell' ]) // => undefined (not unique)
 * findByPrefixIfUnique('', [ 'hello', 'hell' ]) // => undefined (empty prefix)
 * ```
 */
export function findByPrefixIfUnique(prefix: string, keys: readonly string[] | MapIterator<string>): string | undefined {
	if(prefix === '') {
		return undefined;
	}
	let found: string | undefined = undefined;
	let matchPartial = true;
	for(const key of keys) {
		if(key === prefix) {
			return key;
		}
		if(key === '...') {
			matchPartial = false;
		} else if(matchPartial && key.startsWith(prefix)) {
			if(found) {
				return undefined;
			}
			found = key;
		}
	}
	return found;
}