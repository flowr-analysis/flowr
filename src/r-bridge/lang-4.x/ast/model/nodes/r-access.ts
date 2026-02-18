import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RArgument, RUnnamedArgument } from './r-argument';
import type { EmptyArgument } from './r-function-call';

/**
 * Represents an R Indexing operation with `$`, `@`, `[[`, or `[`.
 */
interface RAccessBase<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type: RType.Access;
	/** the accessed container/variable/expression */
	accessed:      RNode<Info>;
	operator:      '[' | '[[' | '$' | '@';
}

/**
 * Represents an R named access operation with `$` or `@`, the field is a string.
 */
export interface RNamedAccess<Info = NoInfo> extends RAccessBase<Info> {
	operator: '$' | '@';
	access:   [RUnnamedArgument<Info>];
}

/** access can be a number, a variable or an expression that resolves to one, a filter etc. */
export interface RIndexAccess<Info = NoInfo> extends RAccessBase<Info> {
	operator: '[' | '[[';
	/** is null if the access is empty, e.g. `a[,3]` */
	access:   readonly (RArgument<Info> | typeof EmptyArgument)[]
}

export type RAccess<Info = NoInfo> = RNamedAccess<Info> | RIndexAccess<Info>;

/**
 * Helper for working with {@link RAccess} AST nodes.
 */
export const RAccess = {
	/**
	 * Type guard for {@link RAccess} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RAccess<Info> {
		return node?.type === RType.Access;
	},
	/**
	 * Type guard for {@link RNamedAccess} nodes.
	 */
	isNamed<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RNamedAccess<Info> {
		return RAccess.is(node) && (node.operator === '$' || node.operator === '@');
	},
	/**
	 * Type guard for {@link RIndexAccess} nodes.
	 */
	isIndex<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RIndexAccess<Info> {
		return RAccess.is(node) && (node.operator === '[' || node.operator === '[[');
	}
} as const;