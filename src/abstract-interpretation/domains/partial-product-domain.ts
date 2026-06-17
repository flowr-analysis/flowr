import type { Writable } from 'ts-essentials';
import { isNotUndefined } from '../../util/assert';
import { Record } from '../../util/record';
import { type AnyAbstractDomain, AbstractDomain } from './abstract-domain';

/** The type of an abstract product of a product domain mapping named properties of the product to abstract domains */
export type AbstractProduct<Domain extends AnyAbstractDomain = AnyAbstractDomain> = {
	readonly [key in string]?: Domain
};

/** A reduction function of a reduced product domain refining the abstract value based on the values of its sub abstract domains. */
export type ProductReduction<Product extends AbstractProduct> = (value: Product) => Product;

/**
 * A partial product abstract domain as named Cartesian product of (optional) sub abstract domains.
 * The sub abstract domains are represented by a (partial) record mapping property names to abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as having no sub abstract domain value.
 * @template Product - Type of the abstract product of the product domain mapping (optional) property names to abstract domains
 */
export abstract class PartialProductDomain<Product extends AbstractProduct>
	extends AbstractDomain<Product, Product, Product> {

	public readonly domain:     Required<Product>;
	public readonly reductions: readonly ProductReduction<Product>[];

	constructor(value: Product, domain: Required<Product>, reductions: readonly ProductReduction<Product>[] = [], reduce = true) {
		super(Record.mapProperties(value, entry => entry?.create(entry.value)) as Product);

		this.reductions = reductions;
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

	protected equalsValue(other: this): boolean {
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

	protected leqValue(other: this): boolean {
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

	protected joinValue(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] !== undefined && other.value[key] !== undefined) {
				result[key] = this.value[key].join(other.value[key]) as typeof result[typeof key];
			}
		}
		return this.create(result);
	}

	protected meetValue(other: this): this {
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

	protected widenValue(other: this): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] !== undefined && other.value[key] !== undefined) {
				result[key] = this.value[key].widen(other.value[key]) as typeof result[typeof key];
			}
		}
		return this.create(result);
	}

	protected narrowValue(other: this): this {
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

	protected jsonify(): unknown {
		return Record.mapProperties(this.value, entry => entry?.toJson());
	}

	protected stringify(): string {
		return '(' + Record.entries(this.value).map(([key, value]) => `${key}: ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): boolean;
	public isTop(): this is this;
	public isTop(): this is this {
		return Record.values(this.value).filter(isNotUndefined).length === 0;
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
	 * Applies the {@link reductions} of the (reduced) product domain to refine the abstract value based on its components.
	 * Subclasses may override this to implement a fixed reduction instead of (or in addition to) the configurable reductions.
	 */
	protected reduce(value: Product): Product {
		return this.reductions.reduce((current, reduction) => reduction(current), value);
	}
}
