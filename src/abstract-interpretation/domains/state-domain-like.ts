import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type AnyAbstractDomain } from './abstract-domain';

/**
 * An interface for state-like domains that store abstract values for AST nodes.
 */
export interface StateDomainLike<Domain extends AnyAbstractDomain> {
	/**
	 * The underlying value domain of the state domain.
	 */
	get domain(): Domain;

	/**
	 * Gets the inferred abstract value for an AST node ID.
	 */
	get(node: NodeId): Domain | undefined;

	/**
	 * Checks whether the state domain has an inferred value for an AST node ID.
	 */
	has(node: NodeId): boolean;

	/**
	 * Removes the inferred value for an AST node ID from the state domain.
	 */
	remove(node: NodeId): void;

	/**
	 * Sets the inferred value for an AST node ID from the state domain.
	 */
	set(node: NodeId, value: Domain): void;
}

/**
 * A type representing any state abstract domain that stores abstract values for AST nodes.
 */
export type AnyStateDomain<Domain extends AnyAbstractDomain> = AnyAbstractDomain & StateDomainLike<Domain>;

/**
 * The type of the value abstract domain of a state abstract domain.
 * @template StateDomain - The state abstract domain to get the value abstract domain type for
 */
export type ValueDomain<StateDomain extends AnyStateDomain<AnyAbstractDomain>> =
	StateDomain extends AnyStateDomain<infer Domain> ? Domain : never;
