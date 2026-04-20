import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type AnyAbstractDomain } from './abstract-domain';

/**
 * An interface for state-like domains that store abstract values for AST nodes.
 */
export interface StateDomainLike<Domain extends AnyAbstractDomain> {
	get(node: NodeId): Domain | undefined;
	has(node: NodeId): boolean;
	remove(node: NodeId): void;
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
