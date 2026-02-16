import { guard } from '../../util/assert';
import { Bottom, BottomSymbol, type Lattice, Top, TopSymbol } from './lattice';

/**
 * The default limit of inferred constraints in {@link AbstractDomain|AbstractDomains}.
 */
export const DEFAULT_INFERENCE_LIMIT = 50;

/**
 * The default number of significant figures to consider for comparing numerical values in {@link AbstractDomain|AbstractDomains} to avoid floating-point precision issues.
 * `undefined` means that the values are compared with their full precision.
 * The typical range of significant figures for JavaScript numbers is around 1-17 significant digits, so a value of 15 is often a good choice to balance precision and performance.
 */
export const DEFAULT_SIGNIFICANT_FIGURES: number | undefined = undefined;

/**
 * An abstract domain as complete lattice with a widening operator, narrowing operator, concretization function, and abstraction function.
 * All operations of value abstract domains should not modify the domain in-place but return new values using {@link create}.
 * @template Concrete - Type of an concrete element of the concrete domain for the abstract domain
 * @template Abstract - Type of an abstract element of the abstract domain representing possible elements (excludes `Top` and `Bot`)
 * @template Top      - Type of the Top element of the abstract domain representing all possible elements
 * @template Bot      - Type of the Bottom element of the abstract domain representing no possible elements
 * @template Value    - Type of the abstract elements of the abstract domain (defaults to `Abstract` or `Top` or `Bot`)
 */
export abstract class AbstractDomain<Concrete, Abstract, Top, Bot, Value extends Abstract | Top | Bot = Abstract | Top | Bot>
implements Lattice<Abstract, Top, Bot, Value> {
	protected readonly _value: Value;

	constructor(value: Value) {
		this._value = value;
	}

	public get value(): Value {
		return this._value;
	}

	public abstract create(value: Abstract | Top | Bot): this;

	public abstract top(): this & AbstractDomain<Concrete, Abstract, Top, Bot, Top>;

	public abstract bottom(): this & AbstractDomain<Concrete, Abstract, Top, Bot, Bot>;

	public abstract equals(other: this): boolean;

	public abstract leq(other: this): boolean;

	public abstract join(other: this): this;

	/**
	 * Joins the current abstract value with multiple other abstract values.
	 */
	public joinAll(values: readonly this[]): this {
		let result = this.create(this.value);

		for(const other of values) {
			result = result.join(other);
		}
		return result;
	}

	public abstract meet(other: this): this;

	/**
	 * Meets the current abstract value with multiple other abstract values.
	 */
	public meetAll(values: readonly this[]): this {
		let result = this.create(this.value);

		for(const other of values) {
			result = result.meet(other);
		}
		return result;
	}

	/**
	 * Widens the current abstract value with another abstract value as a sound over-approximation of the join (least upper bound) for fixpoint iteration acceleration.
	 */
	public abstract widen(other: this): this;

	/**
	 * Narrows the current abstract value with another abstract value as a sound over-approximation of the meet (greatest lower bound) to refine the value after widening.
	 */
	public abstract narrow(other: this): this;

	/**
	 * Maps the current abstract value into a set of possible concrete values as concretization function of the abstract domain.
	 * The result should be `Top` if the number of concrete values would reach the `limit` or the resulting set would have infinite many elements.
	 */
	public abstract concretize(limit: number): ReadonlySet<Concrete> | typeof Top;

	/**
	 * Maps a set of possible concrete values into an abstract value as abstraction function of the abstract domain (should additionally be provided as static function).
	 */
	public abstract abstract(concrete: ReadonlySet<Concrete> | typeof Top): this;

	public abstract toJson(): unknown;

	public abstract toString(): string;

	public abstract isTop(): this is AbstractDomain<Concrete, Abstract, Top, Bot, Top>;

	public abstract isBottom(): this is AbstractDomain<Concrete, Abstract, Top, Bot, Bot>;

	public abstract isValue(): this is AbstractDomain<Concrete, Abstract, Top, Bot, Abstract>;

	/**
	 * Joins an array of abstract values by joining the first abstract value with the other values in the array.
	 * The provided array of abstract values must not be empty or a default value must be provided!
	 */
	public static joinAll<Domain extends AnyAbstractDomain>(values: Domain[], defaultValue?: Domain): Domain {
		guard(values.length > 0 || defaultValue !== undefined, 'Abstract values to join cannot be empty');
		return values[0]?.joinAll(values.slice(1)) ?? defaultValue;
	}

	/**
	 * Meets an array of abstract values by meeting the first abstract value with the other values in the array.
	 * The provided array of abstract values must not be empty or a default value must be provided!
	 */
	public static meetAll<Domain extends AnyAbstractDomain>(values: Domain[], defaultValue?: Domain): Domain {
		guard(values.length > 0 || defaultValue !== undefined, 'Abstract values to meet cannot be empty');
		return values[0]?.meetAll(values.slice(1)) ?? defaultValue;
	}
}

/**
 * A type representing any abstract domain without additional information.
 */
export type AnyAbstractDomain = AbstractDomain<unknown, unknown, unknown, unknown>;

/**
 * The type of the concrete domain of an abstract domain.
 * @template Domain - The abstract domain to get the concrete domain type for
 */
export type ConcreteDomain<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<infer Concrete, unknown, unknown, unknown> ? Concrete : never;

/**
 * The type of the abstract values of an abstract domain (including the Top and Bottom element).
 * @template Domain - The abstract domain to get the abstract value type for
 */
export type AbstractDomainValue<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<unknown, infer Value, infer Top, infer Bot> ? Value | Top | Bot : never;

/**
 * The type of the Top element (greatest element) of an abstract domain.
 * @template Domain - The abstract domain to get the Top element type for
 */
export type AbstractDomainTop<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<unknown, unknown, infer Top, unknown> ? Top : never;

/**
 * The type of the Bottom element (least element) of an abstract domain.
 * @template Domain - The abstract domain to get the Bottom element type for
 */
export type AbstractDomainBottom<Domain extends AnyAbstractDomain> =
	Domain extends AbstractDomain<unknown, unknown, unknown, infer Bot> ? Bot : never;

/**
 * Converts an element of an abstract domain into a string.
 */
export function domainElementToString(value: AnyAbstractDomain | unknown): string {
	if(typeof value === 'object' && value !== null && value.toString !== Object.prototype.toString) {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		return value.toString();
	} else if(value === Top) {
		return TopSymbol;
	} else if(value === Bottom) {
		return BottomSymbol;
	}
	return JSON.stringify(value);
}

/**
 * Checks whether a value is an abstract domain.
 */
export function isAbstractDomain(value: unknown): value is AnyAbstractDomain {
	if(typeof value !== 'object' || value === null) {
		return false;
	}
	return ['value', 'top', 'bottom', 'leq', 'join', 'meet', 'widen', 'narrow', 'concretize', 'abstract'].every(property => property in value);
}
