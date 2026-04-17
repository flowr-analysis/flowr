import { IntervalDomain } from '../domains/interval-domain';
import { UpperBoundsDomain } from './upper-bounds-domain';
import { ProductDomain } from '../domains/product-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { StateAbstractDomain } from '../domains/state-abstract-domain';

/** The type of the abstract product representing the closed pentagon */
export type AbstractClosedPentagon = {
	interval:    StateAbstractDomain<IntervalDomain>;
	upperBounds: UpperBoundsDomain;
};

/**
 * The closed pentagon domain as reduced product domain of an interval state domain and a weakly relational upper bounds domain.
 */
export class ClosedPentagonDomain extends ProductDomain<AbstractClosedPentagon> {
	public create(value: AbstractClosedPentagon): this;
	public create(value: AbstractClosedPentagon): ClosedPentagonDomain {
		return new ClosedPentagonDomain(value);
	}

	/**
	 * The current abstract value of the interval state domain.
	 */
	public get interval(): AbstractClosedPentagon['interval'] {
		return this.value.interval;
	}

	/**
	 * The current abstract value of the upper bounds domain.
	 */
	public get upperBounds(): AbstractClosedPentagon['upperBounds'] {
		return this.value.upperBounds;
	}

	public static top(): ClosedPentagonDomain {
		return new ClosedPentagonDomain({ interval: StateAbstractDomain.top(IntervalDomain.top()), upperBounds: UpperBoundsDomain.top() });
	}

	public static bottom(): ClosedPentagonDomain {
		return new ClosedPentagonDomain({ interval: StateAbstractDomain.bottom(IntervalDomain.bottom()), upperBounds: UpperBoundsDomain.bottom() });
	}

	protected override reduce(value: AbstractClosedPentagon): AbstractClosedPentagon {
		if(value.interval.isTop() && value.upperBounds.isTop()) {
			return value;
		}
		if(value.interval.isBottom() || value.upperBounds.isBottom()) {
			return { interval: StateAbstractDomain.bottom(IntervalDomain.bottom()), upperBounds: UpperBoundsDomain.bottom() };
		}
		if(value.interval.isValue() && value.upperBounds.isValue()) {
			const allKeys = new Set<NodeId>([...value.interval.value.keys(), ...value.upperBounds.value.keys()]);

			for(const key of allKeys) {
				const inferredUpperBounds = new Set<NodeId>();
				for(const otherKey of allKeys){
					const keyInterval = value.interval.get(key);
					const otherKeyInterval = value.interval.get(otherKey);
					if(keyInterval?.isValue() && otherKeyInterval?.isValue() && keyInterval.value[1] <= otherKeyInterval.value[0]) {
						inferredUpperBounds.add(otherKey);
					}
				}

				(value.upperBounds.value as Map<NodeId, ReadonlySet<NodeId>>).set(key, inferredUpperBounds.union(value.upperBounds.value.get(key) ?? new Set()));
			}
		}
		return value;
	}
}