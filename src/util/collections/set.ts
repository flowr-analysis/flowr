/**
 * Given both sets, this checks if they contain the same elements.
 */
export function setEquals<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
	return a.size === b.size && a.isSubsetOf(b);
}

/**
 * Returns `A – B`
 */
export function setMinus<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): Set<T> {
	return a.difference(b);
}
