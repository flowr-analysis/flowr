/**
 * `FunctionSemantics.call` is the entry point these members are reached through, and it is built on this file, so the backing
 * functions are called directly here; going through `FunctionSemantics` would make `src/dataflow/fn/function-semantics.ts` import its own
 * importers.
 * @lintIgnore use-instead
 */
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NoInfo, RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { type DataflowGraph, FunctionArgument } from './graph';
import { DfgVertex } from './vertex';
import { EdgeType } from './edge';
import { dataflowLogger } from '../logger';
import { DotsParameterName, matchArgumentsToParameters } from '../../util/arg-matching';
import { AttachedBasePackageSet } from '../../util/r-base-packages';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { SourceRange } from '../../util/range';
import type { SigParameter } from '../../project/sigdb/decode';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { RSymbol } from '../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNumber } from '../../r-bridge/lang-4.x/ast/model/nodes/r-number';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { signatureDbOf, type SignatureDb } from '../../project/sigdb/signature-db';
import { OriginType } from '../origin/dfg-get-origin';
import { Dataflow } from './df-helper';
import { Identifier, PkgName } from '../environments/identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isNotUndefined } from '../../util/assert';
import type { ArgProps, FnSig  } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import type { BuiltInLookup } from '../fn/frame-reflection';

/** the argument names in the shape {@link matchArgumentsToParameters} takes, unnamed arguments as `undefined` */
function graphArgumentNames(args: readonly FunctionArgument[]): (string | undefined)[] {
	return args.map(a => FunctionArgument.isNamed(a) ? a.name : undefined);
}

/**
 * R's argument matching, as {@link matchArgumentsToParameters} implements it. Pick by what you hold:
 *
 * - {@link MatchArgs.toNames|toNames} - AST arguments and the formal names
 * - {@link MatchArgs.toSpec|toSpec} - graph arguments and the formals (a spec or a database signature)
 * - {@link MatchArgs.onCallAndLink|onCallAndLink} - as `toSpec`, and **adds the argument edges to the graph**
 * - {@link MatchArgs.toDefinition|toDefinition} - only the call, the formals are looked up for you
 * - {@link MatchArgs.findWithProps|findWithProps} - graph arguments and a built-in signature, keeping the ones used for given {@link ArgProp}s
 * @example
 * ```ts
 * MatchArgs.toNames(call.arguments, ['x', 'value']).get('value');
 * MatchArgs.toSpec(args, { file: 'fileId', '...': '...' }).get('fileId');
 * ```
 */
export const MatchArgs = {
	/**
	 * Binds a call's AST `args` to the formal `paramNames`. An empty argument (`f(1, ,3)`) takes its formal but
	 * never appears here. Arguments falling to `...` share that key, so only the last survives; use
	 * {@link MatchArgs.toSpec} to keep them all.
	 * @param args       - The arguments as they stand in the normalized AST.
	 * @param paramNames - The formals of the called function, in order.
	 * @returns          Per formal name the argument bound to it.
	 * @see {@link RFunctionCall.matchArgsToParams} - the implementation, kept there to avoid a load-time import cycle.
	 */
	toNames<Info = NoInfo>(this: void, args: readonly PotentiallyEmptyRArgument<Info>[], paramNames: readonly string[]): ReadonlyMap<string, RArgument<Info>> {
		return RFunctionCall.matchArgsToParams(args, paramNames);
	},
	/**
	 * Binds a call's graph `args` against the formals, reading nothing from the graph, so it also serves a
	 * function whose parameters are not in the AST at all. Name `'...'` in a specification unless the function
	 * really has none, as that is what collects arguments finding no formal of their own.
	 * @param args   - The arguments as the graph holds them, see {@link convertFnArguments}.
	 * @param params - Formal name to the target it stands for, or a signature whose names are the targets.
	 * @returns      Per target the ids bound to it.
	 */
	toSpec<Targets extends NodeId = string>(this: void, args: readonly FunctionArgument[], params: Record<string, Targets> | readonly SigParameter[]): Map<Targets, NodeId[]> {
		let spec = params as Record<string, Targets>;
		if(Array.isArray(params)) {
			spec = {};
			for(const p of params as readonly SigParameter[]) {
				spec[p.name] = p.name as Targets;
			}
		}
		const paramNames = Object.keys(spec);
		const matched = matchArgumentsToParameters(graphArgumentNames(args), paramNames);
		const maps = new Map<Targets, NodeId[]>();
		for(let i = 0; i < args.length; i++) {
			const arg = args[i], param = matched[i];
			if(arg === EmptyArgument || param === undefined) {
				continue;
			}
			const target = spec[paramNames[param]];
			const known = maps.get(target);
			if(known) {
				known.push(arg.nodeId);
			} else {
				maps.set(target, [arg.nodeId]);
			}
		}
		return maps;
	},
	/**
	 * Binds a call's graph `args` to the `params` of the definition it calls **and mutates `graph`**, adding an
	 * {@link EdgeType.DefinesOnCall} and a {@link EdgeType.DefinedByOnCall} edge per bound pair. It is the only
	 * member here that writes anything. Dots handed on (`g(...)`) stand for the arguments each known call of the
	 * function around hands to its dots (see {@link forwardedArguments}), and a dots parameter the body reads only by
	 * position (`..2`, `...elt(2)`) binds each argument to the reads of its position (see {@link elementReadsOf}).
	 * @param args   - The arguments as the graph holds them.
	 * @param params - The parameters of the called definition, in order.
	 * @param graph  - The graph the edges are added to.
	 * @returns      The argument id to parameter id mapping the edges were drawn for.
	 */
	onCallAndLink(this: void, args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
		const names = params.map(p => p?.special ? DotsParameterName : p?.name?.content);
		const maps = new Map<NodeId, NodeId>();
		const expanded = forwardedArguments(args, graph);
		if(expanded !== undefined) {
			/* what a call linked before the calls handing on the dots were known no longer stands for them */
			for(const arg of handedOnDotsOf(args, graph)) {
				for(const param of params) {
					graph.removeEdgeType(arg, param.name.info.id, EdgeType.DefinesOnCall);
					graph.removeEdgeType(param.name.info.id, arg, EdgeType.DefinedByOnCall);
				}
			}
		}
		for(const alternative of expanded ?? [args]) {
			linkArguments(alternative, params, names, graph, maps);
		}
		return maps;
	},
	/**
	 * Whether the call hands on the dots of the function it is in (`g(...)`), so that what it binds depends on the calls
	 * of that function, see {@link MatchArgs.onCallAndLink}.
	 * @example
	 * ```ts
	 * // `f <- function(...) g(...)`
	 * MatchArgs.handsOnDots(argsOfTheCallToG, graph); // true
	 * ```
	 */
	handsOnDots(this: void, args: readonly FunctionArgument[], graph: DataflowGraph): boolean {
		return args.some(a => dotsHandedOnBy(a, graph) !== undefined);
	},
	/**
	 * Binds a call's arguments to the formals of whatever it calls, looking the formals up itself. It takes them
	 * from the {@link RFunctionDefinition} the call resolves to in user code, and from the database signature at
	 * the version the analysis assumes otherwise (see {@link SignatureDb}). `undefined` when it resolves to
	 * neither, so fall back to a hardcoded list then.
	 *
	 * `graph` is what says which definition a name reaches here, because scoping, shadowing and control flow
	 * decide that and a name alone cannot. It therefore needs a finished graph rather than one under
	 * construction, and it is what says which arguments the call has (see {@link callArgumentsOf}). Cost is one
	 * {@link Dataflow.origin} lookup plus, for a package call, decoding that one function.
	 * @param call  - The call whose arguments are to be bound.
	 * @param graph - The finished graph the call was analyzed into.
	 * @param ctx   - The analyzer context the database and the assumed versions come from.
	 * @returns     Per formal name the argument bound to it, `undefined` if the formals could not be found.
	 */
	toDefinition<Info extends ParentInformation>(this: void, call: RFunctionCall<Info>, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): ReadonlyMap<string, RArgument<Info>> | undefined {
		const names = formalsOf(call, graph, ctx);
		return names === undefined ? undefined : MatchArgs.toNames(callArgumentsOf(call, graph), names);
	},
	/** The formal names a call binds against, whichever of flowR's sources knows them; see {@link formalsOf}. */
	formalsOf,
	/**
	 * Find all arguments of a function call that have a given argument property using the function signature.
	 * @param args      - The function arguments as the graph holds them.
	 * @param signature - The function signature whose names are the targets.
	 * @param props     - The {@link ArgProp}s the function arguments should have.
	 * @returns         The value ids of the matching arguments.
	 */
	findWithProps(this: void, args: readonly FunctionArgument[], signature: FnSig, props: ArgProps): NodeId[] {
		const bound = matchArgumentsToParameters(args.map(FunctionArgument.getName), signature.map(([param]) => param));
		return args
			.filter((_, index) => bound[index] !== undefined && (signature[bound[index]][1] & props) !== 0)
			.map(FunctionArgument.getReference).filter(isNotUndefined);
	}
} as const;

/**
 * The formals a call binds against, taken from the first of flowR's three sources that knows them:
 *
 * 1. the {@link RFunctionDefinition} the call resolves to in user code, whose parameters are already in the
 *    AST, so the common case never looks anything up;
 * 2. the signature database at the version the analysis assumes (see {@link SignatureDb}), which records what
 *    the package really declares and is therefore the one to believe about a package function;
 * 3. the {@link BuiltInFnInfo#sig|signature} flowR's own {@link DefaultBuiltinConfig} states, which answers for
 *    everything the database has no entry for: a built-in of flowR's own, and every package function on a
 *    machine carrying no database. flowR states the parameters it models rather than all of them, so this is
 *    a prefix of R's formals -- enough to bind what it names, and never more than R would.
 *
 * `undefined` when the call resolves to none of them, so fall back to a hardcoded list then.
 * @param call  - The call whose formals are wanted.
 * @param graph - The finished graph the call was analyzed into.
 * @param ctx   - The analyzer context the database, the assumed versions and the built-ins come from.
 */
function formalsOf<Info extends ParentInformation>(this: void, call: RFunctionCall<Info>, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): readonly string[] | undefined {
	const origins = Dataflow.origin(graph, call.info.id);
	if(origins === undefined) {
		return undefined;
	}
	for(const origin of origins) {
		if(origin.type === OriginType.FunctionCallOrigin && !NodeId.isBuiltIn(origin.id)) {
			const definition = graph.idMap?.get(origin.id);
			if(RFunctionDefinition.is(definition)) {
				return definition.parameters.map(p => p.special ? DotsParameterName : p.name.content);
			}
		}
	}
	let db: SignatureDb | undefined;
	let stated: BuiltInLookup | undefined;
	for(const position of SearchPath) {
		for(const origin of origins) {
			if(origin.type !== OriginType.BuiltInFunctionOrigin) {
				continue;
			}
			const name = Identifier.toQualified([origin], origin.fn.name) ?? origin.fn.name;
			if(searchPathPosition(name) !== position) {
				continue;
			}
			db ??= signatureDbOf(ctx.deps);
			const found = db.parametersOf(name);
			if(found !== undefined && found.length > 0) {
				return found;
			}
			stated ??= builtInLookup(ctx);
			const declared = stated(name)?.sig;
			if(declared !== undefined && declared.length > 0) {
				return declared.map(([param]) => param);
			}
		}
	}
	return undefined;
}

/** At most this many argument lists the dots handed on through calls stand for, more make the binding unknown. */
const MaxDotsExpansions = 16;

/** The dots parameter the argument hands on (`g(...)`), if it is just that. */
function dotsHandedOnBy(arg: FunctionArgument, graph: DataflowGraph): NodeId | undefined {
	if(arg === EmptyArgument || FunctionArgument.isNamed(arg)) {
		return undefined;
	}
	const node = graph.idMap?.get(arg.nodeId);
	if(!RSymbol.is(node) || node.content !== DotsParameterName) {
		return undefined;
	}
	const read = Dataflow.targetsOf(graph, arg.nodeId, EdgeType.Reads);
	return read.length === 1 && definitionOfParameter(read[0], graph) !== undefined ? read[0] : undefined;
}

/** The ids of the arguments handing on dots, see {@link dotsHandedOnBy}. */
function handedOnDotsOf(args: readonly FunctionArgument[], graph: DataflowGraph): NodeId[] {
	return args.flatMap(a => dotsHandedOnBy(a, graph) === undefined ? [] : [FunctionArgument.getId(a)]).filter(isNotUndefined);
}

/** The function definition whose parameter `id` names. */
function definitionOfParameter(id: NodeId, graph: DataflowGraph): RFunctionDefinition<ParentInformation> | undefined {
	const idMap = graph.idMap;
	const parameter = idMap?.get(idMap.get(id)?.info.parent ?? -1);
	const definition = RParameter.is(parameter) ? idMap?.get(parameter.info.parent ?? -1) : undefined;
	return RFunctionDefinition.is(definition) ? definition : undefined;
}

/**
 * The argument lists `args` stands for once the dots it hands on (`g(...)`) are replaced, one per chain of known calls
 * handing them on, each with the arguments these calls hand to the dots in order and by their names. `undefined` if
 * `args` hands on no dots, or a function handing them on has a call flowR does not know the arguments of.
 * @example
 * ```ts
 * // `f <- function(...) g(...)` called as `f(b = 1, a = 3)`: `g(...)` binds as `g(b = 1, a = 3)`
 * forwardedArguments(argsOfTheCallToG, graph); // [[b = 1, a = 3]]
 * ```
 */
function forwardedArguments(args: readonly FunctionArgument[], graph: DataflowGraph, seen: Set<NodeId> = new Set()): FunctionArgument[][] | undefined {
	if(!args.some(a => dotsHandedOnBy(a, graph) !== undefined)) {
		return undefined;
	}
	let lists: FunctionArgument[][] = [[]];
	for(const arg of args) {
		const dots = dotsHandedOnBy(arg, graph);
		const options = dots === undefined ? [[arg]] : handedToDots(dots, graph, seen);
		if(options === undefined) {
			return undefined;
		}
		lists = lists.flatMap(l => options.map(o => [...l, ...o]));
		if(lists.length > MaxDotsExpansions) {
			return undefined;
		}
	}
	return lists;
}

/** Per known call of the function with the dots parameter `dots`, the arguments it hands to them, see {@link forwardedArguments}. */
function handedToDots(dots: NodeId, graph: DataflowGraph, seen: Set<NodeId>): FunctionArgument[][] | undefined {
	const definition = definitionOfParameter(dots, graph);
	if(definition === undefined || seen.has(dots)) {
		return undefined;
	}
	const names = definition.parameters.map(p => p.special ? DotsParameterName : p.name.content);
	const position = names.indexOf(DotsParameterName);
	const callers = Dataflow.sourcesOf(graph, definition.info.id, EdgeType.Calls);
	const lists: FunctionArgument[][] = [];
	seen.add(dots);
	try {
		for(const caller of callers) {
			const call = graph.getVertex(caller);
			/* a call that runs the function with arguments of its own making (`lapply(x, f)`) hands on what flowR does not know */
			if(!DfgVertex.isFunctionCall(call) || (call.origin !== 'unnamed' && !DfgVertex.hasOrigin(call, BuiltInProcName.Function))) {
				return undefined;
			}
			const matched = matchArgumentsToParameters(graphArgumentNames(call.args), names);
			const toDots = call.args.filter((a, i) => a !== EmptyArgument && matched[i] === position);
			const handed = forwardedArguments(toDots, graph, seen);
			if(handed === undefined && toDots.some(a => dotsHandedOnBy(a, graph) !== undefined)) {
				return undefined;
			}
			lists.push(...handed ?? [toDots]);
		}
	} finally {
		seen.delete(dots);
	}
	return callers.length === 0 || lists.length > MaxDotsExpansions ? undefined : lists;
}

/**
 * The reads of the dots parameter `dots` per position they read (`..2`, `...elt(2)`), `undefined` unless the body
 * reads the dots by position only.
 */
function elementReadsOf(dots: NodeId, graph: DataflowGraph): ReadonlyMap<number, readonly NodeId[]> | undefined {
	const byPosition = new Map<number, NodeId[]>();
	for(const read of Dataflow.sourcesOf(graph, dots, EdgeType.Reads)) {
		const position = positionReadBy(graph.idMap?.get(read));
		if(position === undefined) {
			return undefined;
		}
		byPosition.set(position, [...byPosition.get(position) ?? [], read]);
	}
	return byPosition.size === 0 ? undefined : byPosition;
}

/** The built-in reading an element of the dots by its position. */
const DotsElement = '...elt';

/** The position of the dots `node` reads, as `..2` or `...elt(2)` do. */
function positionReadBy(node: RNode<ParentInformation> | undefined): number | undefined {
	if(RSymbol.is(node)) {
		const position = /^\.\.(\d+)$/.exec(Identifier.getName(node.content))?.[1];
		return position === undefined ? undefined : Number(position);
	}
	const first = RFunctionCall.isNamed(node, DotsElement) && node.arguments.length === 1 ? RArgument.valueOf(node.arguments[0]) : undefined;
	const position = RNumber.literalValueOf(first);
	return position !== undefined && Number.isInteger(position) && position > 0 ? position : undefined;
}

/**
 * Binds `args` to `params` named `names`, see {@link MatchArgs.onCallAndLink}. Dots handed on that stand for nothing
 * known may fill any parameter no other argument takes.
 */
function linkArguments(args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], names: readonly (string | undefined)[], graph: DataflowGraph, maps: Map<NodeId, NodeId>): void {
	const unknown = handedOnDotsOf(args, graph);
	const known = unknown.length === 0 ? args : args.filter(a => !unknown.includes(FunctionArgument.getId(a) ?? ''));
	const matched = matchArgumentsToParameters(graphArgumentNames(known), names);
	const dots = names.indexOf(DotsParameterName);
	const elements = dots < 0 ? undefined : elementReadsOf(params[dots].name.info.id, graph);
	const link = (aid: NodeId, pid: NodeId) => {
		graph.addEdge(aid, pid, EdgeType.DefinesOnCall);
		graph.addEdge(pid, aid, EdgeType.DefinedByOnCall);
	};
	let position = 0;
	for(let i = 0; i < known.length; i++) {
		const arg = known[i];
		if(arg === EmptyArgument) {
			continue;
		}
		const param = matched[i];
		const pid = param === undefined ? undefined : params[param].name?.info.id;
		const aid = arg.nodeId;
		if(pid === undefined) {
			dataflowLogger.warn(`skipping argument ${i} (id: ${aid}) as there is no corresponding parameter - R should block that`);
			continue;
		} else if(param === dots && elements !== undefined) {
			/* only the reads of its position see the argument, and the call forces it only if one does */
			const reads = elements.get(++position) ?? [];
			reads.forEach(r => link(aid, r));
			if(reads.length > 0) {
				maps.set(aid, pid);
			}
			continue;
		}
		link(aid, pid);
		maps.set(aid, pid);
	}
	const taken = new Set(matched);
	for(const arg of unknown) {
		for(const [param, { name }] of params.entries()) {
			if(taken.has(param) && param !== dots) {
				continue;
			}
			for(const target of param === dots && elements !== undefined ? [...elements.values()].flat() : [name.info.id]) {
				link(arg, target);
			}
			if(!maps.has(arg)) {
				maps.set(arg, name.info.id);
			}
		}
	}
}

/** R's default search path, front to back: whatever the code attaches masks the base packages, `base` last. */
const SearchPath = ['attached-package', 'base-package', 'base', 'unqualified'] as const;

/** Where `name` sits on the {@link SearchPath}. */
function searchPathPosition(name: Identifier): typeof SearchPath[number] {
	const namespace = Identifier.getNamespace(name);
	if(namespace === undefined) {
		return 'unqualified';
	}
	return namespace === PkgName.Base ? 'base' : AttachedBasePackageSet.has(namespace) ? 'base-package' : 'attached-package';
}

/** The arguments the call binds, taken from the graph so that `x |> f(y)` binds `f(x, y)`. */
function callArgumentsOf<Info extends ParentInformation>(call: RFunctionCall<Info>, graph: DataflowGraph): readonly PotentiallyEmptyRArgument<Info>[] {
	const vertex = graph.getVertex(call.info.id);
	if(!DfgVertex.isFunctionCall(vertex) || vertex.args.length !== call.arguments.length + 1) {
		return call.arguments;
	}
	const pipedId = FunctionArgument.getId(vertex.args[0]);
	const piped = pipedId === undefined ? undefined : graph.idMap?.get(pipedId);
	if(piped === undefined) {
		return call.arguments;
	}
	return [{
		type:     RType.Argument,
		lexeme:   piped.lexeme ?? '',
		location: piped.location ?? SourceRange.invalid(),
		info:     { ...piped.info, id: `${piped.info.id}-arg` },
		name:     undefined,
		value:    piped
	} as RArgument<Info>, ...call.arguments];
}
