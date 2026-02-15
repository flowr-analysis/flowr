import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from './abstract-domain';
import { BottomSymbol, Top, TopSymbol } from './lattice';
import type { ConcreteMap } from './mapped-abstract-domain';
import { MappedAbstractDomain } from './mapped-abstract-domain';
import { Ternary } from '../../util/logic';

/**
 * A state abstract domain as mapping of AST node IDs of a program to abstract values of an abstract domain.
 * The Bottom element is defined as empty mapping and the Top element is defined as mapping every existing mapped AST node ID to Top.
 * @template Domain - Type of the abstract domain to map the AST node IDs to
 * @see {@link NodeId} for the node IDs of the AST nodes
 */
export class StateAbstractDomain<Domain extends AnyAbstractDomain> extends MappedAbstractDomain<NodeId, Domain> {
	protected _isBottom: true | undefined;

	constructor(value: ReadonlyMap<NodeId, Domain>, bottom?: boolean) {
		super(value);

		if(bottom || value.values().some(entry => entry.isBottom())) {
			this._isBottom = true;
		}
	}

	public create(value: ReadonlyMap<NodeId, Domain>, bottom?: boolean): this;
	public create(value: ReadonlyMap<NodeId, Domain>, bottom?: boolean): StateAbstractDomain<Domain> {
		return new StateAbstractDomain(value, bottom ?? this._isBottom);
	}

	public static top<Domain extends AnyAbstractDomain>(): StateAbstractDomain<Domain> {
		return new StateAbstractDomain<Domain>(new Map());
	}

	public get(key: NodeId, ignoreBottom?: boolean): Domain | undefined {
		return this._isBottom && !ignoreBottom ? super.get(key)?.bottom() : super.get(key);
	}

	protected set(key: NodeId, value: Domain): void {
		if(value.isBottom()) {
			this._isBottom = true;
		}
		super.set(key, value);
	}

	public bottom(): this {
		return this.create(this.value, true);
	}

	public top(): this {
		return this.create(new Map());
	}

	public equals(other: this): Ternary {
		if(this._isBottom !== other._isBottom) {
			return Ternary.Never;
		}
		return super.equals(other);
	}

	public leq(other: this): Ternary {
		if(this._isBottom) {
			return Ternary.Always;
		} else if(other._isBottom) {
			return Ternary.Never;
		}
		return super.leq(other);
	}

	public join(other: this): this {
		if(this._isBottom) {
			return other.create(other.value);
		} else if(other._isBottom) {
			return this.create(this.value);
		}
		return super.join(other);
	}

	public meet(other: this): this {
		const result = super.meet(other);
		result._isBottom = this._isBottom || other._isBottom;

		return result;
	}

	public widen(other: this): this {
		if(this._isBottom) {
			return other.create(other.value);
		} else if(other._isBottom) {
			return this.create(this.value);
		}
		return super.widen(other);
	}

	public narrow(other: this): this {
		const result = super.narrow(other);
		result._isBottom = this._isBottom || other._isBottom;

		return result;
	}

	public concretize(limit: number): ReadonlySet<ConcreteMap<NodeId, Domain>> | typeof Top {
		if(this._isBottom) {
			return new Set();
		} else if(this.value.size === 0) {
			return Top;
		}
		return super.concretize(limit);
	}

	public abstract(concrete: typeof Top | ReadonlySet<ConcreteMap<NodeId, Domain>>): this {
		if(concrete === Top) {
			return this.top();
		} else if(concrete.size === 0) {
			return this.create(new Map(), true);
		}
		return super.abstract(concrete);
	}

	public toJson(): unknown {
		if(this._isBottom) {
			return BottomSymbol;
		} else if(this.value.size === 0) {
			return TopSymbol;
		}
		return super.toJson();
	}

	public toString(): string {
		if(this._isBottom) {
			return BottomSymbol;
		} else if(this.value.size === 0) {
			return TopSymbol;
		}
		return super.toString();
	}

	public isTop(): this is this {
		return this.value.size === 0;
	}

	public isBottom(): this is this {
		return this._isBottom ?? false;
	}

	public isValue(): this is this {
		return !this._isBottom;
	}
}

/**
 * A mutable version of the {@link StateAbstractDomain} with {@link MutableStateAbstractDomain#set|`set`} and {@link MutableStateAbstractDomain#remove|`remove`}.
 */
export class MutableStateAbstractDomain<Domain extends AnyAbstractDomain> extends StateAbstractDomain<Domain> {
	public create(value: ReadonlyMap<NodeId, Domain>, bottom?: boolean): this;
	public create(value: ReadonlyMap<NodeId, Domain>, bottom?: boolean): MutableStateAbstractDomain<Domain> {
		return new MutableStateAbstractDomain(value, bottom ?? this._isBottom);
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
