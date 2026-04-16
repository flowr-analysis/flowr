import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom, BottomSymbol, Top } from '../domains/lattice';
import { AbstractDomain } from '../domains/abstract-domain';
import { isNotUndefined } from '../../util/assert';
import { setEquals } from '../../util/collections/set';

/** The type of the actual values of the upper bounds domain as mapping from NodeId to all NodeIds that are greater or equal */
type UpperBoundsValue = ReadonlyMap<NodeId, ReadonlySet<NodeId>>;
/** The type of the Top element of the upper bounds domain as empty mapping from NodeId to NodeIds */
type UpperBoundsTop = ReadonlyMap<NodeId, never>;
/** The type of the Bottom element of the upper bounds domain as {@link Bottom} symbol */
type UpperBoundsBottom = typeof Bottom;
/** The type of the abstract values of the upper bounds domain that are Top, Bottom, or actual values */
type UpperBoundsLift = UpperBoundsValue | UpperBoundsBottom;

/**
 * A weakly relational abstract domain that maps NodeIds to a set of all NodeIds that are associated with greater or equal values.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element as empty mapping.
 * @template Value - Type of the abstract elements of the abstract domain (extends the UpperBoundsLift)
 */
export class UpperBoundsDomain<Value extends UpperBoundsLift = UpperBoundsLift> extends AbstractDomain<ReadonlyMap<NodeId, number>, UpperBoundsValue, UpperBoundsTop, UpperBoundsBottom, Value> {
	constructor(value: Value) {
		if(value === Bottom) {
			super(Bottom as Value);
		} else {
			super(new Map(value.entries().map(([key, value]) => [key, new Set(value)])) as UpperBoundsValue as Value);
		}
	}

	public create(value: Value): this;
	public create(value: Value): UpperBoundsDomain {
		return new UpperBoundsDomain(value);
	}

	public static top(): UpperBoundsDomain<UpperBoundsTop> {
		return new UpperBoundsDomain(new Map<NodeId, never>());
	}

	public static bottom(): UpperBoundsDomain<UpperBoundsBottom> {
		return new UpperBoundsDomain(Bottom);
	}

	public top(): this & UpperBoundsDomain<UpperBoundsTop>;
	public top(): UpperBoundsDomain<UpperBoundsTop> {
		return UpperBoundsDomain.top();
	}

	public bottom(): this & UpperBoundsDomain<UpperBoundsBottom>;
	public bottom(): UpperBoundsDomain<UpperBoundsBottom> {
		return UpperBoundsDomain.bottom();
	}

	public equals(other: this): boolean {
		if(this.value === other.value){
			return true;
		} else if(this.value === Bottom || other.value === Bottom) {
			return false;
		}

		const allKeys = new Set<NodeId>([...this.value.keys(), ...other.value.keys()]);
		for(const key of allKeys){
			if(!setEquals(new Set([key]).union(this.value.get(key) ?? new Set()), new Set([key]).union(other.value.get(key) ?? new Set()))) {
				return false;
			}
		}

		return true;
	}

	public leq(other: this): boolean {
		if(this.value === Bottom){
			return true;
		} else if(other.value === Bottom){
			return false;
		}

		for(const [key, value] of other.value.entries()) {
			if(!value.isSubsetOf(new Set<NodeId>([key]).union(this.value.get(key) ?? new Set()))) {
				return false;
			}
		}
		return true;
	}

	public join(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		const result = this.create(this.value) as this & UpperBoundsDomain<UpperBoundsValue>;

		for(const key of result.value.keys()) {
			if(!other.value.has(key)) {
				(result.value as Map<NodeId, ReadonlySet<NodeId>>).delete(key);
			}
		}
		for(const [key, value] of other.value.entries()) {
			const currValue = result.value.get(key);

			if(currValue !== undefined) {
				(result.value as Map<NodeId, ReadonlySet<NodeId>>).set(key, currValue.intersection(value));
			}
		}
		return result;
	}

	public meet(other: this): this {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		const result = this.create(this.value) as this & UpperBoundsDomain<UpperBoundsValue>;

		for(const [key, value] of other.value.entries()) {
			const currValue = result.value.get(key);

			if(currValue === undefined) {
				(result.value as Map<NodeId, ReadonlySet<NodeId>>).set(key, value);
			} else {
				(result.value as Map<NodeId, ReadonlySet<NodeId>>).set(key, currValue.union(value));
			}
		}
		return result;
	}

	public widen(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		const result = this.top() as this & UpperBoundsDomain<UpperBoundsValue>;
		const allKeys = new Set<NodeId>([...this.value.keys(), ...other.value.keys()]);

		for(const key of allKeys.values()) {
			const thisValue = this.value.get(key);
			const otherValue = other.value.get(key);

			if(thisValue !== undefined && otherValue !== undefined && otherValue.isSubsetOf(thisValue.union(new Set([key])))) {
				(result.value as Map<NodeId, ReadonlySet<NodeId>>).set(key, otherValue);
			}
		}
		return result;
	}

	public narrow(_other: this): this {
		throw new Error('Not Implemented');
	}

	public concretize(_limit: number): ReadonlySet<ReadonlyMap<NodeId, number>> | typeof Top {
		if(this.value === Bottom) {
			return new Set();
		}
		return Top;
	}

	public abstract(concrete: ReadonlySet<ReadonlyMap<NodeId, number>> | typeof Top): this {
		if(concrete === Top) {
			return this.top();
		}
		if(concrete.size === 0){
			return this.bottom();
		}
		const allNodeIds = new Set<NodeId>();
		for(const map of concrete.values()) {
			for(const key of map.keys()) {
				allNodeIds.add(key);
			}
		}
		const result = this.top() as this & UpperBoundsDomain<UpperBoundsValue>;

		for(const nodeIdA of allNodeIds.values()) {
			for(const nodeIdB of allNodeIds.values()) {
				if(nodeIdA === nodeIdB){
					continue;
				}

				if(concrete.values().every(map => {
					const valueA = map.get(nodeIdA);
					const valueB = map.get(nodeIdB);

					return valueA !== undefined && valueB !== undefined && valueA <= valueB;
				})) {
					const currentValue = result.value.get(nodeIdA);
					if(isNotUndefined(currentValue)) {
						(result.value as Map<NodeId, ReadonlySet<NodeId>>).set(nodeIdA, currentValue.union(new Set([nodeIdB])));
					} else {
						(result.value as Map<NodeId, ReadonlySet<NodeId>>).set(nodeIdA, new Set([nodeIdB]));
					}
				}
			}
		}
		return result;
	}

	public toJson(): unknown {
		if(this.value === Bottom){
			return this.value.description;
		}
		return Object.fromEntries(this.value.entries().map(([key, value]) => [key, [...value]]));
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
		}
		return '(' + this.value.entries().map(([key, value]) => `${key} -> {${value.values().map(id => id.toString()).toArray().join(', ')}}`).toArray().join(', ') + ')';
	}

	public isTop(): this is this & UpperBoundsDomain<UpperBoundsTop> {
		return this.value !== Bottom && this.value.entries().every(([key, value]) => value.size === 0 || (value.size === 1 && value.has(key)));
	}

	public isBottom(): this is this & UpperBoundsDomain<UpperBoundsBottom> {
		return this.value == Bottom;
	}

	public isValue(): this is this & UpperBoundsDomain<UpperBoundsValue> {
		return this.value !== Bottom;
	}
}