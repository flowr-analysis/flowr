import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import { NamedAccessOperators } from '../../../../../dataflow/environments/built-in-kinds';
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
 * @helper ast
 */
export const RAccess = {
	...RNode,
	name: 'RAccess',
	/**
	 * Type guard for {@link RAccess} nodes.
	 * @lintIgnore node-is node-is-optional
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RAccess<Info> {
		return node?.type === RType.Access;
	},
	/**
	 * Type guard for {@link RNamedAccess} nodes.
	 */
	isNamed<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RNamedAccess<Info> {
		return RAccess.is(node) && RAccess.isNamedOperator(node.operator);
	},
	/**
	 * Type guard for {@link RIndexAccess} nodes.
	 */
	isIndex<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RIndexAccess<Info> {
		return RAccess.is(node) && !RAccess.isNamedOperator(node.operator);
	},
	/**
	 * The operators that access by name (`x$name`, `x@name`) rather than by index (`x[i]`, `x[[i]]`).
	 * This is the one place that distinguishes them; use {@link RAccess.isNamedOperator} or {@link RAccess.isNamed}.
	 * Spread it where you need a mutable list, as it is read-only.
	 * @example
	 * ```ts
	 * const replacementNames: string[] = [...RAccess.namedOperators]; // ['$', '@']
	 * ```
	 */
	namedOperators: NamedAccessOperators,
	/**
	 * Whether `operator` accesses by name, see {@link RAccess.namedOperators}. Use it for the operator string, and
	 * {@link RAccess.isNamed} if you hold a node, since the latter narrows the node.
	 * @example
	 * ```ts
	 * RAccess.isNamedOperator('$');  // true
	 * RAccess.isNamedOperator('[['); // false
	 * ```
	 */
	isNamedOperator(this: void, operator: string): operator is RNamedAccess['operator'] {
		return (RAccess.namedOperators as readonly string[]).includes(operator);
	}
} as const;