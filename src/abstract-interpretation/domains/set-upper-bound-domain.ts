import { assertUnreachable } from '../../util/assert';
import { setEquals } from '../../util/collections/set';
import { Ternary } from '../../util/logic';
import { AbstractDomain, DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from './lattice';
import type { SatisfiableDomain } from './satisfiable-domain';
import { SetComparator } from './satisfiable-domain';
/* eslint-disable @typescript-eslint/unified-signatures */

/** The type of the actual values of the set upper bound domain as set */
type SetUpperBoundValue<T> = ReadonlySet<T>;
/** The type of the Top element of the set upper bound domain as {@link Top} symbol */
type SetUpperBoundTop = typeof Top;
/** The type of the Bottom element of the set upper bound domain as {@link Bottom} symbol */
type SetUpperBoundBottom = typeof Bottom;
/** The type of the abstract values of the set upper bound domain that are Top, Bottom, or actual values */
type SetUpperBoundLift<T> = SetUpperBoundValue<T> | SetUpperBoundTop | SetUpperBoundBottom;

/**
 * The set upper bound abstract domain as sets capturing possible values of the concrete set bounded by a `limit` for the maximum number of inferred values.
 * The Bottom element is defined as the{@link Bottom} and the Top element is defined as {@link Top} symbol.
 * @template T     - Type of the values in the abstract domain
 * @template Value - Type of the constraint in the abstract domain (Top, Bottom, or an actual value)
 */
export class SetUpperBoundDomain<T, Value extends SetUpperBoundLift<T> = SetUpperBoundLift<T>>
	extends AbstractDomain<ReadonlySet<T>, SetUpperBoundValue<T>, SetUpperBoundTop, SetUpperBoundBottom, Value>
	implements SatisfiableDomain<ReadonlySet<T>> {

	public readonly limit:    number;
	private readonly setType: typeof Set<T>;

	/**
	 * @param limit -  A limit for the maximum number of elements to store in the set
	 * @param newSet - An optional set constructor for the domain elements if the type `T` is not storable in a HashSet
	 */
	constructor(value: Value | T[], limit: number = DEFAULT_INFERENCE_LIMIT, setType: typeof Set<T> = Set) {
		if(value !== Top && value !== Bottom) {
			if(Array.isArray(value)) {
				super((value.length > limit ? Top : new setType(value)) as Value);
			} else {
				super((value.size > limit ? Top : new setType(value)) as Value);
			}
		} else {
			super(value);
		}
		this.limit = limit;
		this.setType = setType;
	}

	public create(value: SetUpperBoundLift<T> | T[]): this;
	public create(value: SetUpperBoundLift<T> | T[]): SetUpperBoundDomain<T> {
		return new SetUpperBoundDomain(value, this.limit, this.setType);
	}

	public static top<T>(limit?: number, setType?: typeof Set<T>): SetUpperBoundDomain<T, SetUpperBoundTop> {
		return new SetUpperBoundDomain(Top, limit, setType);
	}

	public static bottom<T>(limit?: number, setType?: typeof Set<T>): SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return new SetUpperBoundDomain(Bottom, limit, setType);
	}

	public static abstract<T>(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top, limit?: number, setType?: typeof Set<T>): SetUpperBoundDomain<T> {
		if(concrete === Top) {
			return SetUpperBoundDomain.top(limit, setType);
		} else if(concrete.size === 0) {
			return SetUpperBoundDomain.bottom(limit, setType);
		}
		return new SetUpperBoundDomain(concrete.values().reduce((result, set) => result.union(set)), limit, setType);
	}

	public top(): this & SetUpperBoundDomain<T, SetUpperBoundTop>;
	public top(): SetUpperBoundDomain<T, SetUpperBoundTop> {
		return SetUpperBoundDomain.top(this.limit, this.setType);
	}

	public bottom(): this & SetUpperBoundDomain<T, SetUpperBoundBottom>;
	public bottom(): SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return SetUpperBoundDomain.bottom(this.limit, this.setType);
	}

	public equals(other: this): boolean {
		return this.value === other.value || (this.isValue() && other.isValue() && setEquals(this.value, other.value));
	}

	public leq(other: this): boolean {
		return this.value === Bottom || other.value === Top || (this.isValue() && other.isValue() && this.value.isSubsetOf(other.value));
	}

	public join(other: this): this;
	public join(other: SetUpperBoundLift<T> | T[]): this;
	public join(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = other instanceof SetUpperBoundDomain ? other.value : Array.isArray(other) ? new this.setType(other) : other;

		if(this.value === Top || otherValue === Top) {
			return this.top();
		} else if(this.value === Bottom) {
			return this.create(otherValue);
		} else if(otherValue === Bottom) {
			return this.create(this.value);
		} else {
			return this.create(this.value.union(otherValue));
		}
	}

	public meet(other: this): this;
	public meet(other: SetUpperBoundLift<T> | T[]): this;
	public meet(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = other instanceof SetUpperBoundDomain ? other.value : Array.isArray(other) ? new this.setType(other) : other;

		if(this.value === Bottom || otherValue === Bottom) {
			return this.bottom();
		} else if(this.value === Top) {
			return this.create(otherValue);
		} else if(otherValue === Top) {
			return this.create(this.value);
		} else {
			return this.create(this.value.intersection(otherValue));
		}
	}

	/**
	 * Subtracts another abstract value from the current abstract value by removing all elements of the other abstract value from the current abstract value.
	 */
	public subtract(other: this | SetUpperBoundLift<T> | T[]): this {
		const otherValue = other instanceof SetUpperBoundDomain ? other.value : Array.isArray(other) ? new this.setType(other) : other;

		if(this.value === Top) {
			return this.top();
		} else if(this.value === Bottom) {
			return this.bottom();
		} else if(otherValue === Top || otherValue === Bottom) {
			return this.create(this.value);
		} else {
			return this.create(this.value.difference(otherValue));
		}
	}

	public widen(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		return other.leq(this) ? this.create(this.value) : this.top();
	}

	public narrow(other: this): this {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		return this.isTop() ? this.create(other.value) : this.create(this.value);
	}

	public concretize(limit: number): ReadonlySet<ReadonlySet<T>> |  typeof Top {
		if(this.value === Bottom) {
			return new Set();
		} else if(this.value === Top || 2**(this.value.size) > limit) {
			return Top;
		}
		const subsets = [new this.setType()];

		for(const element of this.value.values()) {
			const newSubsets = subsets.map(subset => new this.setType([...subset, element]));

			for(const subset of newSubsets) {
				subsets.push(subset);
			}
		}
		return new Set(subsets);
	}

	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): this;
	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): SetUpperBoundDomain<T> {
		return SetUpperBoundDomain.abstract(concrete, this.limit, this.setType);
	}

	public satisfies(set: ReadonlySet<T> | T[], comparator: SetComparator = SetComparator.Equal): Ternary {
		switch(comparator) {
			case SetComparator.Equal:
			case SetComparator.SubsetOrEqual: {
				if(this.isTop() || (this.isValue() && [...set].length <= this.value.size && [...set].every(value => this.value.has(value)))) {
					return Ternary.Maybe;
				}
				return Ternary.Never;
			}
			case SetComparator.Subset: {
				if(this.isTop() || (this.isValue() && [...set].length < this.value.size && [...set].every(value => this.value.has(value)))) {
					return Ternary.Maybe;
				}
				return Ternary.Never;
			}
			default: {
				assertUnreachable(comparator);
			}
		}
	}

	public toJson(): unknown {
		if(this.value === Top || this.value === Bottom) {
			return this.value.description;
		}
		return this.value.values().toArray();
	}

	public toString(): string {
		if(this.value === Top) {
			return TopSymbol;
		} else if(this.value === Bottom) {
			return BottomSymbol;
		}
		const string = this.value.values().map(domainElementToString).toArray().join(', ');

		return `{${string}}`;
	}

	public isTop(): this is SetUpperBoundDomain<T, SetUpperBoundTop> {
		return this.value === Top;
	}

	public isBottom(): this is SetUpperBoundDomain<T, SetUpperBoundBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is SetUpperBoundDomain<T, SetUpperBoundValue<T>> {
		return this.value !== Top && this.value !== Bottom;
	}
}
