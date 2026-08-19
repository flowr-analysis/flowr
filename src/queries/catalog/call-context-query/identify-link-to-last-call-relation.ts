import { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type DataflowGraph, FunctionArgument } from '../../../dataflow/graph/graph';
import { visitCfgInReverseOrder } from '../../../control-flow/simple-visitor';
import { type DataflowGraphVertexFunctionCall, FunctionCallVertex } from '../../../dataflow/graph/vertex';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { Identifier } from '../../../dataflow/environments/identifier';
import { assertUnreachable } from '../../../util/assert';
import type { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { LinkToLastCall } from './call-context-query-format';
import { CascadeAction } from './cascade-action';
import type { PromotedCallTest, PromotedLinkTo } from './call-context-query-executor';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { CfgKind } from '../../../project/cfg-kind';
import type { ControlFlowGraph } from '../../../control-flow/control-flow-graph';
import { Resolve } from '../../../dataflow/environments/resolve-helper';
import { RArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-argument';

type KnownCalls = Map<NodeId, Required<DataflowGraphVertexFunctionCall>>;

export enum CallTargets {
	/** call targets a function that is not defined locally in the script (e.g., the call targets a library function) */
	OnlyGlobal = 'global',
	/** call targets a function that is defined locally or globally, but must include a global function */
	MustIncludeGlobal = 'must-include-global',
	/** call targets a function that is defined locally  */
	OnlyLocal = 'local',
	/** call targets a function that is defined locally or globally, but must include a local function */
	MustIncludeLocal = 'must-include-local',
	/** call targets a function that is defined locally or globally */
	Any = 'any'
}

/**
 * Determines whether the given function call node satisfies the specified call target condition.
 */
export function satisfiesCallTargets(info: DataflowGraphVertexFunctionCall, graph: DataflowGraph, callTarget: CallTargets): NodeId[] | 'no' {
	const outgoing = graph.outgoingEdges(info.id);
	if(outgoing === undefined) {
		return 'no';
	}
	const callTargets = outgoing.entries()
		.filter(([, e]) => DfEdge.includesType(e, EdgeType.Calls))
		.map(([t]) => t)
		.toArray()
    ;

	let builtIn = false;

	/*
     * a resolved call target that is itself a built-in - a base builtin or a loaded-package export
     * like `ggplot2::ggplot` (added by `library()`) - is a global resolution, so such calls count
     * as global for every call-context query (`callTargetNamespace` then narrows down to the package).
     */
	if(callTargets.some(t => NodeId.isBuiltIn(t))) {
		builtIn = true;
	}

	if(info.environment !== undefined) {
		/*
         * for performance and scoping reasons, flowR will not identify the global linkage,
         * including any potential built-in mapping.
         */
		const reResolved = Resolve.byName(info.name, info.environment);
		if(reResolved?.some(t => NodeId.isBuiltIn(t.definedAt))) {
			builtIn = true;
		}
	} else {
		/* if we have a call with an unbound environment,
         * this only happens if we are sure of built-in relations and want to save references
         */
		builtIn = true;
	}

	switch(callTarget) {
		case CallTargets.Any:
			return callTargets;
		case CallTargets.OnlyGlobal:
			if(callTargets.every(NodeId.isBuiltIn)) {
				return builtIn ? ['built-in'] : [];
			} else {
				return 'no';
			}
		case CallTargets.MustIncludeGlobal:
			return builtIn || callTargets.length === 0 ? [...callTargets, 'built-in'] : 'no';
		case CallTargets.OnlyLocal:
			return !builtIn && callTargets.length > 0 ? callTargets : 'no';
		case CallTargets.MustIncludeLocal:
			if(callTargets.length > 0) {
				return builtIn ? [...callTargets, 'built-in'] : callTargets;
			} else {
				return 'no';
			}
		default:
			assertUnreachable(callTarget);
	}
}

/**
 * Gets the value node of the specified argument in the given function call, if it exists and matches the allowed types.
 */
export function getValueOfArgument<Types extends readonly RType[] = readonly RType[]>(
	graph: DataflowGraph, call: DataflowGraphVertexFunctionCall | undefined, argument: { name?: string, index: number }, additionalAllowedTypes?: Types
): (RNodeWithParent & { type: Types[number] } ) | undefined {
	if(!call) {
		return undefined;
	}
	const totalIndex = argument.name ? call.args.findIndex(arg => FunctionArgument.hasName(arg, argument.name)) : -1;
	let refAtIndex: NodeId | undefined;
	if(totalIndex < 0) {
		const references = call.args.filter(FunctionArgument.isPositional).map(FunctionArgument.getReference);
		refAtIndex = references[argument.index];
	} else {
		const arg = call.args[totalIndex];
		refAtIndex = FunctionArgument.getReference(arg);
	}
	if(refAtIndex === undefined) {
		return undefined;
	}
	let valueNode = graph.idMap?.get(refAtIndex);
	if(RArgument.is(valueNode)) {
		valueNode = valueNode.value;
	}
	if(valueNode) {
		return !additionalAllowedTypes || additionalAllowedTypes.includes(valueNode.type) ? valueNode : undefined;
	}
}

/**
 * **Please refer to {@link identifyLinkToRelation}.**
 *
 * Identifies nodes that link to the last call of a specified function from a given starting node in the control flow graph.
 * If you pass on `knownCalls` (e.g., produced by {@link getCallsInCfg}), this will only respect the functions
 * listed there and ignore any other calls. This can be also used to speed up the process if you already have
 * the known calls available.
 * @see {@link identifyLinkToLastCallRelationSync} for the synchronous version.
 */
export async function identifyLinkToLastCallRelation(
	from: NodeId,
	analyzer: ReadonlyFlowrAnalysisProvider,
	l: LinkToLastCall<RegExp> | PromotedLinkTo<LinkToLastCall<RegExp>>,
	knownCalls?: KnownCalls
): Promise<NodeId[]> {
	const graph = (await analyzer.dataflow()).graph;
	const cfg = (await analyzer.controlflow([], CfgKind.WithDataflow)).graph;

	return identifyLinkToLastCallRelationSync(from, cfg, graph, l, knownCalls);
}

/**
 * Memoizes, per set of known calls and per `callName`, whether any call can match it at all. One link keeps the same
 * `callName` object across every call site it is evaluated against, so identity is enough to key it.
 */
const candidatesPerCallSet = new WeakMap<KnownCalls, Map<RegExp | PromotedCallTest, boolean>>();

function anyCallMatches(knownCalls: KnownCalls, callName: RegExp | PromotedCallTest, matches: (vertex: DataflowGraphVertexFunctionCall) => boolean): boolean {
	let perName = candidatesPerCallSet.get(knownCalls);
	if(perName === undefined) {
		perName = new Map();
		candidatesPerCallSet.set(knownCalls, perName);
	}
	const cached = perName.get(callName);
	if(cached !== undefined) {
		return cached;
	}
	const matched = knownCalls.values().some(matches);
	perName.set(callName, matched);
	return matched;
}

/**
 * Synchronous version of {@link identifyLinkToLastCallRelation}.
 */
export function identifyLinkToLastCallRelationSync(
	from: NodeId,
	cfg: ControlFlowGraph,
	graph: DataflowGraph,
	{ callName, cascadeIf, ignoreIf }: LinkToLastCall<RegExp> | PromotedLinkTo<LinkToLastCall<RegExp>>,
	knownCalls?: KnownCalls
): NodeId[] {
	if(ignoreIf?.(from, graph)) {
		return [];
	}
	const found: NodeId[] = [];
	const cNameCheck = callName instanceof RegExp ? ({ name }: DataflowGraphVertexFunctionCall) => callName.test(Identifier.getName(name))
		: ({ name }: DataflowGraphVertexFunctionCall) => callName(Identifier.getName(name));

	/* only a call matching `callName` is ever collected, so with none in the whole graph every walk below returns
	 * nothing: skipping them turns one reverse walk per call site into a single scan (a `sink` redirect in a
	 * script that never sinks is the common case) */
	if(knownCalls !== undefined && !anyCallMatches(knownCalls, callName, cNameCheck)) {
		return [];
	}

	const getVertex = knownCalls ?
		(node: NodeId) => knownCalls.get(node) :
		(node: NodeId) => {
			const v = graph.getVertex(node);
			return FunctionCallVertex.is(v) ? v : undefined;
		};

	visitCfgInReverseOrder(cfg, [from], node => {
		/* we ignore the start id as it cannot be the last call */
		if(node === from) {
			return;
		}
		const vertex = getVertex(node);
		if(vertex === undefined) {
			return;
		}
		if(cNameCheck(vertex)) {
			const act = cascadeIf ? cascadeIf(vertex, from, graph) : CascadeAction.Stop;
			if(act === CascadeAction.Skip) {
				return;
			}
			const tar = satisfiesCallTargets(vertex, graph, CallTargets.MustIncludeGlobal);
			if(tar !== 'no') {
				found.push(node);
			}
			return act === CascadeAction.Stop;
		}
	});

	return found;
}