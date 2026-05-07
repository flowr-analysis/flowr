import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { Bottom, BottomSymbol, Top, TopSymbol } from '../abstract-interpretation/domains/lattice';

export const Unscaled = Symbol('Unscaled');
export const Scaled = Symbol('Scaled');

type Lift = typeof Scaled | typeof Unscaled | typeof Top | typeof Bottom;

// TODO Builder pattern in the DSL for the definition of finite taint lattices
export class ScaleDomain<Value extends Lift = Lift> extends AbstractDomain<Lift, Lift, typeof Top, typeof Bottom, Value> {
	public create(value: Lift): this;
	public create(value: Lift): ScaleDomain {
		return new ScaleDomain<Lift>(value);
	}

	public top(): this & ScaleDomain<typeof Top>;
	public top(): ScaleDomain<typeof Top> {
		return new ScaleDomain(Top);
	}

	public bottom(): this & ScaleDomain<typeof Bottom>;
	public bottom(): ScaleDomain<typeof Bottom> {
		return new ScaleDomain(Bottom);
	}

	public equals(other: this): boolean {
		return this.value === other.value;
	}

	public leq(other: this): boolean {
		return this.value === Bottom || other.value === Top ;
	}

	public join(other: this): this {
		if(this.value === other.value) {
			return this.create(this.value);
		}

		if(this.value === Bottom) {
			return this.create(other.value);
		}

		if(other.value === Bottom) {
			return this.create(this.value);
		}

		return this.create(Top);
	}

	public meet(other: this): this {
		if(this.value === other.value) {
			return this.create(this.value);
		}

		if(this.value === Top) {
			return this.create(other.value);
		}

		if(other.value === Top) {
			return this.create(this.value);
		}

		return this.create(Bottom);
	}

	public widen(other: this): this {
		return this.join(other);  // Using join for widening as the lattice is finite
	}

	public narrow(other: this): this {
		return this.meet(other);  // Using meet for narrowing as the lattice is finite
	}

	public concretize(_limit: number): typeof Top | ReadonlySet<Lift> {
		throw new Error('Method not implemented.');
	}

	public abstract(_concrete: typeof Top | ReadonlySet<Lift>): this {
		throw new Error('Method not implemented.');
	}

	public toJson(): unknown {
		return this.value.description;
	}

	public toString(): string {
		if(this.value === Top) {
			return TopSymbol;
		} else if(this.value === Scaled) {
			return 'Scaled';
		} else if(this.value === Unscaled) {
			return 'Unscaled';
		}
		return BottomSymbol;
	}

	public isTop(): this is ScaleDomain<typeof Top> {
		return this.value === Top;
	}

	public isBottom(): this is ScaleDomain<typeof Bottom> {
		return this.value === Bottom;
	}

	public isValue(): this is ScaleDomain {
		return this.value !== Top && this.value !== Bottom;
	}
}