import type { DataflowGraph } from '../graph/graph';
import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	LinkTo,
	LinkToLastCall,
	LinkToNestedCall
} from '../../queries/catalog/call-context-query/call-context-query-format';
import { getValueOfArgument } from '../../queries/catalog/call-context-query/identify-link-to-last-call-relation';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';
import { CascadeAction } from '../../queries/catalog/call-context-query/cascade-action';
import { isFunctionCallVertex, type DataflowGraphVertexInfo } from '../graph/vertex';

export const enum UnknownSideEffectCallbackRef {
	PlotCreateIgnoreIf = 'builtins.plot-create.ignore-if',
	PlotAddonIgnoreIf = 'builtins.plot-addon.ignore-if',
	PlotAddonCascadeIf = 'builtins.plot-addon.cascade-if',
}

type CallbackRef = UnknownSideEffectCallbackRef;
type LinkToWithCallbackRefs = (LinkToLastCall<RegExp> | LinkToNestedCall<RegExp>) & {
	ignoreIfRef?:  CallbackRef | string;
	cascadeIfRef?: CallbackRef | string;
};

/** Attaches callback reference metadata to a link definition without changing external query types. */
export function attachLinkToCallbackRefs(
	linkTo: LinkTo<RegExp>,
	refs: Pick<LinkToWithCallbackRefs, 'ignoreIfRef' | 'cascadeIfRef'>
): LinkTo<RegExp> {
	return {
		...(linkTo as LinkToWithCallbackRefs),
		...refs
	} as LinkTo<RegExp>;
}

const PlotFunctionsWithAddParam = new Set([
	'map', 'matplot', 'barplot', 'boxplot', 'curve', 'image', 'plotCI', 'bandplot', 'barplot2', 'bubbleplot'
]);

/** Checks whether plot creation calls should be ignored for side-effect linking. */
export function plotCreateIgnoreIf(source: NodeId, graph: DataflowGraph): boolean {
	const sourceVertex = graph.getVertex(source);
	if(!isFunctionCallVertex(sourceVertex)) {
		return false;
	}

	/* map with add = true appends to an existing plot */
	return (PlotFunctionsWithAddParam.has(sourceVertex.name) && getValueOfArgument(graph, sourceVertex, {
		index: -1,
		name:  'add'
	}, [RType.Logical])?.content === true);
}

/** Checks whether plot addon calls should be ignored for side-effect linking. */
export function plotAddonIgnoreIf(source: NodeId, graph: DataflowGraph): boolean {
	const sourceVertex = graph.getVertex(source);
	if(!isFunctionCallVertex(sourceVertex)) {
		return false;
	}

	/* map with add = true appends to an existing plot */
	return (PlotFunctionsWithAddParam.has(sourceVertex.name) && getValueOfArgument(graph, sourceVertex, {
		index: -1,
		name:  'add'
	}, [RType.Logical])?.content !== true);
}

/** Controls cascading when linking plot addons to the last plotting call. */
export function plotAddonCascadeIf(target: DataflowGraphVertexInfo, _: NodeId, graph: DataflowGraph): CascadeAction {
	if(!isFunctionCallVertex(target) || target.name !== 'map') {
		return CascadeAction.Stop;
	}

	/* map with add = true appends to an existing plot */
	return getValueOfArgument(graph, target, {
		index: 11,
		name:  'add'
	}, [RType.Logical])?.content === true ? CascadeAction.Continue : CascadeAction.Stop;
}

const ignoreIfRegistry = new Map<string, (source: NodeId, graph: DataflowGraph) => boolean>([
	[UnknownSideEffectCallbackRef.PlotCreateIgnoreIf, plotCreateIgnoreIf],
	[UnknownSideEffectCallbackRef.PlotAddonIgnoreIf, plotAddonIgnoreIf],
]);

const cascadeIfRegistry = new Map<string, (target: DataflowGraphVertexInfo, from: NodeId, graph: DataflowGraph) => CascadeAction>([
	[UnknownSideEffectCallbackRef.PlotAddonCascadeIf, plotAddonCascadeIf],
]);

function ensureCallbackRefs(linkTo: LinkToWithCallbackRefs): LinkToWithCallbackRefs {
	const out: LinkToWithCallbackRefs = { ...linkTo };

	if(out.ignoreIf && !out.ignoreIfRef) {
		if(out.ignoreIf === plotCreateIgnoreIf) {
			out.ignoreIfRef = UnknownSideEffectCallbackRef.PlotCreateIgnoreIf;
		} else if(out.ignoreIf === plotAddonIgnoreIf) {
			out.ignoreIfRef = UnknownSideEffectCallbackRef.PlotAddonIgnoreIf;
		}
	}

	if(out.type === 'link-to-last-call' && out.cascadeIf && !out.cascadeIfRef && out.cascadeIf === plotAddonCascadeIf) {
		out.cascadeIfRef = UnknownSideEffectCallbackRef.PlotAddonCascadeIf;
	}

	return out;
}

/** Removes callback functions from linkTo objects while preserving callback reference tokens. */
export function stripNonSerializableLinkToCallbacks(linkTo: LinkTo<RegExp>): LinkTo<RegExp> {
	const withRefs = ensureCallbackRefs(linkTo as LinkToWithCallbackRefs);
	if(withRefs.type === 'link-to-last-call') {
		const { ignoreIf: _ignoreIf, cascadeIf: _cascadeIf, ...rest } = withRefs;
		return rest as LinkTo<RegExp>;
	}

	const { ignoreIf: _ignoreIf, ...rest } = withRefs;
	return rest as LinkTo<RegExp>;
}

/** Reattaches callback functions to linkTo objects using callback reference tokens. */
export function hydrateLinkToCallbacks(linkTo: LinkTo<RegExp>): LinkTo<RegExp> {
	const withRefs = linkTo as LinkToWithCallbackRefs;
	const ignoreIf = withRefs.ignoreIf ?? (withRefs.ignoreIfRef ? ignoreIfRegistry.get(withRefs.ignoreIfRef) : undefined);

	if(withRefs.type === 'link-to-last-call') {
		const cascadeIf = withRefs.cascadeIf ?? (withRefs.cascadeIfRef ? cascadeIfRegistry.get(withRefs.cascadeIfRef) : undefined);
		return {
			...withRefs,
			ignoreIf,
			cascadeIf
		};
	}

	return {
		...withRefs,
		ignoreIf
	};
}
