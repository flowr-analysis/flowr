import { IntervalDomain } from '../domains/interval-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	ConcreteState,
	StateDomainBottom,
	StateDomainLift,
	StateDomainTop,
	StateDomainValue
} from '../domains/state-abstract-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';
import { UpperBoundsValueDomain } from './upper-bounds/upper-bounds-value-domain';
import { Bottom, Top } from '../domains/lattice';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';
import type { Writable } from 'ts-essentials';

/**
 * The closed pentagon domain as reduced product domain of an interval state domain and a weakly relational upper bounds domain.
 */
export class ClosedPentagonDomain extends StateAbstractDomain<ClosedPentagonValueDomain> {
	constructor(value: StateDomainLift<ClosedPentagonValueDomain>, domain: ClosedPentagonValueDomain) {
		if(value !== Bottom) {
			super(ClosedPentagonDomain.reduce(value), domain);
		} else {
			super(Bottom, domain);
		}
	}

	public override top(): this & StateAbstractDomain<ClosedPentagonValueDomain, StateDomainTop>;
	public override top(): ClosedPentagonDomain {
		return ClosedPentagonDomain.top(this.domain);
	}

	public override bottom(): this & StateAbstractDomain<ClosedPentagonValueDomain, StateDomainBottom>;
	public override bottom(): ClosedPentagonDomain {
		return ClosedPentagonDomain.bottom(this.domain);
	}

	public override create(value: StateDomainLift<ClosedPentagonValueDomain>): this;
	public override create(value: StateDomainLift<ClosedPentagonValueDomain>): ClosedPentagonDomain {
		return new ClosedPentagonDomain(value, this.domain);
	}

	public override set(node: NodeId, value: ClosedPentagonValueDomain) {
		if(this.value !== Bottom) {
			super.set(node, value);
			// Directly apply the reduction to assure that the state is always reduced.
			(this._value as Writable<StateDomainLift<ClosedPentagonValueDomain>>) = ClosedPentagonDomain.reduce(this.value);
		}
	}

	public override get(node: NodeId): ClosedPentagonValueDomain | undefined {
		const value = super.get(node);
		if(isNotUndefined(value) && value.value.upperBounds.has(node)) {
			value.value.upperBounds.remove(node);
		}
		return value?.create(value.value);
	}

	public override equals(other: this): boolean {
		return this.leq(other) && other.leq(this);
	}

	public override leq(other: this): boolean {
		if(this.value === other.value || this.value === Bottom) {
			return true;
		} else if(other.value === Bottom || this.value.size > other.value.size) {
			return false;
		}
		for(const [key, value] of this.value.entries()) {
			const otherValue = other.get(key);

			// If right is not defined, then we have not visited that element on the right side yet, so its not leq
			if(isUndefined(otherValue)) {
				return false;
			}

			// Leq is the case when for every element on the left holds that
			// Interval of value leq interval of otherValue
			// And upperbounds of left leq upper bounds of right (which equals right is subset of left)

			// If interval leq does not hold, then leq over all does not hold
			if(!(value.value.interval.leq(otherValue.value.interval))) {
				return false;
			}

			// Early exit if the upper bounds of left and right side are equal, then leq is fine
			if(value.value.upperBounds === otherValue.value.upperBounds) {
				continue;
			}

			// Since both are not equal, if right side is Bottom, then leq is also not satisfiable
			if(otherValue.value.upperBounds.value === Bottom) {
				return false;
			}

			// At this point, left side could be bottom, right side has to be upper bounds
			// Problem is, that the left side might have implicit upper bounds through intervals that are not explicit
			// So for each upper bound on the right side, we must check if it is explicitly or implicitly present on the left
			// If one is neither explicitly nor implicitly present, leq is not satisfiable and we return false
			for(const rightUpperBound of otherValue.value.upperBounds.value.values()) {
				// Is explicitly present on left side? => continue with next upper bound
				if(value.value.upperBounds.has(rightUpperBound)) {
					continue;
				}
				// Is implicitly present on left side?
				const intervalA = value.value.interval;
				const intervalB = this.value.get(rightUpperBound)?.value.interval;

				// If the right interval does not exist, or any of both are bottom, then the upper bound cannot be implicitly present
				if(intervalB === undefined || intervalA.value === Bottom || intervalB.value === Bottom) {
					return false;
				}

				// It is implicitly present if intervalA <= intervalB and therefore the upper limit of A <= lower limit of B
				if(intervalA.value[1] <= intervalB.value[0]) {
					continue;
				}
				// The interval is not implicitly present, so leq is not satisfiable.
				return false;
			}
		}
		return true;
	}

	public override join(other: this): this {
		if(this.value === Bottom){
			return this.create(other.value);
		} else if(other.value === Bottom) {
			return this.create(this.value);
		}
		const result = this.create(this.value) as this & StateAbstractDomain<ClosedPentagonValueDomain, StateDomainValue<ClosedPentagonValueDomain>>;

		for(const [key, value] of other.value.entries()) {
			const currValue = result.get(key);

			if(currValue === undefined) {
				result.set(key, value);
			} else {
				const leftInterval = currValue.value.interval;
				const rightInterval = value.value.interval;
				const joinedInterval = leftInterval.join(rightInterval);

				const leftUpperBounds = currValue.value.upperBounds;
				const rightUpperBounds = value.value.upperBounds;
				// For the upper bounds part, we:
				// 1. Join both upper bounds
				const joinedUpperBounds = leftUpperBounds.join(rightUpperBounds);
				// 2. Add all upper bounds of the left, that are implicitly present on the right
				if(leftUpperBounds.isValue() && rightInterval.isValue()) {
					for(const leftUpperBound of leftUpperBounds.value) {
						const intervalA = rightInterval;
						const intervalB = other.value.get(leftUpperBound)?.value.interval;
						if(intervalB !== undefined && intervalB.isValue() && intervalA.value[1] <= intervalB.value[0]) {
							// The upper bound is implicitly present on both sides
							joinedUpperBounds.add(leftUpperBound);
						}
					}
				}
				// 3. Add all upper bounds of the right, that are implicitly present on the left
				if(rightUpperBounds.isValue() && leftInterval.isValue()) {
					for(const rightUpperBound of rightUpperBounds.value) {
						const intervalA = leftInterval;
						const intervalB = result.get(rightUpperBound)?.value.interval;
						if(intervalB !== undefined && intervalB.isValue() && intervalA.value[1] <= intervalB.value[0]) {
							// The upper bound is implicitly present on both sides
							joinedUpperBounds.add(rightUpperBound);
						}
					}
				}

				result.set(key, currValue.create({ interval: joinedInterval, upperBounds: joinedUpperBounds }));
			}
		}
		return result;
	}

	public override meet(other: this): this {
		return this.create(super.meet(other).value);
	}

	public override widen(other: this): this {
		return this.create(super.widen(other).value);
	}

	public override abstract(concrete: ReadonlySet<ConcreteState<ClosedPentagonValueDomain>> | typeof Top): this {
		if(concrete === Top) {
			return this.top();
		} else if(concrete.size === 0) {
			return this.bottom();
		}
		const result = this.top();

		const valueSetPerNode = new Map<NodeId, Set<number>>();
		for(const concreteMapping of concrete) {
			for(const [node, value] of concreteMapping) {
				const set = valueSetPerNode.get(node);
				if(isUndefined(set)) {
					valueSetPerNode.set(node, new Set([value.interval]));
				} else {
					set.add(value.interval);
				}
			}
		}

		const allNodeIds = new Set<NodeId>();
		for(const map of concrete.values()) {
			for(const key of map.keys()) {
				allNodeIds.add(key);
			}
		}
		for(const nodeIdA of allNodeIds.values()) {
			const nodeValues = valueSetPerNode.get(nodeIdA);
			if(isUndefined(nodeValues)) {
				// This should never be executed, as we only iterate valid ids with values.
				continue;
			}
			const interval = IntervalDomain.abstract(nodeValues);
			const upperBounds = UpperBoundsValueDomain.top();
			for(const nodeIdB of allNodeIds.values()) {
				if(nodeIdA === nodeIdB) {
					continue;
				}

				if(concrete.values().every(map => {
					const valueA = map.get(nodeIdA)?.interval;
					const valueB = map.get(nodeIdB)?.interval;

					return isNotUndefined(valueA) && isNotUndefined(valueB) && valueA <= valueB;
				})) {
					upperBounds.add(nodeIdB);
				}
			}
			const pentagon = new ClosedPentagonValueDomain({ interval: interval, upperBounds: upperBounds });
			result.set(nodeIdA, pentagon);
		}
		return result;
	}

	public static reduce(value: StateDomainLift<ClosedPentagonValueDomain>): StateDomainLift<ClosedPentagonValueDomain> {
		if(value === Bottom) {
			return Bottom;
		}

		for(const [key, pentagon] of value.entries()) {
			if(pentagon.value.interval.isBottom() || pentagon.value.upperBounds.isBottom()) {
				return Bottom;
			}

			// If there is a self reference in the upper bounds, remove it
			if(pentagon.value.upperBounds.has(key)) {
				const reducedPentagon = pentagon.create(pentagon.value);
				reducedPentagon.value.upperBounds.remove(key);
				(value as Map<NodeId, ClosedPentagonValueDomain>).set(key, reducedPentagon);
			}
		}

		return value;
	}
}