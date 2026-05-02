import { IntervalDomain } from '../domains/interval-domain';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ConcreteState, StateDomainBottom, StateDomainLift, StateDomainTop } from '../domains/state-abstract-domain';
import { StateAbstractDomain } from '../domains/state-abstract-domain';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';
import { Bottom, Top } from '../domains/lattice';
import { isNotUndefined, isUndefined } from '../../util/assert';
import { ClosedPentagonValueDomain } from './closed-pentagon-value-domain';

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
			const valueWithoutNodeItself = value.create(value.value);
			valueWithoutNodeItself.value.upperBounds.remove(node);
			super.set(node, valueWithoutNodeItself);
		}
	}

	public override get(node: NodeId): ClosedPentagonValueDomain | undefined {
		const value = super.get(node);
		if(isNotUndefined(value) && value.value.upperBounds.has(node)) {
			value.value.upperBounds.remove(node);
		}
		return value;
	}

	public override join(other: this): this {
		return this.create(super.join(other).value);
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

	private static reduce(value: StateDomainLift<ClosedPentagonValueDomain>): StateDomainLift<ClosedPentagonValueDomain> {
		if(value === Bottom || value.values().some((value) => value.value.interval.isBottom() || value.value.upperBounds.isBottom())) {
			return Bottom;
		}

		for(const [key, pentagon] of value.entries()) {
			const reducedPentagon = pentagon.create(pentagon.value);
			for(const [otherKey, otherPentagon] of value.entries()) {
				if(key === otherKey) {
					continue;
				}
				const keyInterval = pentagon.value.interval;
				const otherKeyInterval = otherPentagon.value.interval;
				if(keyInterval.isValue() && otherKeyInterval.isValue() && keyInterval.value[1] <= otherKeyInterval.value[0]) {
					reducedPentagon.value.upperBounds.add(otherKey);
				}
			}

			if(reducedPentagon.value.upperBounds.has(key)) {
				reducedPentagon.value.upperBounds.remove(key);
			}

			(value as Map<NodeId, ClosedPentagonValueDomain>).set(key, reducedPentagon);
		}

		return value;
	}
}