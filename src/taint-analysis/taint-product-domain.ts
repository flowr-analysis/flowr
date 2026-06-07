import type { AbstractProduct } from '../abstract-interpretation/domains/partial-product-domain';
import { PartialProductDomain } from '../abstract-interpretation/domains/partial-product-domain';

/**
 * The abstract product mapping the name of a (component) taint analysis to its (value) abstract domain.
 * Each property of the product holds the inferred taint of the respective component analysis.
 */
export type TaintProduct = AbstractProduct;

/**
 * A reduction function for a {@link TaintProductDomain} turning the otherwise direct product into a reduced product.
 * It may refine the inferred taints of the component analyses based on each other.
 */
export type TaintReduction = (value: TaintProduct) => TaintProduct;

/**
 * A product abstract domain combining the (value) abstract domains of multiple taint analyses.
 *
 * The product is a named Cartesian product keyed by the component analysis names, providing component-wise
 * {@link join}, {@link meet}, {@link widen}, {@link narrow}, and order operations (inherited from
 * {@link PartialProductDomain}). The optional {@link reductions} turn the direct product into a reduced product:
 * they are applied whenever a new product value is created (including the results of joins at CFG merge points),
 * allowing the component analyses to refine each other.
 *
 * Note: reductions are applied in {@link create} (i.e. after construction) instead of via the
 * {@link PartialProductDomain} reduce hook, since the latter runs during the base constructor before instance
 * fields (such as the reductions) are initialized.
 */
export class TaintProductDomain extends PartialProductDomain<TaintProduct> {
	public readonly reductions: readonly TaintReduction[];

	constructor(value: TaintProduct, domain: Required<TaintProduct>, reductions: readonly TaintReduction[] = []) {
		super(value, domain);
		this.reductions = reductions;
	}

	public create(value: TaintProduct): this;
	public create(value: TaintProduct): TaintProductDomain {
		const reduced = (this.reductions ?? []).reduce((current, reduction) => reduction(current), value);
		return new TaintProductDomain(reduced, this.domain, this.reductions);
	}

	/**
	 * Creates the Top element of the taint product domain (an empty product) for the given component domains.
	 * @param domain     - The component (value) abstract domains keyed by their analysis name
	 * @param reductions - The optional reductions for a reduced product
	 */
	public static top(domain: Required<TaintProduct>, reductions: readonly TaintReduction[] = []): TaintProductDomain {
		return new TaintProductDomain({}, domain, reductions);
	}
}
