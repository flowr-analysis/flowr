/**
 * The Top symbol to represent the Top element of complete lattices (e.g. of abstract domains).
 */
export const Top = Symbol('top');

/**
 * The Bottom symbol to represent the Bottom element of complete lattices (e.g. of abstract domains).
 */
export const Bottom = Symbol('bottom');

/**
 * A complete lattice with a partially ordered set, join operator (LUB), meet operator (GLB), top element, and bottom element (e.g. for abstract domains).
 * @template Lat   - Type of the implemented lattice
 * @template Value - Type of a lattice element representing a value (may exclude `Top` and `Bot`)
 * @template Top   - Type of the Top element (greatest element) of the complete lattice (defaults to {@link Top})
 * @template Bot   - Type of the Bottom element (least element) of the complete lattice (defaults to {@link Bottom})
 * @template Lift  - Type of the lattice elements (defaults to `Value` or `Top` or `Bot`)
 */
export interface Lattice<Lat extends Lattice<Lat, Value, Top, Bot>, Value, Top = typeof Top, Bot = typeof Bottom, Lift extends Value | Top | Bot = Value | Top | Bot> {
	/**
	 * The current abstract value of the lattice.
	 */
	get value(): Lift;

	/**
	 * Creates an abstract value of the lattice for a given value.
	 */
	create(value: Value | Top | Bot): Lat;

	/**
	 * Gets the Top element (greatest element) of the complete lattice (should additionally be provided as static function).
	 */
	top(): Lat & Lattice<Lat, Value, Top, Bot, Top>;

	/**
	 * Gets the Bottom element (least element) of the complete lattice (should additionally be provided as static function).
	 */
	bottom(): Lat & Lattice<Lat, Value, Top, Bot, Bot>;

	/**
	 * Checks whether the current abstract value equals to another abstract value.
	 */
	equals(other: Lat): boolean;

	/**
	 * Checks whether the current abstract value is less than or equal to another abstract value with respect to the partial order of the lattice.
	 */
	leq(other: Lat): boolean;

	/**
	 * Joins the current abstract value with other abstract values by creating the least upper bound (LUB) in the lattice.
	 */
	join(...values: Lat[]): Lat;

	/**
	 * Meets the current abstract value with other abstract values by creating the greatest lower bound (GLB) in the lattice.
	 */
	meet(...values: Lat[]): Lat;

	/**
	 * Converts the lattice into a human-readable string.
	 */
	toString(): string;

	/**
	 * Checks whether the current abstract value is the Top element of the complete lattice.
	 */
	isTop(): this is Lat & Lattice<Lat, Value, Top, Bot, Top>;

	/**
	 * Checks whether the current abstract value is the Bottom element of the complete lattice.
	 */
	isBottom(): this is Lat & Lattice<Lat, Value, Top, Bot, Bot>;

	/**
	 * Checks whether the current abstract value is an actual value of the complete lattice
	 * (this may include the Top or Bottom element if they are also values and no separate symbols, for example).
	 */
	isValue(): this is Lat & Lattice<Lat, Value, Top, Bot, Value>;
}
