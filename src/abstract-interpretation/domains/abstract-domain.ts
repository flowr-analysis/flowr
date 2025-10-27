import type { Lattice } from './lattice';
import { Bottom, Top } from './lattice';

/**
 * The default limit of inferred constraints in {@link AbstractDomain|AbstractDomains}.
 */
export const DEFAULT_INFERENCE_LIMIT = 50;

/**
 * An abstract domain as complete lattice with a widening operator, narrowing operator, concretization function, and abstraction function.
 * @template Domain   - Type of the implemented abstract domain
 * @template Concrete - Type of an concrete element of the concrete domain for the abstract domain
 * @template Abstract - Type of an abstract element of the abstract domain representing possible elements (excludes `Top` and `Bot`)
 * @template Top      - Type of the Top element of the abstract domain representing all possible elements (defaults to {@link Top})
 * @template Bot      - Type of the Bottom element of the abstract domain representing no possible elements (defaults to {@link Bottom})
 * @template Value    - Type of the abstract elements of the abstract domain (defaults to `Abstract` or `Top` or `Bot`)
 */
export interface AbstractDomain<Concrete, Abstract, Top, Bot, Value extends Abstract | Top | Bot = Abstract | Top | Bot>
extends Lattice<Abstract, Top, Bot, Value> {
	/**
	 * Widens the current abstract value with another abstract value as a sound over-approximation of the join (least upper bound) for fixpoint iteration acceleration.
	 */
	widen(other: this): this;

	/**
	 * Narrows the current abstract value with another abstract value as a sound over-approximation of the meet (greatest lower bound) to refine the value after widening.
	 */
	narrow(other: this): this;

	/**
	 * Maps the current abstract value into a set of possible concrete values as concretization function of the abstract domain.
	 * The result should be `Top` if the number of concrete values would reach the `limit` or the resulting set would have infinite many elements.
	 */
	concretize(limit?: number): ReadonlySet<Concrete> | typeof Top;

	/**
	 * Maps a set of possible concrete values into an abstract value as abstraction function of the abstract domain (should additionally be provided as static function).
	 */
	abstract(concrete: ReadonlySet<Concrete> | typeof Top): this;
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
		return '⊤';
	} else if(value === Bottom) {
		return '⊥';
	}
	return JSON.stringify(value);
}

export function isAbstractDomain(value: unknown): value is AnyAbstractDomain {
	if(typeof value !== 'object' || value === null) {
		return false;
	}
	return ['value', 'top', 'bottom', 'leq', 'join', 'meet', 'widen', 'narrow', 'concretize', 'abstract'].every(property => property in value);
}
