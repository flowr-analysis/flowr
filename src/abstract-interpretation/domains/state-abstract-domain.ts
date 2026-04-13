import type { Writable } from 'ts-essentials';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { AbstractDomain, type AnyAbstractDomain, type ConcreteDomain, domainElementToString } from './abstract-domain';
import { Bottom, BottomSymbol, Top } from './lattice';

/** The type of the concrete state of the concrete domain of a state abstract domain that maps keys to a concrete value in the concrete domain */
export type ConcreteState<Domain extends AnyAbstractDomain> = ReadonlyMap<NodeId, ConcreteDomain<Domain>>;

/** The type of the actual values of the state abstract domain as map of keys to domain values */
type StateDomainValue<Domain extends AnyAbstractDomain> = ReadonlyMap<NodeId, Domain>;
/** The type of the Top element of the state abstract domain as (empty) map of keys to domain values */
type StateDomainTop = ReadonlyMap<NodeId, never>;
/** The type of the Bottom element of the state abstract domain as {@link Bottom} symbol */
type StateDomainBottom = typeof Bottom;
/** The type of the abstract values of the state abstract domain that are Top, Bottom, or actual values */
type StateDomainLift<Domain extends AnyAbstractDomain> = StateDomainValue<Domain> | StateDomainBottom;

/**
 * A state abstract domain that maps AST node IDs of a program to abstract values of an abstract domain.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element as empty mapping.
 * @template Domain - Type of the value abstract domain to map the AST node IDs to
 * @see {@link NodeId} for the node IDs of the AST nodes
 */
export class StateAbstractDomain<Domain extends AnyAbstractDomain, Value extends StateDomainLift<Domain> = StateDomainLift<Domain>>
	extends AbstractDomain<ConcreteState<Domain>, StateDomainValue<Domain>, StateDomainTop, StateDomainBottom, Value> {

	protected domain: Domain;

	constructor(value: Value, domain: Domain) {
		if(value === Bottom || value.values().some(entry => entry.isBottom())) {
			super(Bottom as Value);
		} else {
			super(new Map(value) as ReadonlyMap<NodeId, Domain> as Value);
		}
		this.domain = domain;
	}

	public create(value: StateDomainLift<Domain>): this;
	public create(value: StateDomainLift<Domain>): StateAbstractDomain<Domain> {
		return new StateAbstractDomain(value, this.domain);
	}

	public static top<Domain extends AnyAbstractDomain>(domain: Domain): StateAbstractDomain<Domain, StateDomainTop> {
		return new StateAbstractDomain(new Map<NodeId, never>(), domain);
	}

	public static bottom<Domain extends AnyAbstractDomain>(domain: Domain): StateAbstractDomain<Domain, StateDomainBottom> {
		return new StateAbstractDomain(Bottom, domain);
	}

	public get(key: NodeId): Domain | undefined {
		return this.value === Bottom ? this.domain.bottom() : this.value.get(key);
	}

	public has(key: NodeId): boolean {
		return this.value !== Bottom && this.value.has(key);
	}

	protected set(key: NodeId, value: Domain): void {
		if(value.isBottom()) {
			(this._value as Writable<StateDomainLift<Domain>>) = Bottom;
		}
		if(this._value !== Bottom) {
			(this._value as Map<NodeId, Domain>).set(key, value);
		}
	}

	protected remove(key: NodeId): void {
		if(this.value !== Bottom) {
			(this._value as Map<NodeId, Domain>).delete(key);
		}
	}

	public top(): this & StateAbstractDomain<Domain, StateDomainTop>;
	public top(): StateAbstractDomain<Domain, StateDomainTop> {
		return StateAbstractDomain.top(this.domain);
	}

	public bottom(): this & StateAbstractDomain<Domain, StateDomainBottom>;
	public bottom(): StateAbstractDomain<Domain, StateDomainBottom> {
		return StateAbstractDomain.bottom(this.domain);
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value === Bottom || other.value === Bottom || this.value.size !== other.value.size) {
			return false;
		}

		for(const [key, value] of this.value.entries()) {
			const otherValue = other.get(key);

			if(otherValue === undefined || !value.equals(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public leq(other: this): boolean {
		if(this.value === other.value || this.value === Bottom) {
			return true;
		} else if(other.value === Bottom || this.value.size > other.value.size) {
			return false;
		}
		for(const [key, value] of this.value.entries()) {
			const otherValue = other.get(key);

			if(otherValue === undefined || !value.leq(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public join(other: this): this {
		if(this.value === Bottom){
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		const result = this.create(this.value) as this & StateAbstractDomain<Domain, StateDomainValue<Domain>>;

		for(const [key, value] of other.value.entries()) {
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
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		const result = this.create(this.value) as this & StateAbstractDomain<Domain, StateDomainValue<Domain>>;

		for(const key of result.value.keys()) {
			if(!other.has(key)) {
				result.remove(key);
			}
		}
		for(const [key, value] of other.value.entries()) {
			const currValue = result.get(key);

			if(currValue !== undefined) {
				result.set(key, currValue.meet(value));
			}
		}
		return result;
	}

	public widen(other: this): this {
		if(this.value === Bottom){
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		const result = this.create(this.value) as this & StateAbstractDomain<Domain, StateDomainValue<Domain>>;

		for(const [key, value] of other.value.entries()) {
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
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		const result = this.create(this.value) as this & StateAbstractDomain<Domain, StateDomainValue<Domain>>;

		for(const key of result.value.keys()) {
			if(!other.has(key)) {
				result.remove(key);
			}
		}
		for(const [key, value] of other.value.entries()) {
			const currValue = result.get(key);

			if(currValue !== undefined) {
				result.set(key, currValue.narrow(value));
			}
		}
		return result;
	}

	public concretize(limit: number): ReadonlySet<ConcreteState<Domain>> | typeof Top {
		if(this.value === Bottom) {
			return new Set();
		}
		let mappings = new Set<ConcreteState<Domain>>([new Map()]);

		for(const [key, value] of this.value.entries()) {
			const concreteValues = value.concretize(limit);

			if(concreteValues === Top) {
				return Top;
			}
			const newMappings = new Set<ConcreteState<Domain>>();

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

	public abstract(concrete: ReadonlySet<ConcreteState<Domain>> | typeof Top): this {
		if(concrete === Top) {
			return this.top();
		} else if(concrete.size === 0) {
			return this.bottom();
		}
		const mapping = new Map<NodeId, Set<ConcreteDomain<Domain>>>();

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
		const result = new Map<NodeId, Domain>();

		for(const [key, values] of mapping) {
			result.set(key, this.domain.abstract(values));
		}
		return this.create(result);
	}

	public toJson(): unknown {
		if(this.value === Bottom) {
			return this.value.description;
		}
		return Object.fromEntries(this.value.entries().map(([key, value]) => [key, value.toJson()]));
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
		}
		return '(' + this.value.entries().toArray().map(([key, value]) => `${domainElementToString(key)} -> ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is this & StateAbstractDomain<Domain, StateDomainTop> {
		return this.value !== Bottom && this.value.size === 0;
	}

	public isBottom(): this is this & StateAbstractDomain<Domain, StateDomainBottom> {
		return this.value == Bottom;
	}

	public isValue(): this is this & StateAbstractDomain<Domain, StateDomainValue<Domain>> {
		return this.value !== Bottom;
	}
}

/**
 * A mutable version of the {@link StateAbstractDomain} with {@link MutableStateAbstractDomain#set|`set`} and {@link MutableStateAbstractDomain#remove|`remove`}.
 */
export class MutableStateAbstractDomain<Domain extends AnyAbstractDomain, Value extends StateDomainLift<Domain> = StateDomainLift<Domain>>
	extends StateAbstractDomain<Domain, Value> {

	public create(value: StateDomainLift<Domain>): this;
	public create(value: StateDomainLift<Domain>): MutableStateAbstractDomain<Domain> {
		return new MutableStateAbstractDomain(value, this.domain);
	}

	public static top<Domain extends AnyAbstractDomain>(domain: Domain): MutableStateAbstractDomain<Domain, StateDomainTop> {
		return new MutableStateAbstractDomain(new Map<NodeId, never>(), domain);
	}

	public static bottom<Domain extends AnyAbstractDomain>(domain: Domain): MutableStateAbstractDomain<Domain, StateDomainBottom> {
		return new MutableStateAbstractDomain(Bottom, domain);
	}

	public set(key: NodeId, value: Domain): void {
		super.set(key, value);
	}

	public remove(key: NodeId): void {
		super.remove(key);
	}
}

/**
 * The type of the value abstract domain of a state abstract domain (i.e. the abstract domain a state abstract domain maps to).
 * @template StateDomain - The state abstract domain to get the value abstract domain type for
 */
export type ValueAbstractDomain<StateDomain extends StateAbstractDomain<AnyAbstractDomain>> =
	StateDomain extends StateAbstractDomain<infer Domain> ? Domain : never;
