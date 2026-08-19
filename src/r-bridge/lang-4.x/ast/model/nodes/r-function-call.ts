import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { RArgument } from './r-argument';
import { matchArgumentsToParameters } from '../../../../../util/arg-matching';

export const EmptyArgument = '<>';

export type PotentiallyEmptyRArgument<Info = NoInfo> = RArgument<Info> | typeof EmptyArgument;

/**
 * Calls of functions like `a()` and `foo(42, "hello")`.
 * @see RUnnamedFunctionCall
 */
export interface RNamedFunctionCall<Info = NoInfo> extends RAstNodeBase<Info>, Location {
	readonly type:      RType.FunctionCall;
	readonly named:     true;
	functionName:       RSymbol<Info>;
	/** arguments can be empty, for example when calling as `a(1, ,3)` */
	readonly arguments: readonly PotentiallyEmptyRArgument<Info>[];
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
	readonly arguments: readonly PotentiallyEmptyRArgument<Info>[];
}

export type RFunctionCall<Info = NoInfo> = RNamedFunctionCall<Info> | RUnnamedFunctionCall<Info>;

/**
 * Helper for working with {@link RFunctionCall} AST nodes.
 */
export const RFunctionCall = {
	...RNode,
	name: 'RFunctionCall',
	/**
	 * Type guard for {@link RFunctionCall} nodes.
	 * @lintIgnore node-is node-is-optional
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
	},
	/**
	 * Bind a call's `arguments` to the formal `paramNames` with {@link matchArgumentsToParameters}, R's argument
	 * matching. Returns a map from parameter name to the argument bound to it, so
	 * `matchArgsToParams(call.arguments, names).get('X')` answers "which argument is mapped to parameter `X`".
	 * An empty argument (`f(1, ,3)`) takes its formal but never appears in the map, as there is nothing to bind.
	 */
	matchArgsToParams<Info = NoInfo>(this: void, args: readonly PotentiallyEmptyRArgument<Info>[], paramNames: readonly string[]): ReadonlyMap<string, RArgument<Info>> {
		const matched = matchArgumentsToParameters(args.map(a => a === EmptyArgument ? undefined : a.name?.content), paramNames);
		const bound = new Map<string, RArgument<Info>>();
		for(let i = 0; i < args.length; i++) {
			const arg = args[i], param = matched[i];
			if(arg !== EmptyArgument && param !== undefined) {
				bound.set(paramNames[param], arg);
			}
		}
		return bound;
	},
	/** The one argument a call was given, `undefined` unless there is exactly one and it is not empty. */
	soleArgument<Info = NoInfo>(this: void, args: readonly PotentiallyEmptyRArgument<Info>[]): RArgument<Info> | undefined {
		return args.length === 1 && args[0] !== EmptyArgument ? args[0] : undefined;
	}
} as const;