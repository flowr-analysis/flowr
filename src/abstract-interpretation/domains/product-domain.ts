import { AbstractDomain, type AnyAbstractDomain } from './abstract-domain';
import { Top } from './lattice';
import { Ternary } from '../../util/logic';

/** The type of an abstract product of a product domain mapping named properties of the product to abstract domains */
export type AbstractProduct = Record<string, AnyAbstractDomain>;

/** The type of the concrete product of an abstract product mapping each property to a concrete value in the respective concrete domain */
export type ConcreteProduct<Product extends AbstractProduct> = {
	[Key in keyof Product]: Product[Key] extends AbstractDomain<infer Concrete, unknown, unknown, unknown> ? Concrete : never;
};

/**
 * A product abstract domain as named Cartesian product of sub abstract domains.
 * The sub abstract domains are represented by a record mapping property names to abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as mapping every sub abstract domain to Top.
 * @template Product - Type of the abstract product of the product domain mapping property names to abstract domains
 */
export abstract class ProductDomain<Product extends AbstractProduct>
	extends AbstractDomain<ConcreteProduct<Product>, Product, Product, Product> {

	public abstract create(value: Product): this;

	public bottom(): this {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].bottom() as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public top(): this {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].top() as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public equals(other: this): Ternary {
		if(this.value === other.value) {
			return Ternary.Always;
		}

		let equals = Ternary.Always;

		for(const key in this.value) {
			if(this.value[key].equals(other.value[key]) === Ternary.Never) {
				return Ternary.Never;
			}
			if(this.value[key].equals(other.value[key]) === Ternary.Maybe) {
				equals = Ternary.Maybe;
			}
		}
		return equals;
	}

	public leq(other: this): Ternary {
		if(this.value === other.value) {
			return Ternary.Always;
		}

		let leq = Ternary.Always;

		for(const key in this.value) {
			if(this.value[key].leq(other.value[key]) === Ternary.Never) {
				return Ternary.Never;
			}
			if(this.value[key].leq(other.value[key]) === Ternary.Maybe) {
				leq = Ternary.Maybe;
			}
		}
		return leq;
	}

	public join(other: this): this {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].join(other.value[key]);
		}
		return result;
	}

	public meet(other: this): this {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].meet(other.value[key]);
		}
		return result;
	}

	public widen(other: this): this {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].widen(other.value[key]);
		}
		return result;
	}

	public narrow(other: this): this {
		const result = this.create(this.value);

		for(const key in result.value) {
			result._value[key] = result.value[key].narrow(other.value[key]);
		}
		return result;
	}

	public concretize(limit: number): ReadonlySet<ConcreteProduct<Product>> | typeof Top {
		let result = new Set<ConcreteProduct<Product>>([{} as ConcreteProduct<Product>]);

		for(const key in this.value) {
			const concrete = this.value[key].concretize(limit);

			if(concrete === Top) {
				return Top;
			}
			const newResult = new Set<ConcreteProduct<Product>>();

			for(const value of concrete) {
				for(const entry of result) {
					if(newResult.size >= limit) {
						return Top;
					}
					newResult.add({ ...entry, [key]: value });
				}
			}
			result = newResult;
		}
		return result;
	}

	public abstract(concrete: ReadonlySet<ConcreteProduct<Product>> | typeof Top): this {
		if(concrete === Top) {
			return this.top();
		}
		const result = this.create(this.value);

		for(const key in result.value) {
			const concreteValues = new Set(concrete.values().map(value => value[key]));
			result._value[key] = result.value[key].abstract(concreteValues);
		}
		return result;
	}

	public toJson(): unknown {
		return Object.fromEntries(Object.entries(this.value).map(([key, value]) => [key, value.toJson()]));
	}

	public toString(): string {
		return '(' + Object.entries(this.value).map(([key, value]) => `${key}: ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is this {
		return Object.values(this.value).every(value => value.isTop());
	}

	public isBottom(): this is this {
		return Object.values(this.value).every(value => value.isBottom());
	}

	public isValue(): this is this {
		return true;
	}
}
