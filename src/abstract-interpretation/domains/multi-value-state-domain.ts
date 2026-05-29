import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom } from './lattice';
import { type AbstractProduct, PartialProductDomain } from './partial-product-domain';
import { type StateDomainLift, StateAbstractDomain } from './state-abstract-domain';

/**
 * A reduction function for abstract values of a product domain.
 */
export type Reduction<Product extends AbstractProduct> = (value: Product) => Product;

/**
 * A multi-value state abstract domain that maps AST node IDs to multiple abstract values from different abstract domains.
 * @template Product - Type of the abstract product of the multi-value domain combining multiple abstract values
 * @see {@link NodeId} for the node IDs of the AST nodes
 */
export class MultiValueStateDomain<Product extends AbstractProduct, Value extends StateDomainLift<MultiValueDomain<Product>> = StateDomainLift<MultiValueDomain<Product>>>
	extends StateAbstractDomain<MultiValueDomain<Product>, Value> {

	constructor(value: Value, domain: Required<Product>, reductions: readonly Reduction<Product>[] = []) {
		super(value, new MultiValueDomain(domain, domain, reductions));
	}

	public create(value: StateDomainLift<MultiValueDomain<Product>>): this;
	public create(value: StateDomainLift<MultiValueDomain<Product>>): StateAbstractDomain<MultiValueDomain<Product>> {
		return new MultiValueStateDomain(value, this.domain.domain, this.domain.reductions);
	}

	public getValue<Key extends keyof Product>(node: NodeId, property: Key): Product[Key] | undefined {
		if(this.value === Bottom) {
			return this.domain.value[property]?.bottom() as Product[Key];
		}
		return this.value.get(node)?.value[property];
	}

	public hasValue(node: NodeId, property: keyof Product): boolean {
		return this.value !== Bottom && this.value.get(node)?.value[property] !== undefined;
	}

	public setValue<Key extends keyof Product>(node: NodeId, property: Key, value: Product[Key]): void {
		if(this.value !== Bottom) {
			const oldValue = this.get(node);
			const newValue = { ...oldValue?.value ?? {}, [property]: value };
			(this._value as Map<NodeId, MultiValueDomain<Product>>).set(node, new MultiValueDomain(newValue as Product, this.domain.domain, this.domain.reductions));
		}
	}
}

/**
 * A multi-value abstract domain as a (partial) product domain that combines multiple abstract domains.
 * The Bottom element is defined as mapping every sub abstract domain to Bottom and the Top element is defined as having no sub abstract domain value.
 * @template Product - Type of the abstract product of the multi-value domain combining multiple abstract values
 * @see {@link MultiValueStateDomain} for a state abstract domain of a multi-value domain
 */
export class MultiValueDomain<Product extends AbstractProduct>
	extends PartialProductDomain<Product> {

	public readonly reductions: readonly Reduction<Product>[];

	constructor(value: Product, domain: Required<Product>, reductions: readonly Reduction<Product>[] = []) {
		super(value, domain);
		this.reductions = reductions;
	}

	public create(value: Product): this;
	public create(value: Product): MultiValueDomain<Product> {
		return new MultiValueDomain(value, this.domain, this.reductions);
	}

	public static top<Product extends AbstractProduct>(domain: Required<Product>, reductions: readonly Reduction<Product>[] = []): MultiValueDomain<Product> {
		return new MultiValueDomain({} as Product, domain, reductions);
	}

	protected reduce(value: Product): Product {
		return this.reductions.reduce((current, reduction) => reduction(current), value);
	}
}
