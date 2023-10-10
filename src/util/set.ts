/**
 * Given both sets, this checks if they contain the same elements.
 */
export function setEquals<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	if(a.size !== b.size) {
		return false
	}
	for(const item of a) {
		if(!b.has(item)) {
			return false
		}
	}
	return true
}
