import { AbstractDomain, domainElementToString, type AnyAbstractDomain, type ConcreteDomain } from './abstract-domain';
import { Top } from './lattice';

/** The type of the concrete mapping of the concrete domain of a mapped abstract domain mapping keys to a concrete value in the concrete domain */
export type ConcreteMap<Key, Domain extends AnyAbstractDomain> = ReadonlyMap<Key, ConcreteDomain<Domain>>;

/**
 * A mapped abstract domain as mapping of keys to abstract values of an abstract domain.
 * The Bottom element is defined as empty mapping and the Top element is defined as mapping every existing key to Top.
 * @template Key       - Type of the keys of the mapping to abstract values
 * @template Domain    - Type of the abstract domain to map the keys to
 */
export class MappedAbstractDomain<Key, Domain extends AnyAbstractDomain>
	extends AbstractDomain<ConcreteMap<Key, Domain>, ReadonlyMap<Key, Domain>, ReadonlyMap<Key, Domain>, ReadonlyMap<Key, Domain>> {

	constructor(value: ReadonlyMap<Key, Domain>) {
		super(new Map(value));
	}

	public create(value: ReadonlyMap<Key, Domain>): this;
	public create(value: ReadonlyMap<Key, Domain>): MappedAbstractDomain<Key, Domain> {
		return new MappedAbstractDomain(value);
	}

	public get(key: Key): Domain | undefined {
		return this._value.get(key);
	}

	public has(key: Key): boolean {
		return this._value.has(key);
	}

	protected set(key: Key, value: Domain): void {
		(this._value as Map<Key, Domain>).set(key, value);
	}

	protected remove(key: Key): void {
		(this._value as Map<Key, Domain>).delete(key);
	}

	public bottom(): this {
		return this.create(new Map());
	}

	public top(): this {
		const result = this.create(this.value);

		for(const [key, value] of result.value) {
			result.set(key, value.top());
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

	public join(other: this): this {
		const result = this.create(this.value);

		for(const [key, value] of other.value) {
			const currValue = result.get(key);

			if(currValue === undefined) {
				result.set(key, value);
			} else {
				result.set(key, currValue.join(value));
			}
		}
		return result;
	}

	public meet(other: this): this {
		const result = this.create(this.value);

		for(const [key] of result.value) {
			if(!other.has(key)) {
				result.remove(key);
			}
		}
		for(const [key, value] of other.value) {
			const currValue = result.get(key);

			if(currValue !== undefined) {
				result.set(key, currValue.meet(value));
			}
		}
		return result;
	}

	public widen(other: this): this {
		const result = this.create(this.value);

		for(const [key, value] of other.value) {
			const currValue = result.get(key);

			if(currValue === undefined) {
				result.set(key, value);
			} else {
				result.set(key, currValue.widen(value));
			}
		}
		return result;
	}

	public narrow(other: this): this {
		const result = this.create(this.value);

		for(const [key] of this.value) {
			if(!other.has(key)) {
				result.remove(key);
			}
		}
		for(const [key, value] of other.value) {
			const currValue = result.get(key);

			if(currValue !== undefined) {
				result.set(key, currValue.narrow(value));
			}
		}
		return result;
	}

	public concretize(limit: number): ReadonlySet<ConcreteMap<Key, Domain>> | typeof Top {
		if(this.value.size === 0) {
			return new Set();
		}
		let mappings = new Set<ConcreteMap<Key, Domain>>([new Map()]);

		for(const [key, value] of this.value) {
			const concreteValues = value.concretize(limit);

			if(concreteValues === Top) {
				return Top;
			}
			const newMappings = new Set<ConcreteMap<Key, Domain>>();

			for(const state of mappings) {
				for(const concrete of concreteValues) {
					if(newMappings.size > limit) {
						return Top;
					}
					const map = new Map(state);
					map.set(key, concrete as ConcreteDomain<Domain>);
					newMappings.add(map);
				}
			}
			mappings = newMappings;
		}
		return mappings;
	}

	public abstract(concrete: ReadonlySet<ConcreteMap<Key, Domain>> | typeof Top): this {
		if(concrete === Top) {
			return this.top();
		} else if(concrete.size === 0) {
			return this.bottom();
		}
		const domain = this.value.values().toArray()[0];

		if(domain === undefined) {
			return this.top();
		}
		const mapping = new Map<Key, Set<ConcreteDomain<Domain>>>();

		for(const concreteMapping of concrete) {
			for(const [key, value] of concreteMapping) {
				const set = mapping.get(key);

				if(set === undefined) {
					mapping.set(key, new Set([value]));
				} else {
					set.add(value);
				}
			}
		}
		const result = new Map<Key, Domain>();

		for(const [key, values] of mapping) {
			result.set(key, domain.abstract(values));
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
		return this.value.values().some(entry => entry.isTop());
	}

	public isBottom(): this is this {
		return this.value.size === 0;
	}

	public isValue(): this is this {
		return true;
	}
}

/**
 * A mutable version of the {@link MappedAbstractDomain} with {@link MutableMappedAbstractDomain#set|`set`} and {@link MutableMappedAbstractDomain#remove|`remove`}.
 */
export class MutableMappedAbstractDomain<Key, Domain extends AnyAbstractDomain> extends MappedAbstractDomain<Key, Domain> {
	public create(value: ReadonlyMap<Key, Domain>): this;
	public create(value: ReadonlyMap<Key, Domain>): MutableMappedAbstractDomain<Key, Domain> {
		return new MutableMappedAbstractDomain(value);
	}

	public set(key: Key, value: Domain): void {
		super.set(key, value);
	}

	public remove(key: Key): void {
		super.remove(key);
	}
}
