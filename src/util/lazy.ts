/**
 * A type that can be either a value or a function that returns a value (to be only calculated on a need-to-have basis).
 *
 * @see {@link Lazy}
 * @see {@link isLazy}
 * @see {@link force}
 */
export type CanBeLazy<V> = V | Lazy<V>;
/**
 * A function that returns a value (to be only calculated on an need-to-have basis).
 *
 * @see {@link CanBeLazy}
 * @see {@link isLazy}
 * @see {@link force}
 */
export type Lazy<V> = () => V;

/**
 * Check if a value is a {@link Lazy|lazy} value.
 *
 * @see {@link CanBeLazy}
 * @see {@link Lazy}
 * @see {@link force}
 */
export function isLazy<V>(v: CanBeLazy<V>): v is Lazy<V> {
	return typeof v === 'function';
}

/**
 * Force a value to be calculated if it is lazy.
 *
 * @see {@link CanBeLazy}
 * @see {@link Lazy}
 * @see {@link isLazy}
 */
export function force<V>(v: CanBeLazy<V>): V {
	return isLazy(v) ? v() : v;
}