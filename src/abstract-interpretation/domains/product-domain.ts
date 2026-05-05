import { Record } from '../../util/record';
import { type AbstractProduct, PartialProductDomain } from './partial-product-domain';

/**
 * A product abstract domain as named Cartesian product of sub abstract domains.
 * The sub abstract domains are represented by a record mapping property names to abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as mapping every sub abstract domain to Top.
 * @template Product - Type of the abstract product of the product domain mapping property names to abstract domains
 */
export abstract class ProductDomain<Product extends Required<AbstractProduct>>
	extends PartialProductDomain<Product> {

	constructor(value: Product) {
		super(value, value as Required<Product>);
	}

	public abstract create(value: Product): this;

	public top(): this {
		const result = this.create(this.domain);

		for(const key in result.value) {
			result._value[key] = result.value[key]?.top() as Product[Extract<keyof Product, string>];
		}
		return result;
	}

	public isTop(): boolean;
	public isTop(): this is this;
	public isTop(): this is this {
		return Record.values(this.value).every(value => value.isTop());
	}
}
