import { ProductDomain } from '../domains/product-domain';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import { IntervalDomain } from '../domains/interval-domain';

/** The type of the abstract product representing the closed pentagon */
export type AbstractClosedPentagon = {
	interval:    IntervalDomain;
	upperBounds: UpperBoundsValueDomain;
};

export class ClosedPentagonValueDomain extends ProductDomain<AbstractClosedPentagon> {
	public create(value: AbstractClosedPentagon): this;
	public create(value: AbstractClosedPentagon): ClosedPentagonValueDomain {
		return new ClosedPentagonValueDomain(value);
	}

	public static top(): ClosedPentagonValueDomain {
		return new ClosedPentagonValueDomain({ interval: IntervalDomain.top(), upperBounds: UpperBoundsValueDomain.top() });
	}

	public static bottom(significantFigures?: number): ClosedPentagonValueDomain {
		return new ClosedPentagonValueDomain({ interval: IntervalDomain.bottom(significantFigures), upperBounds: UpperBoundsValueDomain.bottom() });
	}

	public override top(): this & ProductDomain<AbstractClosedPentagon>;
	public override top(): ClosedPentagonValueDomain {
		return ClosedPentagonValueDomain.top();
	}

	public override bottom(): this & ProductDomain<AbstractClosedPentagon>;
	public override bottom(): ClosedPentagonValueDomain {
		return ClosedPentagonValueDomain.bottom();
	}

	public override toString(): string {
		return '(' + this.value.interval.toString() + ', ' + this.value.upperBounds.toString() + ')';
	}
}
