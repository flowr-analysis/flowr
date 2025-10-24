import type { AbstractDomain, AnyAbstractDomain, ConcreteDomain } from './abstract-domain';
import { DEFAULT_INFERENCE_LIMIT, domainElementToString } from './abstract-domain';
import { Top } from './lattice';

/** The type of the concrete mapping of the concrete domain of a mapped abstract domain mapping keys to a concrete value in the concrete domain */
type ConcreteMap<Key, Domain extends AnyAbstractDomain> = ReadonlyMap<Key, ConcreteDomain<Domain>>;

/**
 * A mapped abstract domain as mapping of keys to abstract values of an abstract domain.
 * The Bottom element is defined as empty mapping and the Top element is defined as mapping every existing key to Top.
 * @template MapDomain - Type of the implemented mapped abstract domain
 * @template Key       - Type of the keys of the mapping to abstract values
 * @template Domain    - Type of the abstract domain to map the keys to
 */
export abstract class MappedAbstractDomain<MapDomain extends MappedAbstractDomain<MapDomain, Key, Domain>, Key, Domain extends AnyAbstractDomain>
implements AbstractDomain<MapDomain, ConcreteMap<Key, Domain>, Map<Key, Domain>, Map<Key, Domain>, Map<Key, Domain>> {
	private readonly _value: Map<Key, Domain>;

	constructor(value: ReadonlyMap<Key, Domain>) {
		this._value = new Map(value);
	}

	public abstract create(value: ReadonlyMap<Key, Domain>): MapDomain;

	public get value(): Map<Key, Domain> {
		return this._value;
	}

	public bottom(): MapDomain {
		return this.create(new Map<Key, Domain>());
	}

	public top(): MapDomain {
		const result = this.create(this.value);

		for(const [key, value] of result.value) {
			result._value.set(key, value.top() as Domain);
		}
		return result;
	}

	public equals(other: MapDomain): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value.size !== other.value.size) {
			return false;
		}
		for(const [key, value] of this.value) {
			const otherValue = other.value.get(key);

			if(otherValue === undefined || !value.equals(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public leq(other: MapDomain): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value.size > other.value.size) {
			return false;
		}
		for(const [key, value] of this.value) {
			const otherValue = other.value.get(key);

			if(otherValue === undefined || !value.leq(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public join(...values: MapDomain[]): MapDomain {
		const result = this.create(this.value);

		for(const other of values) {
			for(const [key, value] of other.value) {
				const currValue = result.value.get(key);

				if(currValue === undefined) {
					result.value.set(key, value);
				} else {
					result.value.set(key, currValue.join(value) as Domain);
				}
			}
		}
		return result;
	}

	public meet(...values: MapDomain[]): MapDomain {
		const result = this.create(this.value);

		for(const other of values) {
			for(const [key] of result.value) {
				if(!other.value.has(key)) {
					result.value.delete(key);
				}
			}
			for(const [key, value] of other.value) {
				const currValue = result.value.get(key);

				if(currValue !== undefined) {
					result.value.set(key, currValue.meet(value) as Domain);
				}
			}
		}
		return result;
	}

	public widen(other: MapDomain): MapDomain {
		const result = this.create(this.value);

		for(const [key, value] of other.value) {
			const currValue = result.value.get(key);

			if(currValue === undefined) {
				result.value.set(key, value);
			} else {
				result.value.set(key, currValue.widen(value) as Domain);
			}
		}
		return result;
	}

	public narrow(other: MapDomain): MapDomain {
		const result = this.create(this.value);

		for(const [key] of this.value) {
			if(!other.value.has(key)) {
				result.value.delete(key);
			}
		}
		for(const [key, value] of other.value) {
			const currValue = result.value.get(key);

			if(currValue !== undefined) {
				result.value.set(key, currValue.narrow(value) as Domain);
			}
		}
		return result;
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<ConcreteMap<Key, Domain>> | typeof Top {
		if(this.value.values().some(value => value.isBottom())) {
			return new Set();
		}
		let states = new Set<ConcreteMap<Key, Domain>>([new Map()]);

		for(const [key, value] of this.value) {
			const concreteValues = value.concretize(limit);

			if(concreteValues === Top) {
				return Top;
			}
			const newStates = new Set<ConcreteMap<Key, Domain>>();

			for(const state of states) {
				for(const concrete of concreteValues) {
					if(newStates.size > limit) {
						return Top;
					}
					const map = new Map(state);
					map.set(key, concrete as ConcreteDomain<Domain>);
					newStates.add(map);
				}
			}
			states = newStates;
		}
		return states;
	}

	public abstract(concrete: ReadonlySet<ConcreteMap<Key, Domain>> | typeof Top): MapDomain {
		const entry = [...this.value.values()][0];

		if(concrete === Top || entry === undefined) {
			return this.create(new Map<Key, Domain>());
		}
		const mappings = new Map<Key, Set<ConcreteDomain<Domain>>>();

		for(const state of concrete) {
			for(const [key, value] of state) {
				const mapping = mappings.get(key);

				if(mapping === undefined) {
					mappings.set(key, new Set([value]));
				} else {
					mapping.add(value);
				}
			}
		}
		const result = new Map<Key, Domain>();

		for(const [key, values] of mappings) {
			result.set(key, entry.abstract(values) as Domain);
		}
		return this.create(result);
	}

	public toString(): string {
		return '(' + this.value.entries().toArray().map(([key, value]) => `${domainElementToString(key)} -> ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is MapDomain {
		return this.value.size > 0 && this.value.values().every(value => value.isTop());
	}

	public isBottom(): this is MapDomain {
		return this.value.size === 0;
	}

	public isValue(): this is MapDomain {
		return true;
	}
}
