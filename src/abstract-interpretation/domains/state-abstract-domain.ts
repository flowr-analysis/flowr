import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from './abstract-domain';
import { MappedAbstractDomain } from './mapped-abstract-domain';

/**
 * A state abstract domain as mapping of AST node IDs of a program to abstract values of an abstract domain.
 * The Bottom element is defined as empty mapping and the Top element is defined as mapping every existing mapped AST node ID to Top.
 * @template Domain - Type of the abstract domain to map the AST node IDs to
 * @see {@link NodeId} for the node IDs of the AST nodes
 */
export class StateAbstractDomain<Domain extends AnyAbstractDomain> extends MappedAbstractDomain<NodeId, Domain> {
	public create(value: ReadonlyMap<NodeId, Domain>): this;
	public create(value: ReadonlyMap<NodeId, Domain>): StateAbstractDomain<Domain> {
		return new StateAbstractDomain(value);
	}

	public static bottom<Domain extends AnyAbstractDomain>(): StateAbstractDomain<Domain> {
		return new StateAbstractDomain(new Map<NodeId, Domain>());
	}
}

/**
 * The type of the value abstract domain of a state abstract domain (i.e. the abstract domain a state abstract domain maps to).
 * @template StateDomain - The state abstract domain to get the value abstract domain type for
 */
export type ValueAbstractDomain<StateDomain extends StateAbstractDomain<AnyAbstractDomain>> =
	StateDomain extends StateAbstractDomain<infer Domain> ? Domain : never;
