import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Bottom, Top } from '../../domains/lattice';
import { isNotUndefined } from '../../../util/assert';
import type {
	ConcreteState,
	StateDomainLift,
	StateDomainTop,
	StateDomainValue
} from '../../domains/state-abstract-domain';
import { StateAbstractDomain } from '../../domains/state-abstract-domain';
import { UpperBoundsValueDomain } from './upper-bounds-value-domain';

export class UpperBoundsDomain extends StateAbstractDomain<UpperBoundsValueDomain> {
	constructor(value: StateDomainLift<UpperBoundsValueDomain>) {
		// Assure that we do not have a mapping id => {id}
		if(value !== Bottom) {
			const newValue = new Map(value);
			for(const [node, upperBounds] of newValue.entries()) {
				if(upperBounds.has(node)) {
					upperBounds.remove(node);
				}
			}
			super(newValue, UpperBoundsValueDomain.top());
		} else {
			super(Bottom, UpperBoundsValueDomain.top());
		}
	}

	public override set(node: NodeId, value: UpperBoundsValueDomain) {
		if(this._value !== Bottom) {
			const valueWithoutNodeItself = value.create(value.value);
			valueWithoutNodeItself.remove(node);
			(this._value as Map<NodeId, UpperBoundsValueDomain>).set(node, valueWithoutNodeItself);
		}
	}

	public override get(node: NodeId): UpperBoundsValueDomain | undefined {
		if(this._value === Bottom) {
			return this.domain.bottom();
		}
		const value = this._value.get(node);
		if(isNotUndefined(value) && value.has(node)) {
			value.remove(node);
		}
		return value;
	}

	public override narrow(_other: this): this {
		throw new Error('Not Implemented');
	}

	public override concretize(_limit: number): ReadonlySet<ConcreteState<UpperBoundsValueDomain>> | typeof Top {
		if(this.value === Bottom) {
			return new Set();
		}
		return Top;
	}

	public override abstract(concrete: ReadonlySet<ConcreteState<UpperBoundsValueDomain>> | typeof Top): this {
		if(concrete === Top) {
			return this.top();
		}
		if(concrete.size === 0) {
			return this.bottom();
		}
		const allNodeIds = new Set<NodeId>();
		for(const map of concrete.values()) {
			for(const key of map.keys()) {
				allNodeIds.add(key);
			}
		}
		const result = this.top() as this & StateAbstractDomain<UpperBoundsValueDomain, StateDomainValue<UpperBoundsValueDomain>>;

		for(const nodeIdA of allNodeIds.values()) {
			for(const nodeIdB of allNodeIds.values()) {
				if(nodeIdA === nodeIdB){
					continue;
				}

				if(concrete.values().every(map => {
					const valueA = map.get(nodeIdA);
					const valueB = map.get(nodeIdB);

					if(typeof valueA === 'number' && typeof valueB === 'number') {
						return isNotUndefined(valueA) && isNotUndefined(valueB) && valueA <= valueB;
					}
					return false;
				})) {
					const currentValue = result.get(nodeIdA) ?? UpperBoundsValueDomain.top();
					currentValue.add(nodeIdB);
				}
			}
		}
		return result;
	}

	public override isTop(): this is this & StateAbstractDomain<UpperBoundsValueDomain, StateDomainTop> {
		return this.value !== Bottom && this.value.entries().every(([key, value]) => value.isValue() && (value.value.size === 0 || (value.value.size === 1 && value.has(key))));
	}
}