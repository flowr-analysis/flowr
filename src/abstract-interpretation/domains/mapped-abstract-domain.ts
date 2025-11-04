import type { AbstractDomain, AnyAbstractDomain, ConcreteDomain } from './abstract-domain';
import { domainElementToString } from './abstract-domain';
import { Top } from './lattice';

/** The type of the concrete mapping of the concrete domain of a mapped abstract domain mapping keys to a concrete value in the concrete domain */
type ConcreteMap<Key, Domain extends AnyAbstractDomain> = ReadonlyMap<Key, ConcreteDomain<Domain>>;

/**
 * A mapped abstract domain as mapping of keys to abstract values of an abstract domain.
 * The Bottom element is defined as empty mapping and the Top element is defined as mapping every existing key to Top.
 * @template Key       - Type of the keys of the mapping to abstract values
 * @template Domain    - Type of the abstract domain to map the keys to
 */
export abstract class MappedAbstractDomain<Key, Domain extends AnyAbstractDomain>
implements AbstractDomain<ConcreteMap<Key, Domain>, ReadonlyMap<Key, Domain>, ReadonlyMap<Key, Domain>, ReadonlyMap<Key, Domain>> {
	private readonly _value: Map<Key, Domain>;

	constructor(value: ReadonlyMap<Key, Domain>) {
		this._value = new Map(value);
	}

	public abstract create(value: ReadonlyMap<Key, Domain>): this;

	public get value(): ReadonlyMap<Key, Domain> {
		return this._value;
	}

	public get(key: Key): Domain | undefined {
		return this._value.get(key);
	}

	public has(key: Key): boolean {
		return this._value.has(key);
	}

	public set(key: Key, value: Domain): void {
		this._value.set(key, value);
	}

	public bottom(): this {
		return this.create(new Map<Key, Domain>());
	}

	public top(): this {
		const result = this.create(this.value);

		for(const [key, value] of result.value) {
			result._value.set(key, value.top() as Domain);
		}
		return result;
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value.size !== other.value.size) {
			return false;
		}
		for(const [key, value] of this.value) {
			const otherValue = other.get(key);

			if(otherValue === undefined || !value.equals(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public leq(other: this): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value.size > other.value.size) {
			return false;
		}
		for(const [key, value] of this.value) {
			const otherValue = other.get(key);

			if(otherValue === undefined || !value.leq(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public join(...values: readonly this[]): this {
		const result = this.create(this.value);

		for(const other of values) {
			for(const [key, value] of other.value) {
				const currValue = result.get(key);

				if(currValue === undefined) {
					result._value.set(key, value);
				} else {
					result._value.set(key, currValue.join(value));
				}
			}
		}
		return result;
	}

	public meet(...values: readonly this[]): this {
		const result = this.create(this.value);

		for(const other of values) {
			for(const [key] of result.value) {
				if(!other.has(key)) {
					result._value.delete(key);
				}
			}
			for(const [key, value] of other.value) {
				const currValue = result.get(key);

				if(currValue !== undefined) {
					result._value.set(key, currValue.meet(value));
				}
			}
		}
		return result;
	}

	public widen(other: this): this {
		const result = this.create(this.value);

		for(const [key, value] of other.value) {
			const currValue = result.get(key);

			if(currValue === undefined) {
				result._value.set(key, value);
			} else {
				result._value.set(key, currValue.widen(value));
			}
		}
		return result;
	}

	public narrow(other: this): this {
		const result = this.create(this.value);

		for(const [key] of this.value) {
			if(!other.has(key)) {
				result._value.delete(key);
			}
		}
		for(const [key, value] of other.value) {
			const currValue = result.get(key);

			if(currValue !== undefined) {
				result._value.set(key, currValue.narrow(value));
			}
		}
		return result;
	}

	public concretize(limit: number): ReadonlySet<ConcreteMap<Key, Domain>> | typeof Top {
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

	public abstract(concrete: ReadonlySet<ConcreteMap<Key, Domain>> | typeof Top): this {
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
			result.set(key, entry.abstract(values));
		}
		return this.create(result);
	}

	public toJson(): unknown {
		return Object.fromEntries(this.value.entries().map(([key, value]) => [key, value.toJson()]));
	}

	public toString(): string {
		return '(' + this.value.entries().toArray().map(([key, value]) => `${domainElementToString(key)} -> ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is this {
		return this.value.size > 0 && this.value.values().every(value => value.isTop());
	}

	public isBottom(): this is this {
		return this.value.size === 0;
	}

	public isValue(): this is this {
		return true;
	}
}
