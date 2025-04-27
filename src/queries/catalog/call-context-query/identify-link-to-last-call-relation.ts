import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { getReferenceOfArgument } from '../../../dataflow/graph/graph';
import { visitCfgInReverseOrder } from '../../../control-flow/simple-visitor';
import type { DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import { VertexType } from '../../../dataflow/graph/vertex';
import { edgeIncludesType, EdgeType } from '../../../dataflow/graph/edge';
import { resolveByName } from '../../../dataflow/environments/resolve-by-name';
import { ReferenceType } from '../../../dataflow/environments/identifier';
import { isBuiltIn } from '../../../dataflow/environments/built-in';
import { assertUnreachable } from '../../../util/assert';
import { RType } from '../../../r-bridge/lang-4.x/ast/model/type';
import type { RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { EmptyArgument } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { LinkTo } from './call-context-query-format';
import { CascadeAction } from './cascade-action';
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

export function satisfiesCallTargets(id: NodeId, graph: DataflowGraph, callTarget: CallTargets): NodeId[] | 'no' {
	const callVertex = graph.get(id);
	if(callVertex === undefined || callVertex[0].tag !== VertexType.FunctionCall) {
		return 'no';
	}
	const [info, outgoing] = callVertex;
	const callTargets = [...outgoing]
		.filter(([, e]) => edgeIncludesType(e.types, EdgeType.Calls))
		.map(([t]) => t)
    ;

	let builtIn = false;

	if(info.environment === undefined) {
		/* if we have a call with an unbound environment,
         * this only happens if we are sure of built-in relations and want to save references
         */
		builtIn = true;
	} else {
		/*
         * for performance and scoping reasons, flowR will not identify the global linkage,
         * including any potential built-in mapping.
         */
		const reResolved = resolveByName(info.name, info.environment, ReferenceType.Unknown);
		if(reResolved?.some(t => isBuiltIn(t.definedAt))) {
			builtIn = true;
		}
	}

	switch(callTarget) {
		case CallTargets.Any:
			return callTargets;
		case CallTargets.OnlyGlobal:
			if(callTargets.length === 0) {
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


export function identifyLinkToLastCallRelation(
	from: NodeId,
	cfg: ControlFlowGraph,
	graph: DataflowGraph,
	{ callName, ignoreIf, cascadeIf }: LinkTo<RegExp>
): NodeId[] {
	const found: NodeId[] = [];
	if(ignoreIf && ignoreIf(from, graph)) {
		return found;
	}
	visitCfgInReverseOrder(cfg, [from], node => {
		/* we ignore the start id as it cannot be the last call */
		if(node === from) {
			return;
		}
		const vertex = graph.get(node);
		if(vertex === undefined || vertex[0].tag !== VertexType.FunctionCall) {
			return;
		}
		if(callName.test(vertex[0].name)) {
			const act = cascadeIf ? cascadeIf(vertex[0], from, graph) : CascadeAction.Stop;
			if(act === CascadeAction.Skip) {
				return;
			}
			const tar = satisfiesCallTargets(vertex[0].id, graph, CallTargets.MustIncludeGlobal);
			if(tar === 'no') {
				return act === CascadeAction.Stop;
			}
			found.push(node);
			return act === CascadeAction.Stop;
		}
	});
	return found;
}
