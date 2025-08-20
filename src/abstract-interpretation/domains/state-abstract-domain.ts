import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbstractDomain, ConcreteDomain } from './abstract-domain';
import { DEFAULT_INFERENCE_LIMIT } from './abstract-domain';
import { Top } from './lattice';

/** The type of the abstract state for a abstract domain mapping AST node IDs to abstract values of an abstract domain */
export type AbstractState<Domain extends AbstractDomain<unknown, unknown, unknown, unknown>> = Map<NodeId, Domain>;

/** The type of the concrete state for the concrete domain of an abstract domain mapping AST node IDs to a concrete value in the concrete domain */
export type ConcreteState<Domain extends AbstractDomain<unknown, unknown, unknown, unknown>> = ReadonlyMap<NodeId, ConcreteDomain<Domain>>;

/**
 * A state abstract domain as mapping of AST node IDs of a program to abstract values of an abstract domain.
 * The Bottom element is defined as empty mapping and the Top element is defined as mapping every existing mapped AST node ID to Top.
 * @template Domain - Type of the abstract domain to map the AST node IDs to
 * @see {@link NodeId} for the node IDs of the AST nodes
 */
export class StateAbstractDomain<Domain extends AbstractDomain<unknown, unknown, unknown, unknown>>
implements AbstractDomain<ConcreteState<Domain>, AbstractState<Domain>, AbstractState<Domain>, AbstractState<Domain>> {
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
			for(const [nodeId] of result.value) {
				if(!other.value.has(nodeId)) {
					result.value.delete(nodeId);
				}
			}
			for(const [nodeId, value] of other.value) {
				const currValue = result.value.get(nodeId);

				if(currValue !== undefined) {
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

	public narrow(other: StateAbstractDomain<Domain>): StateAbstractDomain<Domain> {
		const result = new StateAbstractDomain(this.value);

		for(const [nodeId] of this.value) {
			if(!other.value.has(nodeId)) {
				result.value.delete(nodeId);
			}
		}
		for(const [nodeId, value] of other.value) {
			const currValue = result.value.get(nodeId);

			if(currValue !== undefined) {
				result.value.set(nodeId, currValue.narrow(value) as Domain);
			}
		}
		return result;
	}

	public concretize(limit: number = DEFAULT_INFERENCE_LIMIT): ReadonlySet<ConcreteState<Domain>> | typeof Top {
		if(this.value.values().some(value => value.isBottom())) {
			return new Set();
		}
		let states = new Set<ConcreteState<Domain>>([new Map()]);

		for(const [nodeId, value] of this.value) {
			const concreteValues = value.concretize(limit);

			if(concreteValues === Top) {
				return Top;
			}
			const newStates = new Set<ConcreteState<Domain>>();

			for(const state of states) {
				for(const concrete of concreteValues) {
					if(newStates.size > limit) {
						return Top;
					}
					const map = new Map(state);
					map.set(nodeId, concrete as ConcreteDomain<Domain>);
					newStates.add(map);
				}
			}
			states = newStates;
		}
		return states;
	}

	public abstract(concrete: ReadonlySet<ConcreteState<Domain>> | typeof Top): StateAbstractDomain<Domain> {
		const entry = [...this.value.values()][0];

		if(concrete === Top || entry === undefined) {
			return new StateAbstractDomain(new Map<NodeId, Domain>());
		}
		const mappings = new Map<NodeId, Set<ConcreteDomain<Domain>>>();

		for(const state of concrete) {
			for(const [nodeId, value] of state) {
				const mapping = mappings.get(nodeId);

				if(mapping === undefined) {
					mappings.set(nodeId, new Set([value]));
				} else {
					mapping.add(value);
				}
			}
		}
		const result = new Map<NodeId, Domain>();

		for(const [nodeId, values] of mappings) {
			result.set(nodeId, entry.abstract(values) as Domain);
		}
		return new StateAbstractDomain(result);
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
		return true;
	}
}
