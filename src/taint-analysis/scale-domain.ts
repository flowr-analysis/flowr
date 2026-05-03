import { AbstractDomain } from '../abstract-interpretation/domains/abstract-domain';
import { Bottom, Top } from '../abstract-interpretation/domains/lattice';

export const Unscaled = Symbol('Unscaled');
export const Scaled = Symbol('Scaled');

type Lift = typeof Scaled | typeof Unscaled | typeof Top | typeof Bottom;

export class ScaleDomain<Value extends Lift = Lift> extends AbstractDomain<Lift, Lift, typeof Top, typeof Bottom, Value> {
	public static Unscaled() {
		return Unscaled;
	}

	public static Scaled(): symbol {
		return Scaled;
	}

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
		throw new Error('Method not implemented.');
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

	public widen(_other: this): this {
		throw new Error('Method not implemented.');
	}

	public narrow(_other: this): this {
		throw new Error('Method not implemented.');
	}

	public concretize(_limit: number): typeof Top | ReadonlySet<Lift> {
		throw new Error('Method not implemented.');
	}

	public abstract(_concrete: typeof Top | ReadonlySet<Lift>): this {
		throw new Error('Method not implemented.');
	}

	public toJson(): unknown {
		throw new Error('Method not implemented.');
	}

	public toString(): string {
		return this.value.toString();
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