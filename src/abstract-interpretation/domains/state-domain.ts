import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from './abstract-domain';

/**
 * An interface for state-like domains that store abstract values for AST nodes.
 */
export interface StateDomain<Domain extends AnyAbstractDomain = AnyAbstractDomain> {
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

	/**
	 * Returns all node-value pairs of the state domain.
	 */
	entries(): readonly [NodeId, Domain][];

	/**
	 * Whether the state is Bottom.
	 */
	isBottom(): boolean;
}

/**
 * The type of the value abstract domain of a state abstract domain.
 * @template StateDomain - The state abstract domain to get the value abstract domain type for
 */
export type ValueDomain<Domain extends StateDomain> =
	Domain extends StateDomain<infer ValueDomain> ? ValueDomain : never;
