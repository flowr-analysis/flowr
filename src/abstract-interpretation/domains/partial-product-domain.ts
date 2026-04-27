import type { Writable } from 'ts-essentials';
import { type  AbstractValue, type AnyAbstractDomain, AbstractDomain } from './abstract-domain';
import { Top } from './lattice';
import { Record } from '../../util/record';

/** The type of an abstract product of a product domain mapping named properties of the product to abstract domains */
export type AbstractProduct = { [key in string]?: AnyAbstractDomain };

/** The type of the concrete product of an abstract product mapping each property to a concrete value in the respective concrete domain */
export type ConcreteProduct<Product extends AbstractProduct> = {
	[Key in keyof Product]: Product[Key] extends AbstractDomain<infer Concrete, unknown, unknown, unknown> ? Concrete : never;
};

/**
 * The type of the abstract product values of a product abstract domain.
 * @template Product - The abstract product to get the product value type for
 */
export type ProductValue<Product extends AbstractProduct> = {
	[Key in keyof Product]: Product[Key] extends AnyAbstractDomain ? AbstractValue<Product[Key]> : never;
};

/**
 * A partial product abstract domain as named Cartesian product of (optional) sub abstract domains.
 * The sub abstract domains are represented by a (partial) record mapping property names to abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as having no sub abstract domain value.
 * @template Product - Type of the abstract product of the product domain mapping (optional) property names to abstract domains
 */
export abstract class PartialProductDomain<Product extends AbstractProduct>
	extends AbstractDomain<ConcreteProduct<Product>, Product, Product, Product> {

	public readonly domain: Required<Product>;

	constructor(value: Product, domain: Required<Product>) {
		super(Record.mapProperties(value, entry => entry?.create(entry.value)) as Product);
		(this._value as Writable<Product>) = this.reduce(this.value);
		this.domain = domain;
	}

	public abstract create(value: Product): this;

	public bottom(): this {
		const result = this.create(this.domain);

		for(const key in result.value) {
			result.value[key] = this.domain[key]?.bottom() as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public top(): this {
		return this.create({} as Product);
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		}
		for(const key in this.value) {
			if(this.value[key] == other.value[key]) {
				continue;
			} else if(this.value[key] === undefined || other.value[key] === undefined || !this.value[key].equals(other.value[key])) {
				return false;
			}
		}
		return true;
	}

	public leq(other: this): boolean {
		if(this.value === other.value) {
			return true;
		}
		for(const key in this.value) {
			if(this.value[key] === other.value[key] || other.value[key] === undefined) {
				continue;
			} else if(this.value[key] === undefined || !this.value[key].leq(other.value[key])) {
				return false;
			}
		}
		return true;
	}

	public join(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] !== undefined && other.value[key] !== undefined) {
				const join = this.value[key].join(other.value[key]) as Product[string];
				result[key as keyof Product] = join;
			}
		}
		return this.create(result);
	}

	public meet(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] === undefined) {
				result[key] = other.value[key];
			} else if(other.value[key] === undefined) {
				result[key] = this.value[key];
			} else {
				const meet = this.value[key].meet(other.value[key]) as Product[string];
				result[key as keyof Product] = meet;
			}
		}
		return this.create(result);
	}

	public widen(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] !== undefined && other.value[key] !== undefined) {
				const widening = this.value[key].widen(other.value[key]) as Product[string];
				result[key as keyof Product] = widening;
			}
		}
		return this.create(result);
	}

	public narrow(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] === undefined) {
				result[key] = other.value[key];
			} else if(other.value[key] === undefined) {
				result[key] = this.value[key];
			} else {
				const narrowing = this.value[key].narrow(other.value[key]) as Product[string];
				result[key as keyof Product] = narrowing;
			}
		}
		return this.create(result);
	}

	public concretize(limit: number): ReadonlySet<ConcreteProduct<Product>> | typeof Top {
		let result = new Set<ConcreteProduct<Product>>([{} as ConcreteProduct<Product>]);

		for(const key in this.value) {
			if(this.value[key] === undefined) {
				continue;
			}
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
		const result = {} as Product;

		for(const key in this.domain) {
			const concreteValues = new Set(concrete.values().map(value => value[key]));
			result[key] = this.domain[key]?.abstract(concreteValues) as Product[Extract<keyof Product, string>];
		}
		return this.create(result);
	}

	public toJson(): unknown {
		return Record.mapProperties(this.value, entry => entry?.toJson());
	}

	public toString(): string {
		return '(' + Record.entries(this.value).map(([key, value]) => `${key}: ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): boolean;
	public isTop(): this is this;
	public isTop(): this is this {
		return Record.values(this.value).length === 0;
	}

	public isBottom(): boolean;
	public isBottom(): this is this;
	public isBottom(): this is this {
		return Record.values(this.value).every(value => value.isBottom());
	}

	public isValue(): boolean;
	public isValue(): this is this;
	public isValue(): this is this {
		return true;
	}

	/**
	 * Optional reduction function for a reduced product domain.
	 */
	protected reduce(value: Product): Product {
		return value;
	}
}
