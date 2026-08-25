import type { Writable } from 'ts-essentials';
import { isNotUndefined } from '../../util/assert';
import { Record } from '../../util/record';
import { type AnyAbstractDomain, AbstractDomain } from './abstract-domain';

/** A pointwise binary operation (join, meet, widen, or narrow) on two abstract domain elements of the same kind. */
type PointwiseOp = (a: AnyAbstractDomain, b: AnyAbstractDomain) => AnyAbstractDomain;

/** The type of an abstract product of a product domain mapping named properties of the product to abstract domains */
export type AbstractProduct<Domain extends AnyAbstractDomain = AnyAbstractDomain> = Record<string, Domain>;

/** A partial product of a product domain mapping (optional) property names to abstract domains */
export type PartialProduct<Domain extends AnyAbstractDomain = AnyAbstractDomain> = Partial<AbstractProduct<Domain>>;

/** A reduction function of a reduced product domain refining the abstract value based on the values of its sub abstract domains. */
export type ProductReduction<Product extends PartialProduct> = (value: Product) => Product;

/**
 * A partial product abstract domain as named Cartesian product of (optional) sub abstract domains.
 * The sub abstract domains are represented by a (partial) record mapping property names to abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as having no sub abstract domain value.
 * @template Product - Type of the abstract product of the product domain mapping (optional) property names to abstract domains
 */
export abstract class PartialProductDomain<Product extends PartialProduct>
	extends AbstractDomain<Product, Product, Product> {

	public readonly domain:     Required<Product>;
	public readonly reductions: readonly ProductReduction<Product>[];

	constructor(value: Product, domain: Required<Product>, reductions: readonly ProductReduction<Product>[] = [], reduce = true) {
		super(Record.mapPartialProps(value, entry => entry.create(entry.value)) as Product);

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

	/** Compares each sub abstract domain value pointwise with `cmp`; `skipWhenOtherUndefined` treats a missing (Top) property on `other` as trivially satisfying `cmp` instead of a mismatch. */
	private compareValues(other: this, cmp: (a: AnyAbstractDomain, b: AnyAbstractDomain) => boolean, skipWhenOtherUndefined: boolean): boolean {
		if(this.value === other.value) {
			return true;
		}
		for(const key in this.value) {
			if(this.value[key] === other.value[key] || (skipWhenOtherUndefined && other.value[key] === undefined)) {
				continue;
			} else if(this.value[key] === undefined || other.value[key] === undefined || !cmp(this.value[key], other.value[key])) {
				return false;
			}
		}
		return true;
	}

	protected equalsValue(other: this): boolean {
		return this.compareValues(other, (a, b) => a.equals(b), false);
	}

	protected leqValue(other: this): boolean {
		return this.compareValues(other, (a, b) => a.leq(b), true);
	}

	/** Combines each sub abstract domain value pointwise with `op`, keeping a property only if it is defined on both sides (used by join and widen). */
	private combineDefined(other: this, op: PointwiseOp): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] !== undefined && other.value[key] !== undefined) {
				result[key] = op(this.value[key], other.value[key]) as typeof result[typeof key];
			}
		}
		return this.create(result);
	}

	protected joinValue(other: this): this {
		return this.combineDefined(other, (a, b) => a.join(b));
	}

	protected widenValue(other: this): this {
		return this.combineDefined(other, (a, b) => a.widen(b));
	}

	/** Combines each sub abstract domain value pointwise with `op`, falling back to whichever side has a value if the other property is missing (used by meet and narrow). */
	private combineOrFallback(other: this, op: PointwiseOp): this {
		const result = {} as Product;

		for(const key in this.domain) {
			if(this.value[key] === undefined) {
				result[key] = other.value[key];
			} else if(other.value[key] === undefined) {
				result[key] = this.value[key];
			} else {
				result[key] = op(this.value[key], other.value[key]) as typeof result[typeof key];
			}
		}
		return this.create(result);
	}

	protected meetValue(other: this): this {
		return this.combineOrFallback(other, (a, b) => a.meet(b));
	}

	protected narrowValue(other: this): this {
		return this.combineOrFallback(other, (a, b) => a.narrow(b));
	}

	protected jsonify(): unknown {
		return Record.mapPartialProps(this.value, entry => entry.toJSON());
	}

	protected stringify(): string {
		return '(' + Record.entries(this.value).filter(([, value]) => isNotUndefined(value)).map(([key, value]) => `${key}: ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): boolean;
	public isTop(): this is this;
	public isTop(): this is this {
		return !Record.values(this.value).some(isNotUndefined);
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
