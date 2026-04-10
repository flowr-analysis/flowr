import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type DataflowGraph , getReferenceOfArgument } from '../../../dataflow/graph/graph';
import { visitCfgInReverseOrder } from '../../../control-flow/simple-visitor';
import { type DataflowGraphVertexFunctionCall, isFunctionCallVertex } from '../../../dataflow/graph/vertex';
import { edgeIncludesType, EdgeType } from '../../../dataflow/graph/edge';
import { resolveByName } from '../../../dataflow/environments/resolve-by-name';
import { ReferenceType } from '../../../dataflow/environments/identifier';
import { isBuiltIn } from '../../../dataflow/environments/built-in';
import { assertUnreachable } from '../../../util/assert';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { LinkToLastCall } from './call-context-query-format';
import { CascadeAction } from './cascade-action';
import type { PromotedLinkTo } from './call-context-query-executor';
import type { ReadonlyFlowrAnalysisProvider } from '../../../project/flowr-analyzer';
import { CfgKind } from '../../../project/cfg-kind';
import type { ControlFlowGraph } from '../../../control-flow/control-flow-graph';

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
		.filter(([, { types }]) => edgeIncludesType(types, EdgeType.Calls))
		.map(([t]) => t)
		.toArray()
    ;

	let builtIn = false;

	if(info.environment !== undefined) {
		/*
         * for performance and scoping reasons, flowR will not identify the global linkage,
         * including any potential built-in mapping.
         */
		const reResolved = resolveByName(info.name, info.environment, ReferenceType.Unknown);
		if(reResolved?.some(t => isBuiltIn(t.definedAt))) {
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
			if(callTargets.every(isBuiltIn)) {
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
	const totalIndex = argument.name ? call.args.findIndex(arg => arg !== EmptyArgument && arg.name === argument.name) : -1;
	let refAtIndex: NodeId | undefined;
	if(totalIndex < 0) {
		const references = call.args.filter(arg => arg !== EmptyArgument && !arg.name).map(getReferenceOfArgument);
		refAtIndex = references[argument.index];
	} else {
		const arg = call.args[totalIndex];
		refAtIndex = getReferenceOfArgument(arg);
	}
	if(refAtIndex === undefined) {
		return undefined;
	}
	let valueNode = graph.idMap?.get(refAtIndex);
	if(valueNode?.type === RType.Argument) {
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
	knownCalls?: Map<NodeId, Required<DataflowGraphVertexFunctionCall>>
): Promise<NodeId[]> {
	const graph = (await analyzer.dataflow()).graph;
	const cfg = (await analyzer.controlflow([], CfgKind.WithDataflow)).graph;

	return identifyLinkToLastCallRelationSync(from, cfg, graph, l, knownCalls);
}

/**
 * Synchronous version of {@link identifyLinkToLastCallRelation}.
 */
export function identifyLinkToLastCallRelationSync(
	from: NodeId,
	cfg: ControlFlowGraph,
	graph: DataflowGraph,
	{ callName, cascadeIf, ignoreIf }: LinkToLastCall<RegExp> | PromotedLinkTo<LinkToLastCall<RegExp>>,
	knownCalls?: Map<NodeId, Required<DataflowGraphVertexFunctionCall>>
): NodeId[] {
	if(ignoreIf?.(from, graph)) {
		return [];
	}
	const found: NodeId[] = [];
	const cNameCheck = callName instanceof RegExp ? ({ name }: DataflowGraphVertexFunctionCall) => callName.test(name)
		: ({ name }: DataflowGraphVertexFunctionCall) => callName.has(name);

	const getVertex = knownCalls ?
		(node: NodeId) => knownCalls.get(node) :
		(node: NodeId) => {
			const v = graph.getVertex(node);
			return isFunctionCallVertex(v) ? v : undefined;
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