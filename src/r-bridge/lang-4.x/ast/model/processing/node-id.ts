import type { AstIdMap, ParentInformation } from './decorate';
import type { DataflowGraph } from '../../../../../dataflow/graph/graph';
import { DfgVertex } from '../../../../../dataflow/graph/vertex';
import type { RNode } from '../model';
import { Identifier } from '../../../../../dataflow/environments/identifier';
import type { BuiltInProcName } from '../../../../../dataflow/environments/built-in-proc-name';
import { compareByCodeUnit, splitRQuotes } from '../../../../../util/text/strings';

/**
 * The type of the id assigned to each node. Branded to avoid problematic usages with other string or numeric types.
 * The default ids are numeric, but we use a branded type to avoid confusion with other numeric types.
 * Custom ids or scoped ids can be strings, but they will be normalized to numbers if they are numeric strings.
 */
export type NodeId<T extends string | number = string | number> = T & { __brand?: 'node-id' };

/**
 * A variant of {@link NodeId} that represents built-in functions or operators. The string is prefixed with `built-in:` to avoid confusion with other node ids.
 */
export type BuiltIn<T extends string = string> = `built-in:${T}`;

/** whether the id starts as a number does, which `+id` alone does not tell: it turns a blank string into `0` */
const ArgumentSuffix = '-arg';

function startsNumeric<S extends string>(id: S): boolean {
	const c = id.charCodeAt(0);
	return c >= 48 && c <= 57 /* 0-9 */ || c === 45 /* - */ || c === 43 /* + */ || c === 46;
}

/** see {@link NodeId.anonymousCall} */
const AnonymousCallPrefix = 'anon-';

/**
 * What a {@link NodeId} is: the identity of a node within one analysis, plus the built-in and `pkg::fn`
 * names encoded as one, and the ways to read a name back out of it.
 * @helper location
 */
export const NodeId = {
	name: 'NodeId',
	/**
	 * Orders two ids: numerically where both are numbers, and by code unit otherwise. Never `localeCompare`,
	 * whose order depends on the machine's locale and ICU build, so a result decided by it would differ
	 * between two users analyzing the same code.
	 */
	compare(this: void, a: NodeId, b: NodeId): number {
		const [x, y] = [NodeId.normalize(a), NodeId.normalize(b)];
		return typeof x === 'number' && typeof y === 'number' ? x - y : compareByCodeUnit(String(x), String(y));
	},
	/** The id of the argument flowR wraps around a node handed over without one, like the left side of `x |> f()`. */
	argumentOf(this: void, id: NodeId): NodeId {
		return `${id}${ArgumentSuffix}`;
	},
	/** The node an argument of {@link NodeId.argumentOf} wraps, `undefined` for any other id. */
	wrappedByArgument(this: void, id: NodeId): NodeId | undefined {
		return typeof id === 'string' && id.endsWith(ArgumentSuffix) ? id.slice(0, -ArgumentSuffix.length) : undefined;
	},
	/**
	 * Normalizes a node id by converting numeric strings to numbers.
	 * This allows us to use numeric ids without storing them as strings, while still allowing custom string ids if needed.
	 */
	normalize(this: void, id: NodeId): NodeId {
		if(typeof id === 'string' && startsNumeric(id)) {
			const num = +id;
			if(!Number.isNaN(num)) {
				return num;
			}
		}
		return id;
	},
	/**
	 * Whether the id belongs to a node the analyzed code writes. flowR wraps a deferred expression
	 * (`on.exit` and its relatives) in a definition of its own, and that definition carries an id no node
	 * of the ast does.
	 */
	isWritten(this: void, id: NodeId): boolean {
		return typeof NodeId.normalize(id) === 'number';
	},
	/**
	 * The prefix used for built-in function or operator ids.
	 */
	builtInPrefix: 'built-in:',
	/**
	 * Checks if a given node id is a built-in function or operator id by checking if it is a string that starts with the built-in prefix.
	 * @see {@link toBuiltIn} - to convert a built-in function or operator name to a built-in id
	 * @see {@link fromBuiltIn} - to recover the built-in function or operator name from a built-in id
	 */
	isBuiltIn(this: void, id: BuiltIn | NodeId | undefined): id is BuiltIn {
		return typeof id === 'string' && id.startsWith(NodeId.builtInPrefix);
	},
	/**
	 * Converts a built-in function or operator name to a built-in id by prefixing it with the built-in prefix.
	 * @see {@link isBuiltIn} - to check if a given node id is a built-in function or operator id
	 * @see {@link fromBuiltIn} - to recover the built-in function or operator name from a built-in id
	 */
	toBuiltIn<T extends string>(this: void, name: T): BuiltIn<T> {

		return `built-in:${name}`;
	},
	/**
	 * The canonical `pkg:fn` identifier of a package's exported function (e.g. `ggplot2:ggplot`). The single
	 * source of this form: `Package.functionIdentifier` delegates here, and {@link fromPkgFn} wraps it.
	 */
	pkgFnName<P extends string, F extends string>(this: void, pkg: P, fn: F): `${P}:${F}` {
		return `${pkg}:${fn}`;
	},
	/**
	 * The built-in id of a package's exported function, e.g. `fromPkgFn('ggplot2', 'ggplot')` yields
	 * `built-in:ggplot2:ggplot` -- {@link toBuiltIn} over the {@link pkgFnName} `pkg:fn` form.
	 */
	fromPkgFn<P extends string, F extends string>(this: void, pkg: P, fn: F): BuiltIn<`${P}:${F}`> {
		return NodeId.toBuiltIn(NodeId.pkgFnName(pkg, fn));
	},
	/**
	 * Inverse of {@link fromPkgFn}: split a package-function built-in id (`built-in:pkg:fn`) into its `[pkg, fn]`
	 * parts, or `undefined` when `id` is not one (a non-builtin id, or a bare builtin without a package such as
	 * `built-in:print`). A package name never contains a `:`, so the first one separates it from the function.
	 */
	toPkgFn(this: void, id: BuiltIn | NodeId | undefined): readonly [pkg: string, fn: string] | undefined {
		if(!NodeId.isBuiltIn(id)) {
			return undefined;
		}
		const rest = NodeId.fromBuiltIn(id);
		const sep = rest.indexOf(':');
		return sep > 0 ? [rest.slice(0, sep), rest.slice(sep + 1)] : undefined;
	},
	/**
	 * Converts a built-in function or operator name or id to a built-in id by prefixing it with the built-in prefix if it is not already a built-in id.
	 * This allows us to accept both built-in names and ids in contexts where we want to work with built-in ids.
	 */
	mapBuiltInProc<T extends BuiltInProcName>(this: void, proc: T): T extends `builtin:${infer S}` ? BuiltIn<S> : BuiltIn<T> {
		const bi = 'builtin:';
		return NodeId.toBuiltIn(
			proc.startsWith(bi) ? proc.slice(bi.length) : proc
		) as never;
	},
	/**
	 * Recovers the built-in function or operator name from a built-in id by removing the built-in prefix.
	 * @see {@link isBuiltIn} - to check if a given node id is a built-in function or operator id
	 * @see {@link toBuiltIn} - to convert a built-in function or operator name to a built-in id
	 */
	fromBuiltIn<T extends string>(this: void, id: BuiltIn<T>): T {
		return id.slice(builtInPrefixLength) as T;
	},
	/**
	 * The lexeme of the {@link RNode|node} the id belongs to, as the analyzed code writes it.
	 * @see {@link NodeId.recoverContent} - for what a call or a use stands for rather than how it is written
	 */
	recoverName(this: void, id: NodeId, idMap?: AstIdMap): string | undefined {
		return NodeId.nodeOf(id, idMap)?.lexeme;
	},
	/** The id of the call the dataflow graph makes up for an anonymous function a call runs (`lapply(x, function(v) v)`, a `tryCatch` handler). */
	anonymousCall(this: void, functionId: NodeId): NodeId {
		return AnonymousCallPrefix + String(functionId);
	},
	/** Whether `id` is a made-up {@link NodeId.anonymousCall}. */
	isAnonymousCall(this: void, id: NodeId): boolean {
		return typeof id === 'string' && id.startsWith(AnonymousCallPrefix);
	},
	/** The node `id` belongs to; for a made-up {@link NodeId.anonymousCall} the anonymous function it calls. */
	nodeOf<Info>(this: void, id: NodeId, idMap: AstIdMap<Info> | undefined): RNode<Info & ParentInformation> | undefined {
		const node = idMap?.get(id);
		return node !== undefined || typeof id !== 'string' || !id.startsWith(AnonymousCallPrefix) ? node : idMap?.get(NodeId.normalize(id.slice(AnonymousCallPrefix.length)));
	},
	/**
	 * The name the {@link RNode|node} the id belongs to binds or reads, without the backticks or quotes R lets it be
	 * written in (`"x"` and `x` in backticks both name `x`), which is how the environments know it.
	 * @see {@link NodeId.recoverName} - for the lexeme as written
	 */
	recoverBareName(this: void, id: NodeId, idMap?: AstIdMap): string | undefined {
		const lexeme = NodeId.recoverName(id, idMap);
		return lexeme === undefined ? undefined : splitRQuotes(lexeme).content;
	},
	/**
	 * What the node the id belongs to stands for: the name a call resolved to, the unquoted name of a use, and
	 * the lexeme of anything else. It reads the lexeme itself, as the AST helpers would make loading the identifiers expensive.
	 * @lintIgnore
	 * @see {@link NodeId.recoverName} - for the lexeme alone, which needs no graph
	 */
	recoverContent(this: void, id: NodeId, graph: DataflowGraph): string | undefined {
		const vertex = graph.getVertex(id);
		if(vertex && DfgVertex.isFunctionCall(vertex) && vertex.name) {
			return Identifier.toString(vertex.name);
		}
		const node = graph.idMap?.get(id);
		if(node === undefined) {
			return undefined;
		}
		const lexeme = node.lexeme ?? node.info.fullLexeme ?? '';
		if(DfgVertex.isUse(vertex)) {
			return splitRQuotes(lexeme).content;
		}
		return lexeme;
	}
} as const;

const builtInPrefixLength = NodeId.builtInPrefix.length;

