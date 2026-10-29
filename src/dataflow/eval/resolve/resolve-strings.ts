import type { RNamedFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { BuiltInEvalHandlerArgs } from '../../environments/built-in';
import { Identifier, PkgName } from '../../environments/identifier';
import { isValue, RValue, Top, type Value } from '../values/r-value';
import { setOf } from '../values/sets/set-constants';
import { stringFrom } from '../values/string/string-constants';
import { intervalFrom } from '../values/intervals/interval-constants';
import { matchCallArguments } from './match-arguments';
import { RFunctionCall } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { NodeValue } from './node-value';

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

/**
 * One entry of the {@link StringFns} registry: the parameters R declares, in order, and how to fold them.
 *
 * `fold` receives them in that order, so a parameter R gives a default is an optional parameter of `fold`,
 * and a `...` parameter arrives as the array of everything it collected. Whatever `fold` cannot answer it
 * returns `undefined` for, which keeps the call `Top`.
 */
export interface StringFn {
	/** the package declaring it, so another package's function of that name does not fold */
	readonly pkg:       PkgName;
	/** the parameter names, in the order R declares them; `...` collects the arguments naming no other parameter */
	readonly params:    readonly string[];
	/** what a parameter R gives a default stands for, so `paste(a, b)` folds like `paste(a, b, sep = ' ')` */
	readonly defaults?: Readonly<Record<string, string>>;
	/** parameters a call may supply that change nothing for the single strings we fold, like `paste`'s `collapse` */
	readonly ignored?:  readonly string[];
	/** the fold over the supplied arguments, in declaration order */
	/* a method, so each entry may type its own parameters */
	fold(...args: unknown[]): string | number | undefined;
}

/** `sprintf` with only `%s`, `%d` (or `%i`) and `%%` in its format and one argument for each, `undefined` for anything else (a width, a precision, another conversion) */
function format(fmt: string, parts: readonly string[]): string | undefined {
	let next = 0;
	let failed = false;
	const formatted = fmt.replace(/%(.)/g, (_, conversion: string) => {
		if(conversion === '%') {
			return '%';
		}
		const part = parts[next++];
		failed ||= part === undefined || (conversion !== 's' && !(/[di]/.test(conversion) && /^-?\d+$/.test(part)));
		return part ?? '';
	});
	return failed || next !== parts.length || fmt.replaceAll('%%', '').endsWith('%') ? undefined : formatted;
}

/**
 * Every string built-in the value solver folds, the joining ones included: `paste` is an entry like `toupper`
 * is, and both are reached through {@link resolveAsStringFn}. Teaching flowR one more is a line here plus the
 * matching `evalHandler` in the built-in configuration -- a test checks that the two agree.
 *
 * An entry with a `...` parameter joins what it collected, which is why its separator is just another
 * parameter with a default. The rest take a fixed number of arguments under the names R documents.
 */
export const StringFns = {
	/* the joining calls, which differ only in their separator and what the argument overriding it is called */
	paste:       { pkg: PkgName.Base, params: ['...', 'sep'], defaults: { sep: ' ' }, ignored: ['collapse'], fold: (parts: string[], sep: string) => parts.join(sep) },
	paste0:      { pkg: PkgName.Base, params: ['...', 'sep'], defaults: { sep: '' }, ignored: ['collapse'], fold: (parts: string[], sep: string) => parts.join(sep) },
	'file.path': { pkg: PkgName.Base, params: ['...', 'fsep'], defaults: { fsep: '/' }, fold: (parts: string[], fsep: string) => parts.join(fsep) },
	sprintf:     { pkg: PkgName.Base, params: ['fmt', '...'], fold: (fmt: string, parts: string[] = []) => format(fmt, parts) },
	/* the project root stays implicit, so the fold yields the path below it */
	here:        { pkg: PkgName.Here, params: ['...'], fold: (parts: string[]) => parts.length > 0 ? parts.join('/') : '.' },
	/* the path splits, which only ever treat `/` as a separator, so a Windows path keeps its non-`\` parts */
	basename:    { pkg: PkgName.Base, params: ['path'], fold: basename },
	dirname:     { pkg: PkgName.Base, params: ['path'], fold: dirname },
	/* whole-string transformations */
	toupper:     { pkg: PkgName.Base, params: ['x'], fold: (s: string) => s.toUpperCase() },
	tolower:     { pkg: PkgName.Base, params: ['x'], fold: (s: string) => s.toLowerCase() },
	trimws:      { pkg: PkgName.Base, params: ['x'], fold: (s: string) => s.trim() },
	/** R counts characters, so we count code points rather than UTF-16 units */
	nchar:       { pkg: PkgName.Base, params: ['x'], fold: (s: string) => [...s].length }
} as const satisfies Record<string, StringFn>;

/** the entries that join what they are handed, the ones a name at construction time may be built from */
export const PasteLikeCalls: ReadonlySet<string> =
	new Set(Object.entries(StringFns as Record<string, StringFn>).filter(([, fn]) => fn.params.includes('...')).map(([name]) => name));

/**
 * Folds a named {@link StringFns} call to its result, resolving each argument with `resolveArg`. `undefined`
 * when the name is not one of them, an argument does not resolve, or the call does not match what the entry
 * declares. Shared by the value solver ({@link resolveAsStringFn}) and construction-time name resolution.
 */
function foldStringCall<Info>(this: void, node: RNamedFunctionCall<Info>, resolveArg: (arg: RNode<Info>) => string | undefined): string | number | undefined {
	const known = StringFns[Identifier.getName(node.functionName.content) as keyof typeof StringFns] as StringFn | undefined;
	if(known === undefined) {
		return undefined;
	}
	/* `dplyr::paste` is not `base::paste`; a bare call has already been resolved */
	const ns = Identifier.getNamespace(node.functionName.content);
	if(ns !== undefined && ns !== known.pkg) {
		return undefined;
	}
	const matched = matchCallArguments(node as unknown as RNodeWithParent, known.params, known.ignored);
	if(matched === undefined) {
		return undefined;
	}
	const args: (string | string[])[] = [];
	for(const [at, slot] of matched.entries()) {
		if(Array.isArray(slot)) {
			const parts = (slot as readonly RNode<Info>[]).map(resolveArg);
			if(parts.includes(undefined)) {
				return undefined;
			}
			args.push(parts as string[]);
			continue;
		}
		if(slot === undefined) {
			const fallback = known.defaults?.[known.params[at]];
			if(fallback === undefined) {
				break;   // the parameters R gives a default are the trailing ones, so the fold sees a shorter prefix
			}
			args.push(fallback);
			continue;
		}
		// the argument *was* given, so failing to resolve it means we do not know the result, defaults do not apply
		const value = resolveArg(slot as RNode<Info>);
		if(value === undefined) {
			return undefined;
		}
		args.push(value);
	}
	return args.length > 0 ? known.fold(...args) : undefined;
}

/** the string a single value stands for, coercing a number or logical like `as.character` does if `coerce` is set */
function valueAsString(this: void, value: Value, coerce: boolean): string | undefined {
	if(value.type === 'string' && isValue(value.value)) {
		return value.value.str;
	}
	if(!coerce) {
		return undefined;
	}
	const num = RValue.numberOf(value);
	if(num !== undefined) {
		return Number.isInteger(num) && Math.abs(num) < 1e5 ? String(num) : undefined;
	}
	if(value.type === 'logical' && isValue(value.value) && value.value !== 'maybe') {
		return value.value ? 'TRUE' : 'FALSE';
	}
	return undefined;
}

/** every string an argument may hold (e.g. the variable of a `for` loop), `undefined` if any of its values is none */
function argAsStrings(this: void, id: NodeId, against: BuiltInEvalHandlerArgs, coerce: boolean): string[] | undefined {
	const set = NodeValue.setOf(id, against);
	if(set === undefined || set.elements.length === 0) {
		return undefined;
	}
	const strings = set.elements.map(e => valueAsString(e, coerce));
	return strings.includes(undefined) ? undefined : strings as string[];
}

/** how many combinations of argument values a fold is tried for, as `paste0(i, j)` of two long loops is no value worth listing */
const MaxFoldCombinations = 256;

/**
 * Every value a fold may yield for the values its arguments may hold, one fold for each combination of them,
 * `undefined` if an argument does not resolve to strings or there are too many combinations.
 * The values are resolved once, as the solver does not resolve a node again while it is still resolving the call.
 */
function foldAcrossValues(this: void, node: RNamedFunctionCall<ParentInformation>, args: BuiltInEvalHandlerArgs, coerce: boolean): (string | number)[] | undefined {
	const options = new Map<NodeId, string[]>();
	let unresolved = false;
	const first = foldStringCall(node, arg => {
		const strings = argAsStrings(arg.info.id, args, coerce);
		if(strings === undefined) {
			unresolved = true;
			return undefined;
		}
		options.set(arg.info.id, strings);
		return strings[0];
	});
	if(unresolved || first === undefined) {
		return undefined;
	}
	const combinations = [...options.values()].reduce((n, o) => n * o.length, 1);
	if(combinations > MaxFoldCombinations) {
		return undefined;
	}
	const ids = [...options.keys()];
	const pick = new Map<NodeId, string>();
	const results: (string | number)[] = [];
	const enumerate = (at: number): boolean => {
		if(at === ids.length) {
			const folded = foldStringCall(node, arg => pick.get(arg.info.id));
			if(folded !== undefined) {
				results.push(folded);
			}
			return folded !== undefined;
		}
		return options.get(ids[at])?.every(s => {
			pick.set(ids[at], s);
			return enumerate(at + 1);
		}) ?? false;
	};
	return enumerate(0) ? results : undefined;
}

/**
 * Resolves any call of a {@link StringFns} entry to a {@link Value}, with its arguments in any order R accepts:
 * a join like `paste0("cfg_", k)` when every part resolves to a single string constant (coercing a joined
 * number or logical the way `as.character` would), and a transformation like `basename(p)` when its argument
 * does. Anything that does not resolve stays `Top`.
 */
function resolveAsStringFn(this: void, args: BuiltInEvalHandlerArgs): Value {
	const node = args.node;
	if(!RFunctionCall.is(node) || !node.named) {
		return Top;
	}
	const joined = PasteLikeCalls.has(Identifier.getName(node.functionName.content));
	const folded = foldAcrossValues(node, args, joined);
	if(folded === undefined) {
		return Top;
	}
	const asValue = (f: string | number): Value => typeof f === 'number' ? intervalFrom(f, f) : stringFrom(f);
	return folded.length === 1 ? asValue(folded[0]) : setOf(folded.map(asValue));
}

/**
 * Folding the string built-ins, from `paste` to `basename`.
 *
 * Wired into {@link BuiltInEvalHandlerMapper} and internal to evaluation: to ask what a node holds, use
 * {@link NodeValue} or {@link Resolve}.
 */
export const StringFold = {
	/** every string built-in that is folded, see {@link StringFns} */
	fns:       StringFns,
	/** the calls pasting their arguments together, see {@link PasteLikeCalls} */
	pasteLike: PasteLikeCalls,
	/** What a string call amounts to; see {@link resolveAsStringFn}. */
	call:      resolveAsStringFn,
	/** The string a call in the AST folds to; see {@link foldStringCall}. */
	fold:      foldStringCall
} as const;
