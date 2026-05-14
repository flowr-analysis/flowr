import { ProductDomain } from '../domains/product-domain';
import { UpperBoundsValueDomain } from './upper-bounds/upper-bounds-value-domain';
import { IntervalDomain } from '../domains/interval-domain';

/** The type of the abstract product representing the closed pentagon */
export type AbstractClosedPentagon = {
	interval:    IntervalDomain;
	upperBounds: UpperBoundsValueDomain;
};

/**
 * The weakly relational closed pentagon domain is product combining the interval state domain and the upper-bounds domain.
 * To remove the duplicate mapping from NodeId to values
 * (interval state domain: NodeId -&gt; interval, upper bounds: NodeId -&gt; Set(NodeId)),
 * we implement the domain as a single mapping from NodeIds to a product of intervals ({@link IntervalDomain}) and the
 * upper bounds set ({@link UpperBoundsValueDomain}).
 * We use the {@link StateAbstractDomain} to model the mapping from NodeId to a "value domain".
 * This domain represents the "value domain" as a product combining the intervals {@link IntervalDomain} and
 * set of NodeIds with the semantics of the upper bounds domain {@link UpperBoundsValueDomain}.
 */
export class ClosedPentagonValueDomain extends ProductDomain<AbstractClosedPentagon> {
	public create(value: AbstractClosedPentagon): this;
	public create(value: AbstractClosedPentagon): ClosedPentagonValueDomain {
		return new ClosedPentagonValueDomain(value);
	}

	public static top(significantFigures?: number): ClosedPentagonValueDomain {
		return new ClosedPentagonValueDomain({ interval: IntervalDomain.top(significantFigures), upperBounds: UpperBoundsValueDomain.top() });
	}

	public static bottom(significantFigures?: number): ClosedPentagonValueDomain {
		return new ClosedPentagonValueDomain({ interval: IntervalDomain.bottom(significantFigures), upperBounds: UpperBoundsValueDomain.bottom() });
	}

	public override top(significantFigures?: number): this & ProductDomain<AbstractClosedPentagon>;
	public override top(significantFigures?: number): ClosedPentagonValueDomain {
		return ClosedPentagonValueDomain.top(significantFigures);
	}

	public override bottom(significantFigures?: number): this & ProductDomain<AbstractClosedPentagon>;
	public override bottom(significantFigures?: number): ClosedPentagonValueDomain {
		return ClosedPentagonValueDomain.bottom(significantFigures);
	}

	public override toString(): string {
		return '(' + this.value.interval.toString() + ', ' + this.value.upperBounds.toString() + ')';
	}
}
