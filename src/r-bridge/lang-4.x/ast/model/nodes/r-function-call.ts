import type { RAstNodeBase, Location, NoInfo } from '../model';
import { RNode } from '../model';
import { RType } from '../type';
import type { RSymbol } from './r-symbol';
import type { RArgument } from './r-argument';
import { findByPrefixIfUnique } from '../../../../../util/prefix';

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
	 * Bind a call's `arguments` to the formal `paramNames` using R's argument matching rules
	 * (see https://cran.r-project.org/doc/manuals/R-lang.html#Argument-matching): exact name, then partial
	 * (`pmatch`, unique-prefix) name, then the remaining unnamed arguments filling the remaining formals
	 * left-to-right. Returns a map from parameter name to the argument bound to it, so
	 * `matchArgumentsToParameters(call.arguments, names).get('X')` answers "which argument is mapped to
	 * parameter `X`". Pass `paramNames` as the full formal list **excluding `...`** so ambiguous prefixes are
	 * rejected; this makes it exact when the signature is known (e.g. from the signature database).
	 */
	matchArgsToParams<Info = NoInfo>(this: void, args: readonly PotentiallyEmptyRArgument<Info>[], paramNames: readonly string[]): ReadonlyMap<string, PotentiallyEmptyRArgument<Info>> {
		const bound = new Map<string, PotentiallyEmptyRArgument<Info>>();
		const used = new Set<number>();
		// pass 1: exact name matches
		for(let i = 0; i < args.length; i++) {
			const arg = args[i];
			if(arg === EmptyArgument || arg.name === undefined) {
				continue;
			}
			const n = arg.name.content as string;
			if(paramNames.includes(n) && !bound.has(n)) {
				bound.set(n, arg);
				used.add(i);
			}
		}
		// pass 2: partial (pmatch) name matches on the still-unbound named arguments
		for(let i = 0; i < args.length; i++) {
			const arg = args[i];
			if(used.has(i) || arg === EmptyArgument || arg.name === undefined) {
				continue;
			}
			const matched = findByPrefixIfUnique(arg.name.content as string, paramNames);
			if(matched !== undefined && !bound.has(matched)) {
				bound.set(matched, arg);
				used.add(i);
			}
		}
		// pass 3: remaining unnamed args fill the remaining formals left-to-right
		let formalIdx = 0;
		for(let i = 0; i < args.length; i++) {
			const arg = args[i];
			if(used.has(i) || arg === EmptyArgument || arg.name !== undefined) {
				continue;
			}
			while(formalIdx < paramNames.length && bound.has(paramNames[formalIdx])) {
				formalIdx++;
			}
			if(formalIdx < paramNames.length) {
				bound.set(paramNames[formalIdx], arg);
				used.add(i);
				formalIdx++;
			}
		}
		return bound;
	}
} as const;