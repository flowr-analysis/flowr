/**
 * Given both sets, this checks if they contain the same elements.
 */
export function setEquals<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	if(a.size !== b.size) {
		return false;
	}
	return a.symmetricDifference(b).size === 0;
}

/**
 * Returns `A – B`
 */
export function setMinus<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
	return a.difference(b);
}
