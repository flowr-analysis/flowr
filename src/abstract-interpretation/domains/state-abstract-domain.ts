import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { AbstractDomain, type AnyAbstractDomain } from './abstract-domain';
import { Bottom } from './lattice';
import type { StateDomain } from './state-domain-like';

/** The type of the actual values of the state abstract domain as map of keys to domain values */
export type StateDomainValue<Domain extends AnyAbstractDomain> = ReadonlyMap<NodeId, Domain>;
/** The type of the Top element of the state abstract domain as (empty) map of keys to domain values */
export type StateDomainTop = ReadonlyMap<NodeId, never>;
/** The type of the Bottom element of the state abstract domain as {@link Bottom} symbol */
export type StateDomainBottom = typeof Bottom;
/** The type of the abstract values of the state abstract domain that are Top, Bottom, or actual values */
export type StateDomainLift<Domain extends AnyAbstractDomain> = StateDomainValue<Domain> | StateDomainBottom;

/**
 * A state abstract domain that maps AST node IDs of a program to abstract values of an abstract domain.
 * The Bottom element is defined as {@link Bottom} symbol and the Top element as empty mapping.
 * @template Domain - Type of the value abstract domain to map the AST node IDs to
 * @see {@link NodeId} for the node IDs of the AST nodes
 */
export class StateAbstractDomain<Domain extends AnyAbstractDomain, Value extends StateDomainLift<Domain> = StateDomainLift<Domain>>
	extends AbstractDomain<StateDomainValue<Domain>, StateDomainTop, StateDomainBottom, Value>
	implements StateDomain<Domain> {

	public readonly domain:           Domain;
	/** Whether mapping a single {@link NodeId} to Bottom collapses the whole state to Bottom or keeps it as a regular entry */
	public readonly collapseOnBottom: boolean;

	constructor(value: Value, domain: Domain, collapseOnBottom = true) {
		if(value === Bottom || (collapseOnBottom && value.values().some(entry => entry.isBottom()))) {
			super(Bottom as Value);
		} else {
			super(new Map(value) as ReadonlyMap<NodeId, Domain> as Value);
		}
		this.domain = domain;
		this.collapseOnBottom = collapseOnBottom;
	}

	public create(value: StateDomainLift<Domain>): this {
		return new StateAbstractDomain(value, this.domain, this.collapseOnBottom) as this;
	}

	public static top<Domain extends AnyAbstractDomain, StateDomain extends StateAbstractDomain<Domain, StateDomainTop>>(this: new (value: StateDomainTop, domain: Domain, collapseOnBottom?: boolean) => StateDomain, domain: Domain, collapseOnBottom = true): StateDomain {
		return new this(new Map<NodeId, never>(), domain, collapseOnBottom);
	}

	public static bottom<Domain extends AnyAbstractDomain, StateDomain extends StateAbstractDomain<Domain, StateDomainBottom>>(this: new (value: StateDomainBottom, domain: Domain, collapseOnBottom?: boolean) => StateDomain, domain: Domain, collapseOnBottom = true): StateDomain {
		return new this(Bottom, domain, collapseOnBottom);
	}

	public get(node: NodeId): Domain | undefined {
		return this.value === Bottom ? this.domain.bottom() : this.value.get(node);
	}

	public has(node: NodeId): boolean {
		return this.value !== Bottom && this.value.has(node);
	}

	public set(node: NodeId, value: Domain): void {
		if(this.value !== Bottom) {
			(this._value as Map<NodeId, Domain>).set(node, value);
		}
	}

	public remove(node: NodeId): void {
		if(this.value !== Bottom) {
			(this._value as Map<NodeId, Domain>).delete(node);
		}
	}

	public top(): this & StateAbstractDomain<Domain, StateDomainTop> {
		return this.create(new Map<NodeId, never>()) as this & StateAbstractDomain<Domain, StateDomainTop>;
	}

	public bottom(): this & StateAbstractDomain<Domain, StateDomainBottom> {
		return this.create(Bottom) as this & StateAbstractDomain<Domain, StateDomainBottom>;
	}

	protected equalsValue(this: StateAbstractDomain<Domain, StateDomainValue<Domain>>, other: StateAbstractDomain<Domain, StateDomainValue<Domain>>): boolean {
		if(this.value.size !== other.value.size) {
			return false;
		}
		for(const [key, currValue] of this.value.entries()) {
			const otherValue = other.get(key);

			if(otherValue === undefined || !currValue.equals(otherValue)) {
				return false;
			}
		}
		return true;
	}

	protected leqValue(this: StateAbstractDomain<Domain, StateDomainValue<Domain>>, other: StateAbstractDomain<Domain, StateDomainValue<Domain>>): boolean {
		if(this.value.size > other.value.size) {
			return false;
		}
		for(const [key, currValue] of this.value.entries()) {
			const otherValue = other.get(key);

			if(otherValue === undefined || !currValue.leq(otherValue)) {
				return false;
			}
		}
		return true;
	}

	protected joinValue(this: this & StateAbstractDomain<Domain, StateDomainValue<Domain>>, other: StateAbstractDomain<Domain, StateDomainValue<Domain>>): this {
		const result = new Map(this.value);

		for(const [key, otherValue] of other.value.entries()) {
			const currValue = result.get(key);

			if(currValue === undefined) {
				result.set(key, otherValue);
			} else {
				result.set(key, currValue.join(otherValue));
			}
		}
		return this.create(result);
	}

	protected meetValue(this: this & StateAbstractDomain<Domain, StateDomainValue<Domain>>, other: StateAbstractDomain<Domain, StateDomainValue<Domain>>): this {
		const result = new Map<NodeId, Domain>();

		for(const [key, currValue] of this.value.entries()) {
			const otherValue = other.value.get(key);

			if(otherValue !== undefined) {
				result.set(key, currValue.meet(otherValue));
			}
		}
		return this.create(result);
	}

	protected widenValue(this: this & StateAbstractDomain<Domain, StateDomainValue<Domain>>, other: StateAbstractDomain<Domain, StateDomainValue<Domain>>): this {
		const result = new Map(this.value);

		for(const [key, otherValue] of other.value.entries()) {
			const currValue = result.get(key);

			if(currValue === undefined) {
				result.set(key, otherValue);
			} else {
				result.set(key, currValue.widen(otherValue));
			}
		}
		return this.create(result);
	}

	protected narrowValue(this: this & StateAbstractDomain<Domain, StateDomainValue<Domain>>, other: StateAbstractDomain<Domain, StateDomainValue<Domain>>): this {
		const result = new Map<NodeId, Domain>();

		for(const [key, currValue] of this.value.entries()) {
			const otherValue = other.value.get(key);

			if(otherValue !== undefined) {
				result.set(key, currValue.narrow(otherValue));
			}
		}
		return this.create(result);
	}

	protected jsonify(this: StateAbstractDomain<Domain, StateDomainValue<Domain>>): unknown {
		return Object.fromEntries(this.value.entries().map(([key, value]) => [key, value.toJSON()]));
	}

	protected stringify(this: StateAbstractDomain<Domain, StateDomainValue<Domain>>): string {
		return '(' + this.value.entries().toArray().map(([key, value]) => `${key} -> ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is this & StateAbstractDomain<Domain, StateDomainTop> {
		return this.value !== Bottom && this.value.size === 0;
	}

	public isBottom(): this is this & StateAbstractDomain<Domain, StateDomainBottom> {
		return this.value === Bottom;
	}

	public isValue(): this is this & StateAbstractDomain<Domain, StateDomainValue<Domain>> {
		return this.value !== Bottom;
	}

	public hasBottomValue(): boolean {
		return this.value === Bottom || this.value.values().some(entry => entry.isBottom());
	}
}
