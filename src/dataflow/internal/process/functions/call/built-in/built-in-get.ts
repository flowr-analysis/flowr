import type { DataflowProcessorInformation } from '../../../../../processor';
import type { DataflowInformation } from '../../../../../info';
import { processKnownFunctionCall } from '../known-call-handling';
import { wrapArgumentsUnnamed } from '../argument/make-argument';
import type { ParentInformation } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument, type PotentiallyEmptyRArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { RSymbol } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { NodeId } from '../../../../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { dataflowLogger } from '../../../../../logger';
import { RType } from '../../../../../../r-bridge/lang-4.x/ast/model/type';
import { EdgeType } from '../../../../../graph/edge';
import { handleUnknownSideEffect } from '../../../../../graph/unknown-side-effect';
import { type DataflowGraphVertexFunctionCall, DfgVertex, VertexType } from '../../../../../graph/vertex';
import type { DataflowGraph, FunctionArgument } from '../../../../../graph/graph';
import type { Environment, REnvironmentInformation } from '../../../../../environments/environment';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { Resolve } from '../../../../../environments/resolve-helper';
import { ProgramOrder } from '../../../../program-order';
import { type BrandedIdentifier, Identifier, type IdentifierDefinition } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { EnvirPositionFormals, resolveConstantString, resolveFirstEnvirArg, suppliesArg } from './built-in-envir-utils';
import { SourceRange } from '../../../../../../util/range';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { isNotUndefined } from '../../../../../../util/assert';
import { ArgProp, type FnSig } from '../../../../../environments/built-in-props';
import { Dataflow } from '../../../../../graph/df-helper';
import { recordFound } from '../../../../linker';

function namesDenotedBy<OtherInfo>(
	node: RNode<OtherInfo & ParentInformation>,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): string[] {
	const folded = resolveConstantString(node, data);
	return folded === undefined ? NodeValue.stringsOf(node.info.id, data) ?? [] : [folded];
}

/** One symbol per constant name the first argument of `get` denotes, so the lookup is processed like a plain read of them. */
function synthesizeTargets<OtherInfo>(
	retrieve: RNode<OtherInfo & ParentInformation>,
	name: RSymbol<OtherInfo & ParentInformation>,
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>
): RSymbol<OtherInfo & ParentInformation>[] {
	const literal = RString.is(retrieve);
	const names = literal ? [RString.unquote(retrieve.lexeme)] : namesDenotedBy(retrieve, data);
	const location = literal ? retrieve.location : retrieve.location ?? name.location ?? SourceRange.invalid();
	const literalLexeme = literal ? retrieve.lexeme : undefined;
	return names.map((resolvedName, i) => {
		const synthId = synthesizedTargetId(rootId, i);
		const synthSymbol: RSymbol<OtherInfo & ParentInformation> = {
			type:    RType.Symbol,
			info:    { ...retrieve.info, id: synthId, parent: retrieve.info.id },
			content: resolvedName,
			lexeme:  literalLexeme ?? resolvedName,
			location
		};
		data.completeAst.idMap.set(synthId, synthSymbol);
		return synthSymbol;
	});
}

function synthesizedTargetId(rootId: NodeId, i: number): NodeId {
	return `${rootId}-get-name${i > 0 ? '-' + String(i) : ''}`;
}

/** Whether `vertex` is a lookup (`get(n)`) whose name was not known where it is written, see {@link linkComputedLookup}. */
export function isComputedLookup(vertex: DataflowGraphVertexFunctionCall, graph: DataflowGraph): boolean {
	const name = vertex.args[0];
	return DfgVertex.hasOrigin(vertex, BuiltInProcName.Get) && name !== undefined && name !== EmptyArgument
		&& !RString.is(graph.idMap?.get(name.nodeId)) && !graph.hasVertex(synthesizedTargetId(vertex.id, 0));
}

/**
 * Links a lookup whose name was not known where it is written (`f <- function(n) get(n)()`) to the definitions of
 * every name that reaches it, through the parameters of the calls linked so far, seen from where it is written
 * (`environment` holds the global names at the calls of the enclosing function).
 * Returns whether all names are known; only then the lookup no longer counts as an unknown side effect.
 */
export function linkComputedLookup(graph: DataflowGraph, vertex: DataflowGraphVertexFunctionCall, environment: REnvironmentInformation, ctx: ReadOnlyFlowrAnalyzerContext, runsOnceAt: RNode<ParentInformation> | undefined): boolean {
	const name = vertex.args[0] as Exclude<FunctionArgument, typeof EmptyArgument>;
	const info = Resolve.info(graph, ctx);
	const names = NodeValue.stringsOf(name.nodeId, info);
	if(names === undefined) {
		/* a name only known at runtime may be that of any variable the lookup sees */
		const idMap = graph.idMap;
		const around = idMap === undefined ? new Set<NodeId>() : new Set(RNode.iterateParents(idMap.get(vertex.id), idMap).map(p => p.info.id));
		for(const [def] of graph.verticesOfType(VertexType.VariableDefinition)) {
			const fn = idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(def, idMap);
			if((fn === undefined || around.has(fn)) && !ProgramOrder.definedLater(def, runsOnceAt, graph)) {
				graph.addEdge(vertex.id, def, EdgeType.Returns | EdgeType.Reads);
			}
		}
		return false;
	}
	const found = (ns: readonly string[]) => ns.flatMap(n => {
		/* the frames of the body and the closures around it hold what they bound before, the global names are those at the call */
		const local = lexicalDefinitions(n, vertex, graph);
		const defs = local.definite ? local.definitions : [...local.definitions, ...Resolve.byName(n, environment) ?? []];
		return defs.map(d => d.nodeId).filter(id => !NodeId.isBuiltIn(id) && !ProgramOrder.definedLater(id, runsOnceAt, graph));
	});
	for(const nodeId of found(names)) {
		graph.addEdge(vertex.id, nodeId, EdgeType.Returns | EdgeType.Reads);
	}
	/* each call of the function around it may hand down other names */
	const fn = graph.idMap === undefined ? undefined : RNode.strictlyEnclosingFunction(vertex.id, graph.idMap);
	if(fn !== undefined && names.length > 1) {
		for(const call of Dataflow.sourcesOf(graph, fn, EdgeType.Calls)) {
			const inCall = NodeValue.stringsOf(name.nodeId, { ...info, callContext: new Map([[fn, call]]) });
			recordFound(graph, vertex.id, inCall === undefined ? [] : found(inCall), call);
		}
	}
	graph.unknownSideEffects.delete(NodeId.normalize(vertex.id));
	return true;
}

/**
 * What `name` is bound to where the lookup `call` without an environment (`get(n)`) looks before the global names: the
 * frame of the function body it is in, then those of the functions it is defined in, each as it was when the closure
 * was created and as the body around it leaves it, as a closure may be called later. `definite` once a binding surely holds.
 * @example
 * ```ts
 * // mk <- function() { f <- function(n) get(n); k <- 5; f }: a call of f sees k <- 5
 * const { definitions, definite } = lexicalDefinitions('k', getCall, graph);
 * const all = definite ? definitions : [...definitions, ...Resolve.byName('k', globalAtCall) ?? []];
 * ```
 */
export function lexicalDefinitions(name: BrandedIdentifier, call: DataflowGraphVertexFunctionCall, graph: DataflowGraph): { readonly definitions: readonly IdentifierDefinition[], readonly definite: boolean } {
	const definitions: IdentifierDefinition[] = [];
	const left: Environment[] = [];
	const idMap = graph.idMap;
	for(let fn = idMap && RNode.strictlyEnclosingFunction(call.id, idMap); idMap !== undefined && fn !== undefined;) {
		fn = RNode.strictlyEnclosingFunction(fn, idMap);
		const body = fn === undefined ? undefined : graph.getVertex(fn);
		if(DfgVertex.isFunctionDefinition(body)) {
			left.push(body.subflow.environment.current);
		}
	}
	let level = 0;
	for(let frame = call.environment?.current; frame !== undefined && !frame.builtInEnv && frame.globalEnv !== true; frame = frame.parent) {
		const found = [...frame.lookup(name) ?? frame.superMemory?.get(name) ?? [], ...level > 0 ? left[level - 1]?.lookup(name) ?? [] : []];
		definitions.push(...found);
		if(found.some(d => d.cds === undefined)) {
			return { definitions, definite: true };
		}
		level++;
	}
	return { definitions, definite: false };
}

/**
 * Processes a built-in 'get' function call.
 *
 * When an `envir` argument is present and resolves to a variable with a tracked environment
 * state (set up by `new.env()` + `assign(..., envir=...)`), the lookup is performed inside
 * that environment so that the correct definition is found and the returned {@link DataflowInformation}
 * contains the right read edges.
 */
export function processGet<OtherInfo>(
	name: RSymbol<OtherInfo & ParentInformation>,
	args: readonly PotentiallyEmptyRArgument<OtherInfo & ParentInformation>[],
	rootId: NodeId,
	data: DataflowProcessorInformation<OtherInfo & ParentInformation>,
	config: {
		returnsValue?: boolean
		sig?:          FnSig
	} = {}
): DataflowInformation {
	const resolution = resolveFirstEnvirArg(args, data, config.sig, ['envir', ...EnvirPositionFormals]);

	const retrieve = RArgument.unnamedValueOf(args[0]);
	const targets = retrieve === undefined ? [] : synthesizeTargets(retrieve, name, rootId, data);
	if(targets.length === 0) {
		dataflowLogger.warn(`symbol access with ${Identifier.toString(name.content)} has no resolvable name argument, skipping`);
		/* the name may still be known once the calls binding the parameters it reads are linked, see `linkComputedLookup` */
		const later = config.returnsValue !== false && resolution === undefined && !suppliesArg(args, config.sig, EnvirPositionFormals);
		// dynamic, unresolvable name: reached-but-unknown rather than dropped
		const { information, processedArguments } = processKnownFunctionCall({ name, args, rootId, data, origin: later ? BuiltInProcName.Get : 'default', hasUnknownSideEffect: true });
		/* `match.fun(f)` hands back the function `f` holds, as it only looks up what names one */
		const handedBack = config.sig?.[0] !== undefined && (config.sig[0][1] & ArgProp.Alias) !== 0 ? processedArguments[0] : undefined;
		if(handedBack !== undefined && retrieve !== undefined && !RString.is(retrieve)) {
			information.graph.addEdge(rootId, handedBack.entryPoint, EdgeType.Returns);
		}
		return information;
	}
	/* a computed name is an expression the call evaluates and reads */
	const nameExpression = RString.is(retrieve) ? undefined : args[0];

	/* resolve in the custom environment if one was found, else the global one.
	 * Pass remaining original args (e.g. envir=e) so they appear as Use vertices in the graph. */
	const { information, processedArguments } = processKnownFunctionCall({
		name,
		args: [
			...wrapArgumentsUnnamed(targets, data.completeAst.idMap),
			...(nameExpression !== undefined ? [nameExpression] : []),
			...args.slice(1)
		],
		rootId,
		data:   resolution ? resolution.envirData : data,
		origin: BuiltInProcName.Get
	});

	const named = processedArguments.slice(0, targets.length);
	const returns = config.returnsValue === false ? EdgeType.Reads : EdgeType.Returns | EdgeType.Reads;
	for(const target of named) {
		if(target) {
			information.graph.addEdge(rootId, target.entryPoint, returns);
			const targetVtx = information.graph.getVertex(target.entryPoint);
			if(DfgVertex.isUse(targetVtx)) {
				targetVtx.constantFallback = true;
			}
		}
	}

	const nameExpressionProcessed = nameExpression === undefined ? undefined : processedArguments[targets.length];
	if(nameExpressionProcessed) {
		information.graph.addEdge(rootId, nameExpressionProcessed.entryPoint, EdgeType.Reads);
	}

	if(resolution) {
		information.graph.addEdge(rootId, resolution.envirNodeId, EdgeType.Reads);
	} else if(suppliesArg(args, config.sig, EnvirPositionFormals)) {
		handleUnknownSideEffect(information.graph, information.environment, rootId);
	}

	const isolatedTarget = resolution?.envirData.environment.current.builtInEnv === true;
	const readsToDrop = isolatedTarget
		? new Set(named.filter(isNotUndefined).map(t => t.entryPoint))
		: undefined;

	/* restore the caller's (global) environment so we don't leak envState upward */
	return {
		...information,
		in:          readsToDrop ? information.in.filter(({ nodeId }) => !readsToDrop.has(nodeId)) : information.in,
		environment: data.environment
	};
}
