/**
 * `Fn.call` is the entry point these members are reached through, and it is built on this file, so the backing
 * functions are called directly here; going through `Fn` would make `src/dataflow/fn/fn.ts` import its own
 * importers.
 * @lintIgnore use-instead
 */
import { EmptyArgument, type PotentiallyEmptyRArgument, RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import type { RParameter } from '../../r-bridge/lang-4.x/ast/model/nodes/r-parameter';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NoInfo } from '../../r-bridge/lang-4.x/ast/model/model';
import { type DataflowGraph, FunctionArgument } from './graph';
import { EdgeType } from './edge';
import { dataflowLogger } from '../logger';
import { DotsParameterName, matchArgumentsToParameters } from '../../util/arg-matching';
import type { SigParameter } from '../../project/sigdb/decode';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import type { ReadOnlyFlowrAnalyzerContext } from '../../project/context/flowr-analyzer-context';
import { signatureDbOf, type SignatureDb } from '../../project/sigdb/signature-db';
import { OriginType } from '../origin/dfg-get-origin';
import { Dataflow } from './df-helper';
import { Identifier } from '../environments/identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { isNotUndefined } from '../../util/assert';
import type { ArgProps } from '../environments/built-in-props';
import { FnSig } from '../environments/built-in-props';
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
	 * member here that writes anything.
	 * @param args   - The arguments as the graph holds them.
	 * @param params - The parameters of the called definition, in order.
	 * @param graph  - The graph the edges are added to.
	 * @returns      The argument id to parameter id mapping the edges were drawn for.
	 */
	onCallAndLink(this: void, args: readonly FunctionArgument[], params: readonly RParameter<ParentInformation>[], graph: DataflowGraph): Map<NodeId, NodeId> {
		const matched = matchArgumentsToParameters(graphArgumentNames(args), params.map(p => p?.special ? DotsParameterName : p?.name?.content));
		const maps = new Map<NodeId, NodeId>();
		for(let i = 0; i < args.length; i++) {
			const arg = args[i];
			if(arg === EmptyArgument) {
				continue;
			}
			const param = matched[i];
			const pid = param === undefined ? undefined : params[param].name?.info.id;
			const aid = arg.nodeId;
			if(pid === undefined) {
				dataflowLogger.warn(`skipping argument ${i} (id: ${aid}) as there is no corresponding parameter - R should block that`);
				continue;
			}
			graph.addEdge(aid, pid, EdgeType.DefinesOnCall);
			graph.addEdge(pid, aid, EdgeType.DefinedByOnCall);
			maps.set(aid, pid);
		}
		return maps;
	},
	/**
	 * Binds a call's arguments to the formals of whatever it calls, looking the formals up itself. It takes them
	 * from the {@link RFunctionDefinition} the call resolves to in user code, and from the database signature at
	 * the version the analysis assumes otherwise (see {@link SignatureDb}). `undefined` when it resolves to
	 * neither, so fall back to a hardcoded list then.
	 *
	 * `graph` is what says which definition a name reaches here, because scoping, shadowing and control flow
	 * decide that and a name alone cannot. It therefore needs a finished graph rather than one under
	 * construction. Cost is one {@link Dataflow.origin} lookup plus, for a package call, decoding that one
	 * function.
	 * @param call  - The call whose arguments are to be bound.
	 * @param graph - The finished graph the call was analyzed into.
	 * @param ctx   - The analyzer context the database and the assumed versions come from.
	 * @returns     Per formal name the argument bound to it, `undefined` if the formals could not be found.
	 */
	toDefinition<Info>(this: void, call: RFunctionCall<Info & ParentInformation>, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): ReadonlyMap<string, RArgument<Info & ParentInformation>> | undefined {
		const names = formalsOf(call, graph, ctx);
		return names === undefined ? undefined : MatchArgs.toNames(call.arguments, names);
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
		const layout = FnSig.layout(signature);
		const bound = matchArgumentsToParameters(args.map(FunctionArgument.getName), signature.map(([param]) => param));

		return args
			.filter((_, index) => bound[index] !== undefined && (FnSig.propAt(layout, bound[index]) & props) !== 0)
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
function formalsOf<Info>(this: void, call: RFunctionCall<Info & ParentInformation>, graph: DataflowGraph, ctx: ReadOnlyFlowrAnalyzerContext): readonly string[] | undefined {
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
	for(const origin of origins) {
		if(origin.type !== OriginType.BuiltInFunctionOrigin) {
			continue;
		}
		const name = Identifier.toQualified([origin], origin.fn.name) ?? origin.fn.name;
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
	return undefined;
}
