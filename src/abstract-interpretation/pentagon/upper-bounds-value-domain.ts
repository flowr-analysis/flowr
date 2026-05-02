import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom, BottomSymbol, Top } from '../domains/lattice';
import { AbstractDomain } from '../domains/abstract-domain';
import { setEquals } from '../../util/collections/set';

const UpperBoundsTop: UpperBoundsValue = new Set<NodeId>();

type UpperBoundsValue = ReadonlySet<NodeId>;
type UpperBoundsTop = typeof UpperBoundsTop;
type UpperBoundsBottom = typeof Bottom;
export type UpperBoundsLift = UpperBoundsValue | UpperBoundsBottom;

export class UpperBoundsValueDomain<Value extends UpperBoundsLift = UpperBoundsLift, Concrete = unknown> extends AbstractDomain<Concrete, UpperBoundsValue, UpperBoundsTop, UpperBoundsBottom, Value> {
	constructor(value: Value) {
		if(value !== Bottom) {
			super(new Set(value) as UpperBoundsLift as Value);
		} else {
			super(value);
		}
	}

	public create(value: UpperBoundsLift): this;
	public create(value: UpperBoundsLift): UpperBoundsValueDomain<UpperBoundsLift, Concrete> {
		return new UpperBoundsValueDomain<UpperBoundsLift, Concrete>(value);
	}

	public has(node: NodeId): boolean {
		return this.value !== Bottom && this.value.has(node);
	}

	public add(node: NodeId): void {
		if(this.value !== Bottom) {
			(this.value as Set<NodeId>).add(node);
		}
	}

	public remove(node: NodeId): void {
		if(this.value !== Bottom && this.value.has(node)) {
			(this.value as Set<NodeId>).delete(node);
		}
	}

	public static top(): UpperBoundsValueDomain<UpperBoundsTop> {
		return new UpperBoundsValueDomain<UpperBoundsTop>(UpperBoundsTop);
	}

	public top(): this & UpperBoundsValueDomain<UpperBoundsTop, Concrete>;
	public top(): UpperBoundsValueDomain<UpperBoundsTop, Concrete> {
		return UpperBoundsValueDomain.top() as UpperBoundsValueDomain<UpperBoundsTop, Concrete>;
	}

	public static bottom(): UpperBoundsValueDomain<UpperBoundsBottom> {
		return new UpperBoundsValueDomain<UpperBoundsBottom>(Bottom);
	}

	public bottom(): this & UpperBoundsValueDomain<UpperBoundsBottom, Concrete>;
	public bottom(): UpperBoundsValueDomain<UpperBoundsBottom, Concrete> {
		return UpperBoundsValueDomain.bottom() as UpperBoundsValueDomain<UpperBoundsBottom, Concrete>;
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value === Bottom || other.value === Bottom) {
			return false;
		}
		return setEquals(this.value, other.value);
	}

	public leq(other: this): boolean {
		if(this.isBottom()) {
			return true;
		} else if(other.isBottom()) {
			return false;
		}
		return (other.value as UpperBoundsValue).isSubsetOf(this.value as UpperBoundsValue);
	}

	public join(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}

		return this.create(this.value.intersection(other.value));
	}

	public meet(other: this): this {
		if(this.value === Bottom || other.value === Bottom) {
			return this.bottom();
		}
		return this.create(this.value.union(other.value));
	}

	public widen(other: this): this {
		if(this.value === Bottom) {
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}

		if(other.value.isSubsetOf(this.value)) {
			return this.create(other.value);
		}
		return this.top();
	}

	public narrow(_other: this): this {
		throw new Error('Not Implemented');
	}

	public concretize(_limit: number): ReadonlySet<Concrete> | typeof Top {
		return Top;
	}

	public abstract(_concrete: ReadonlySet<Concrete> | typeof Top): this {
		throw new Error('Not Possible');
	}

	public isTop(): this is UpperBoundsValueDomain<UpperBoundsTop, Concrete> {
		return this.value !== Bottom && this.value.size === 0;
	}

	public isBottom(): this is UpperBoundsValueDomain<UpperBoundsBottom, Concrete> {
		return this.value === Bottom;
	}

	public isValue(): this is UpperBoundsValueDomain<UpperBoundsValue, Concrete> {
		return this.value !== Bottom;
	}

	public toJson(): unknown {
		if(this.value === Bottom) {
			return this.value.description;
		}
		return this.value.values().toArray();
	}

	public toString(): string {
		if(this.value === Bottom) {
			return BottomSymbol;
		}
		return '{' + this.value.values().map(id => id.toString()).toArray().join(', ') + '}';
	}
}