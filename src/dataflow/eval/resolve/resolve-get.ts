import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { Identifier, PkgName } from '../../environments/identifier';
import { Top, type Value } from '../values/r-value';
import { matchCallArguments } from './match-arguments';
import { Resolve } from '../../environments/resolve-helper';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { trackAliasInEnvironments } from './alias-tracking';

/** one entry of the {@link GetFns} registry: R's parameter order */
export interface GetFn {
	/** parameter names in R's order; the first names what is looked up */
	readonly params: readonly string[];
}

/**
 * By-name lookups the value solver folds. Only the name may be given; any other arg means {@link Top}.
 * `mget` is excluded: it returns a list, which the value domain cannot state.
 * They are all declared by {@link PkgName.Base}, so a same-named function elsewhere does not fold.
 */
export const GetFns = {
	get:         { params: ['x', 'pos', 'envir', 'mode', 'inherits'] },
	get0:        { params: ['x', 'envir', 'mode', 'inherits', 'ifnotfound'] },
	'match.fun': { params: ['FUN', 'descend'] }
} as const satisfies Record<string, GetFn>;

/**
 * Folds a by-name lookup like `get("x")` to what that name holds; unresolved stays {@link Top}.
 * Wired into {@link BuiltInEvalHandlerMapper}.
 */
export function resolveAsGet(this: void, args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	const environment = args.environment;
	if(!RFunctionCall.is(node) || !node.named || environment === undefined) {
		return Top;
	}
	const known = GetFns[Identifier.getName(node.functionName.content) as keyof typeof GetFns] as GetFn | undefined;
	if(known === undefined) {
		return Top;
	}
	/* `mypkg::get` is not `base::get`; a bare call has already been resolved */
	const ns = Identifier.getNamespace(node.functionName.content);
	if(ns !== undefined && ns !== PkgName.Base) {
		return Top;
	}
	const matched = matchCallArguments(node, known.params);
	if(matched === undefined || matched[0] === undefined || matched.some((m, at) => at > 0 && m !== undefined)) {
		return Top;
	}
	const name = Resolve.toSingleString((matched[0] as RNodeWithParent).info.id, args);
	if(name === undefined) {
		return Top;
	}
	/* the set the tracked name folds to is flattened into the one the caller wraps this in */
	return trackAliasInEnvironments(name, environment, args);
}
