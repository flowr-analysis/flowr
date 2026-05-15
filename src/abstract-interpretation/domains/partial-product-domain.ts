import type { Writable } from 'ts-essentials';
import { type AnyAbstractDomain, AbstractDomain } from './abstract-domain';
import { Record } from '../../util/record';

/** The type of an abstract product of a product domain mapping named properties of the product to abstract domains */
export type AbstractProduct<Domain extends AnyAbstractDomain = AnyAbstractDomain> = {
	[key in string]?: Domain
};

/**
 * A partial product abstract domain as named Cartesian product of (optional) sub abstract domains.
 * The sub abstract domains are represented by a (partial) record mapping property names to abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as having no sub abstract domain value.
 * @template Product - Type of the abstract product of the product domain mapping (optional) property names to abstract domains
 */
export abstract class PartialProductDomain<Product extends AbstractProduct>
	extends AbstractDomain<Product, Product, Product> {

	public readonly domain: Required<Product>;

	constructor(value: Product, domain: Required<Product>, reduce = true) {
		super(Record.mapProperties(value, entry => entry?.create(entry.value)) as Product);
		this.domain = domain;

		if(reduce) {
			(this._value as Writable<Product>) = this.reduce(this.value);
		}
	}

	public abstract create(value: Product, reduce?: boolean): this;

	public bottom(): this {
		const result = {} as Product;

		for(const key in this.domain) {
			result[key] = this.domain[key]?.bottom() as typeof result[typeof key];
		}
		return this.create(result);
	}

	public top(): this {
		return this.create({} as Product);
	}

	public equals(other: this): boolean {
		if(this.value === other.value) {
			return true;
		}
		for(const key in this.value) {
			if(this.value[key] === other.value[key]) {
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
				result[key] = this.value[key].join(other.value[key]) as typeof result[typeof key];
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
				result[key] = this.value[key].meet(other.value[key]) as typeof result[typeof key];
			}
		}
		return this.create(result);
	}

	public widen(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] !== undefined && other.value[key] !== undefined) {
				result[key] = this.value[key].widen(other.value[key]) as typeof result[typeof key];
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
				result[key] = this.value[key].narrow(other.value[key]) as typeof result[typeof key];
			}
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
		return Record.values(this.value).some(value => value.isBottom());
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
