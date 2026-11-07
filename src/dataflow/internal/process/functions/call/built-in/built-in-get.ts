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
import { type DataflowGraphVertexFunctionCall, DfgVertex } from '../../../../../graph/vertex';
import type { DataflowGraph, FunctionArgument } from '../../../../../graph/graph';
import type { REnvironmentInformation } from '../../../../../environments/environment';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../../../../project/context/flowr-analyzer-context';
import { Resolve } from '../../../../../environments/resolve-helper';
import { ProgramOrder } from '../../../../program-order';
import { Identifier } from '../../../../../environments/identifier';
import { BuiltInProcName } from '../../../../../environments/built-in-proc-name';
import { EnvirPositionFormals, resolveConstantString, resolveFirstEnvirArg, suppliesArg } from './built-in-envir-utils';
import { SourceRange } from '../../../../../../util/range';
import { RString } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-string';
import { RArgument } from '../../../../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { NodeValue } from '../../../../../eval/resolve/node-value';
import type { RNode } from '../../../../../../r-bridge/lang-4.x/ast/model/model';
import { isNotUndefined } from '../../../../../../util/assert';
import { ArgProp, type FnSig } from '../../../../../environments/built-in-props';

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
	const names = NodeValue.stringsOf(name.nodeId, Resolve.info(graph, ctx));
	if(names === undefined) {
		return false;
	}
	for(const n of names) {
		/* the frames of the body hold what it bound before the lookup, the global names are those at the call */
		const local = vertex.environment === undefined ? undefined : Resolve.byName(n, vertex.environment);
		const defs = local?.some(d => !NodeId.isBuiltIn(d.nodeId) && !graph.isRoot(d.nodeId)) ? local : Resolve.byName(n, environment);
		for(const { nodeId } of defs ?? []) {
			if(!NodeId.isBuiltIn(nodeId) && !ProgramOrder.definedLater(nodeId, runsOnceAt, graph)) {
				graph.addEdge(vertex.id, nodeId, EdgeType.Returns | EdgeType.Reads);
			}
		}
	}
	graph.unknownSideEffects.delete(NodeId.normalize(vertex.id));
	return true;
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
