import type { RAstNodeBase, Location, NoInfo, RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { RArgument } from './r-argument';

export const EmptyArgument = '<>';

export type RFunctionArgument<Info = NoInfo> = RArgument<Info> | typeof EmptyArgument;

/**
 * Calls of functions like `a()` and `foo(42, "hello")`.
 * @see RUnnamedFunctionCall
 */
export interface RNamedFunctionCall<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type:      RType.FunctionCall;
	readonly named:     true;
	functionName:       RSymbol<Info>;
	/** arguments can be empty, for example when calling as `a(1, ,3)` */
	readonly arguments: readonly RFunctionArgument<Info>[];
}


/**
 * Direct calls of functions like `(function(x) { x })(3)`.
 * @see RNamedFunctionCall
 */
export interface RUnnamedFunctionCall<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type:      RType.FunctionCall;
	readonly named:     false | undefined;
	calledFunction:     RNode<Info>; /* can be either a function definition or another call that returns a function etc. */
	/** marks function calls like `3 %xx% 4` which have been written in special infix notation; deprecated in v2 */
	infixSpecial?:      boolean;
	/** arguments can be undefined, for example when calling as `a(1, ,3)` */
	readonly arguments: readonly RFunctionArgument<Info>[];
}

export type RFunctionCall<Info = NoInfo> = RNamedFunctionCall<Info> | RUnnamedFunctionCall<Info>;

/**
 * Helper for working with {@link RFunctionCall} AST nodes.
 */
export const RFunctionCall = {
	name: 'RFunctionCall',
	/**
	 * Type guard for {@link RFunctionCall} nodes.
	 */
	is<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RFunctionCall<Info> {
		return node?.type === RType.FunctionCall;
	},
	/**
	 * Type guard for {@link RNamedFunctionCall} nodes.
	 */
	isNamed<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RNamedFunctionCall<Info> {
		return RFunctionCall.is(node) && node.named === true;
	},
	/**
	 * Type guard for {@link RUnnamedFunctionCall} nodes.
	 */
	isUnnamed<Info = NoInfo>(this: void, node: RNode<Info> | undefined): node is RUnnamedFunctionCall<Info> {
		return RFunctionCall.is(node) && !node.named;
	}
} as const;