import { setEquals } from '../../util/collections/set';
import { DEFAULT_INFERENCE_LIMIT, type AbstractDomain } from './abstract-domain';
import { Top } from './lattice';

type SetRangeValue<T> = { min: ReadonlySet<T>, range: ReadonlySet<T> | typeof Top };
type SetRangeTop = { min: ReadonlySet<never>, range: typeof Top};
type SetRangeBottom = { min: ReadonlySet<never>, range: ReadonlySet<never>};
type SetRangeLift<T> = SetRangeValue<T> | SetRangeTop | SetRangeBottom;

type SetRangeLimit = { min: number, range: number };
const DefaultLimit = { min: DEFAULT_INFERENCE_LIMIT, range: DEFAULT_INFERENCE_LIMIT };

export class SetRangeDomain<T, Value extends SetRangeLift<T> = SetRangeLift<T>>
implements AbstractDomain<ReadonlySet<T>, SetRangeValue<T>, SetRangeTop, SetRangeBottom, Value> {
	private readonly limit: SetRangeLimit;
	private _value:         Value;

	constructor(value: Value, limit: SetRangeLimit = DefaultLimit) {
		const min = new Set([...value.min].slice(0, limit.min));
		const range = (value.range === Top || value.range.size > limit.range) ? Top : new Set(value.range);

		this._value = { min, range } as SetRangeLift<T> as Value;
		this.limit = limit;
	}

	public get value(): Value {
		return this._value;
	}

	public get min(): ReadonlySet<T> {
		return this.value.min;
	}

	public get max(): ReadonlySet<T> | typeof Top {
		return this.value.range === Top ? Top : this.value.min.union(this.value.range);
	}

	public static top<T>(limit?: SetRangeLimit): SetRangeDomain<T, SetRangeTop> {
		return new SetRangeDomain({ min: new Set(), range: Top }, limit);
	}

	public static bottom<T>(limit?: SetRangeLimit): SetRangeDomain<T, SetRangeBottom> {
		return new SetRangeDomain({ min: new Set(), range: new Set() }, limit);
	}

	public static abstract<T>(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top, limit?: SetRangeLimit): SetRangeDomain<T> {
		if(concrete === Top) {
			return SetRangeDomain.top(limit);
		}
		const min = concrete.values().reduce((result, set) => result.intersection(set), new Set());
		const max = concrete.values().reduce((result, set) => result.union(set), new Set());

		return new SetRangeDomain({ min: min, range: max.difference(min) }, limit);
	}

	public top(): SetRangeDomain<T, SetRangeTop> {
		return SetRangeDomain.top(this.limit);
	}

	public bottom(): SetRangeDomain<T, SetRangeBottom> {
		return SetRangeDomain.bottom(this.limit);
	}

	public equals(other: SetRangeDomain<T>): boolean {
		if(this.value === other.value) {
			return true;
		} else if(!setEquals(this.value.min, other.value.min)) {
			return false;
		} else if(this.value.range === other.value.range) {
			return true;
		}
		return this.value.range !== Top && other.value.range !== Top && setEquals(this.value.range, other.value.range);
	}

	public leq(other: SetRangeDomain<T>): boolean {
		if(!other.min.isSubsetOf(this.min)) {
			return false;
		} else if(other.max === Top) {
			return true;
		}
		return this.max !== Top && this.max.isSubsetOf(other.max);
	}

	public join(...values: SetRangeDomain<T>[]): SetRangeDomain<T> {
		const result = new SetRangeDomain<T>(this.value, this.limit);

		for(const other of values) {
			const minJoin = result.value.min.intersection(other.value.min);
			let rangeJoin;

			if(result.value.range === Top || other.value.range === Top) {
				rangeJoin = Top;
			} else {
				rangeJoin = result.value.range.union(other.value.range);
			}
			result._value = this.limitValue({ min: minJoin, range: rangeJoin });
		}
		return result;
	}

	public meet(...values: SetRangeDomain<T>[]): SetRangeDomain<T> {
		const result = new SetRangeDomain<T>(this.value, this.limit);

		for(const other of values) {
			const minMeet = result.value.min.union(other.value.min);
			let rangeMeet;

			if(result.value.range === Top) {
				rangeMeet = other.value.range;
			} else if(other.value.range === Top) {
				rangeMeet = result.value.range;
			} else {
				rangeMeet = result.value.range.intersection(other.value.range);
			}
			result._value = this.limitValue({ min: minMeet, range: rangeMeet });
		}
		return result;
	}

	public subtract(other: SetRangeDomain<T>): SetRangeDomain<T> {
		let minSub;

		if(other.max === Top) {
			minSub = new Set<never>();
		} else {
			minSub = this.min.difference(other.max);
		}
		let rangeSub;

		if(this.value.range === Top) {
			rangeSub = Top;
		} else if(other.max === Top) {
			rangeSub = this.value.range.difference(other.min);
		} else {
			rangeSub = this.value.range.difference(other.max);
		}
		return new SetRangeDomain(this.limitValue({ min: minSub, range: rangeSub }));
	}

	public widen(other: SetRangeDomain<T>): SetRangeDomain<T> {
		let minWiden;

		if(this.min.isSubsetOf(other.min)) {
			minWiden = this.min;
		} else {
			minWiden = new Set<never>();
		}
		let rangeWiden;

		if(this.max !== Top && other.max !== Top && other.max.isSubsetOf(this.max)) {
			rangeWiden = this.value.range;
		} else {
			rangeWiden = Top;
		}
		return new SetRangeDomain(this.limitValue({ min: minWiden, range: rangeWiden }));
	}

	public narrow(other: SetRangeDomain<T>): SetRangeDomain<T> {
		const minWiden = this.min.size === 0 ? other.min : this.min;
		const rangeWiden = this.value.range === Top ? other.value.range : this.value.range;

		return new SetRangeDomain(this.limitValue({ min: minWiden, range: rangeWiden }));
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<ReadonlySet<T>> |  typeof Top {
		if(this.value.range === Top || 2**(this.value.range.size) > limit) {
			return Top;
		}
		const subsets = new Set<Set<T>>([new Set()]);

		for(const element of this.value.range) {
			const newSubsets = subsets.values().map(subset => new Set([...subset, element]));

			for(const subset of newSubsets) {
				subsets.add(subset);
			}
		}
		return subsets;
	}

	public abstract(concrete: ReadonlySet<ReadonlySet<T>> | typeof Top): SetRangeDomain<T> {
		return SetRangeDomain.abstract(concrete, this.limit);
	}

	public toString(): string {
		if(this.value.range === Top) {
			return `[{${this.value.min.values().toArray().join(', ')}}, ⊤]`;
		}
		return `[{${this.value.min.values().toArray().join(', ')}}, {${this.value.range.values().toArray().join(', ')}}]`;
	}

	public isTop(): this is SetRangeDomain<T, SetRangeTop> {
		return this.value.min.size === 0 && this.value.range === Top;
	}

	public isBottom(): this is SetRangeDomain<T, SetRangeBottom> {
		return this.value.min.size === 0 && this.value.range !== Top && this.value.range.size === 0;
	}

	public isValue(): this is SetRangeDomain<T, SetRangeValue<T>> {
		return true;
	}

	private limitValue<Value extends SetRangeLift<T>>(value: Value): Value {
		let min = value.min;
		let range = value.range;

		if(min.size > this.limit.min) {
			min = new Set([...value.min].slice(0, this.limit.min));
		}
		if(range === Top || range.size > this.limit.range) {
			range = Top;
		}
		return { min, range } as Value;
	}
}
