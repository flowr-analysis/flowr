import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractDomain } from './abstract-domain';

type AbstractState<Domain> = Map<NodeId, Domain>;

export class StateAbstractDomain<Domain extends AbstractDomain<unknown, unknown, unknown>>
implements AbstractDomain<AbstractState<Domain>, AbstractState<Domain>, AbstractState<Domain>> {
	private _value: AbstractState<Domain>;

	constructor(value: AbstractState<Domain>) {
		this._value = new Map(value);
	}

	public get value(): AbstractState<Domain> {
		return this._value;
	}

	public bottom(): StateAbstractDomain<Domain> {
		return new StateAbstractDomain(new Map<NodeId, Domain>());
	}

	public top(): StateAbstractDomain<Domain> {
		const result = new StateAbstractDomain(this.value);

		for(const [key, value] of result.value) {
			result._value.set(key, value.top() as Domain);
		}
		return result;
	}

	public equals(other: StateAbstractDomain<Domain>): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value.size !== other.value.size) {
			return false;
		}
		for(const [nodeId, value] of this.value) {
			const otherValue = other.value.get(nodeId);
			if(otherValue === undefined || !value.equals(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public leq(other: StateAbstractDomain<Domain>): boolean {
		if(this.value === other.value) {
			return true;
		} else if(this.value.size !== other.value.size) {
			return false;
		}
		for(const [nodeId, value] of this.value) {
			const otherValue = other.value.get(nodeId);
			if(otherValue === undefined || !value.leq(otherValue)) {
				return false;
			}
		}
		return true;
	}

	public join(...values: StateAbstractDomain<Domain>[]): StateAbstractDomain<Domain> {
		const result = new StateAbstractDomain(this.value);

		for(const other of values) {
			for(const [nodeId, value] of other.value) {
				const currValue = result.value.get(nodeId);
				if(currValue === undefined) {
					result.value.set(nodeId, value);
				} else {
					result.value.set(nodeId, currValue.join(value) as Domain);
				}
			}
		}
		return result;
	}

	public meet(...values: StateAbstractDomain<Domain>[]): StateAbstractDomain<Domain> {
		const result = new StateAbstractDomain(this.value);

		for(const other of values) {
			for(const [nodeId, value] of other.value) {
				const currValue = result.value.get(nodeId);
				if(currValue === undefined) {
					result.value.set(nodeId, value);
				} else {
					result.value.set(nodeId, currValue.meet(value) as Domain);
				}
			}
		}
		return result;
	}

	public widen(other: StateAbstractDomain<Domain>): StateAbstractDomain<Domain> {
		const result = new StateAbstractDomain(this.value);

		for(const [nodeId, value] of other.value) {
			const currValue = result.value.get(nodeId);
			if(currValue === undefined) {
				result.value.set(nodeId, value);
			} else {
				result.value.set(nodeId, currValue.widen(value) as Domain);
			}
		}
		return result;
	}

	public toString(): string {
		return '(' + this.value.entries().toArray().map(([key, value]) => `${key} -> ${value.toString()}`).join(', ') + ')';
	}

	public isTop(): this is StateAbstractDomain<Domain> {
		return this.value.values().every(value => value.isTop());
	}

	public isBottom(): this is StateAbstractDomain<Domain> {
		return this.value.size === 0;
	}

	public isValue(): this is StateAbstractDomain<Domain> {
		return !this.isTop() && !(this as StateAbstractDomain<Domain>).isBottom();
	}
}
