import type { Ternary } from '../../util/logic';

/**
 * The Top symbol to represent the Top element of complete lattices (e.g. of abstract domains).
 */
export const Top = Symbol('top');
export const TopSymbol = '⊤';

/**
 * The Bottom symbol to represent the Bottom element of complete lattices (e.g. of abstract domains).
 */
export const Bottom = Symbol('bottom');
export const BottomSymbol = '⊥';

/**
 * A complete lattice with a partially ordered set, join operator (LUB), meet operator (GLB), top element, and bottom element (e.g. for abstract domains).
 * @template Value - Type of a lattice element representing a value (may exclude `Top` and `Bot`)
 * @template Top   - Type of the Top element (greatest element) of the complete lattice
 * @template Bot   - Type of the Bottom element (least element) of the complete lattice
 * @template Lift  - Type of the lattice elements (defaults to `Value` or `Top` or `Bot`)
 */
export interface Lattice<Value, Top, Bot, Lift extends Value | Top | Bot = Value | Top | Bot> {
	/**
	 * The current abstract value of the lattice.
	 */
	get value(): Lift;

	/**
	 * Creates an abstract value of the lattice for a given value.
	 */
	create(value: Value | Top | Bot): this;

	/**
	 * Gets the Top element (greatest element) of the complete lattice (should additionally be provided as static function).
	 */
	top(): this & Lattice<Value, Top, Bot, Top>;

	/**
	 * Gets the Bottom element (least element) of the complete lattice (should additionally be provided as static function).
	 */
	bottom(): this & Lattice<Value, Top, Bot, Bot>;

	/**
	 * Checks whether the current abstract value equals to another abstract value.
	 */
	equals(other: this): Ternary;

	/**
	 * Checks whether the current abstract value is less than or equal to another abstract value with respect to the partial order of the lattice.
	 */
	leq(other: this): Ternary;

	/**
	 * Joins the current abstract value with another abstract value by creating the least upper bound (LUB) in the lattice.
	 */
	join(other: this): this;

	/**
	 * Meets the current abstract value with another abstract value by creating the greatest lower bound (GLB) in the lattice.
	 */
	meet(other: this): this;

	/**
	 * Converts the lattice into a JSON serializable value.
	 */
	toJson(): unknown;

	/**
	 * Converts the lattice into a human-readable string.
	 */
	toString(): string;

	/**
	 * Checks whether the current abstract value is the Top element of the complete lattice.
	 */
	isTop(): this is Lattice<Value, Top, Bot, Top>;

	/**
	 * Checks whether the current abstract value is the Bottom element of the complete lattice.
	 */
	isBottom(): this is Lattice<Value, Top, Bot, Bot>;

	/**
	 * Checks whether the current abstract value is an actual value of the complete lattice
	 * (this may include the Top or Bottom element if they are also values and no separate symbols, for example).
	 */
	isValue(): this is Lattice<Value, Top, Bot, Value>;
}
