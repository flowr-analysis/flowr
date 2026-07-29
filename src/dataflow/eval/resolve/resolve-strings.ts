import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNamedFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { Identifier } from '../../environments/identifier';
import { Top, type Value } from '../values/r-value';
import { stringFrom } from '../values/string/string-constants';
import { intervalFrom } from '../values/intervals/interval-constants';
import { resolveIdToSingleString } from './alias-tracking';

/** the string-joining builtins {@link foldPasteCall} folds: their default separator and the argument overriding it */
export const PasteLikeCalls = {
	paste:       { sep: ' ', sepArg: 'sep' },
	paste0:      { sep: '', sepArg: 'sep' },
	'file.path': { sep: '/', sepArg: 'fsep' }
} as const satisfies Record<string, { sep: string, sepArg: string }>;

/**
 * Resolves a `paste`/`paste0`/`file.path` call to a {@link Value} string when every non-separator/`collapse` argument
 * resolves to a single string constant (e.g. `paste0("cfg_", k)` with `k` a known string); any unresolved part yields Top.
 */
export function resolveAsPaste(args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	if(node.type !== RType.FunctionCall || !node.named) {
		return Top;
	}
	const folded = foldPasteCall(node, arg => resolveIdToSingleString(arg.info.id, args));
	return folded === undefined ? Top : stringFrom(folded);
}

/**
 * Folds a named {@link PasteLikeCalls} call to its concatenated string, resolving each non-separator/`collapse` argument
 * via `resolveArg`; the separator defaults per call and is overridden by a resolvable `sep=`/`fsep=`. `undefined` if any
 * part (or the separator) does not resolve. Shared by the value solver ({@link resolveAsPaste}) and construction-time name resolution.
 */
export function foldPasteCall<Info>(node: RNamedFunctionCall<Info>, resolveArg: (arg: RNode<Info>) => string | undefined): string | undefined {
	const known = PasteLikeCalls[Identifier.getName(node.functionName.content) as keyof typeof PasteLikeCalls];
	if(known === undefined) {
		return undefined;
	}
	let sep: string = known.sep;
	const parts: string[] = [];
	for(const arg of node.arguments) {
		if(arg === EmptyArgument || arg.value === undefined) {
			continue;
		}
		const argName = arg.name?.content;
		if(argName === 'collapse') {
			continue;
		} else if(argName === known.sepArg) {
			const s = resolveArg(arg.value);
			if(s === undefined) {
				return undefined;
			}
			sep = s;
			continue;
		}
		const part = resolveArg(arg.value);
		if(part === undefined) {
			return undefined;
		}
		parts.push(part);
	}
	return parts.join(sep);
}

/** everything after the last separator, with trailing separators dropped first (`a/b/` is `b`, `/` is the empty string) */
function basename(path: string): string {
	const trimmed = path.replace(/\/+$/, '');
	return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/** everything before the last separator, `.` if there is none and `/` if only the root remains */
function dirname(path: string): string {
	if(path === '') {
		return '';
	}
	const trimmed = path.length > 1 ? path.replace(/(?<=.)\/+$/, '') : path;
	const cut = trimmed.lastIndexOf('/');
	if(cut < 0) {
		return '.';
	}
	const head = trimmed.slice(0, cut).replace(/\/+$/, '');
	return head === '' ? '/' : head;
}

/** the one-string-argument builtins {@link resolveAsStringFn} folds, together with the name R gives that argument */
const StringFns = {
	basename: { arg: 'path', fold: basename },
	dirname:  { arg: 'path', fold: dirname },
	toupper:  { arg: 'x', fold: (s: string) => s.toUpperCase() },
	tolower:  { arg: 'x', fold: (s: string) => s.toLowerCase() },
	trimws:   { arg: 'x', fold: (s: string) => s.trim() },
	/** R counts characters, so we count code points rather than UTF-16 units */
	nchar:    { arg: 'x', fold: (s: string) => [...s].length }
} as const satisfies Record<string, { arg: string, fold: (s: string) => string | number }>;

/**
 * Resolves a {@link StringFns} call to a {@link Value} if its argument resolves to a single string constant; Top otherwise.
 * `basename`/`dirname` only take `/` as a separator, so a Windows-style path is left to its non-`\` parts.
 */
export function resolveAsStringFn(args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	/* a further argument changes what these do (`nchar(x, 'bytes')`, `trimws(x, 'left')`), so we only fold the plain call */
	if(node.type !== RType.FunctionCall || !node.named || node.arguments.length !== 1) {
		return Top;
	}
	const [arg] = node.arguments;
	const known = StringFns[Identifier.getName(node.functionName.content) as keyof typeof StringFns];
	if(known === undefined || arg === EmptyArgument || arg.value === undefined || (arg.name !== undefined && arg.name.content !== known.arg)) {
		return Top;
	}
	const str = resolveIdToSingleString(arg.value.info.id, args);
	/* we see the source text of a string, in which an escape like `\t` is still two characters we must not touch */
	if(str === undefined || str.includes('\\')) {
		return Top;
	}
	const folded = known.fold(str);
	return typeof folded === 'number' ? intervalFrom(folded, folded) : stringFrom(folded);
}
