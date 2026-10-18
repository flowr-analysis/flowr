import { type DependencyInfo, Constant, Unknown } from './dependencies-query-format';
import { DfgVertex, type DataflowGraphVertexFunctionCall } from '../../../dataflow/graph/vertex';
import type { DataflowGraph } from '../../../dataflow/graph/graph';
import { DfEdge, EdgeType } from '../../../dataflow/graph/edge';
import { Identifier } from '../../../dataflow/environments/identifier';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { ReadOnlyFlowrAnalyzerContext } from '../../../project/context/flowr-analyzer-context';
import type { FlowrConfig } from '../../../config';
import { getArgumentStringValue } from '../../../dataflow/eval/resolve/resolve-argument';
import { SourceRange } from '../../../util/range';
import { argumentRoles, handedOn } from './data-flow';
import type { DataflowInformation } from '../../../dataflow/info';
import { ArgProp } from '../../../dataflow/environments/built-in-props';

interface TitleArgument {
	readonly argIdx?:  number
	readonly argName?: string
}

/** where a call states the title of the plot it draws onto; every other call is asked for `main` */
const TitleArguments: Readonly<Record<string, TitleArgument>> = {
	ggtitle: { argIdx: 0, argName: 'label' },
	labs:    { argName: 'title' }
};
const DefaultTitleArgument: TitleArgument = { argName: 'main' };

function isResolved(value: string | undefined): value is string {
	return value !== undefined && value !== Unknown && value !== Constant;
}

function titleOf(call: DataflowGraphVertexFunctionCall, dfg: DataflowGraph, config: FlowrConfig, ctx: ReadOnlyFlowrAnalyzerContext): string | undefined {
	const { argIdx, argName } = TitleArguments[Identifier.getName(call.name)] ?? DefaultTitleArgument;
	const values = getArgumentStringValue(config.solver.variables, dfg, call, argIdx, argName, true, ctx);
	return values?.values().flatMap(v => [...v]).find(isResolved);
}

/** the plot roots (by id) the value `start` is built from, looking through variables and the calls handing a value on */
function rootsReaching(dataflow: DataflowInformation, ast: NormalizedAst, start: NodeId, roots: ReadonlySet<NodeId>): NodeId[] {
	const dfg = dataflow.graph;
	const found = new Set<NodeId>();
	const seen = new Set<NodeId>();
	const todo = [start];
	for(let id = todo.pop(); id !== undefined; id = todo.pop()) {
		if(seen.has(id)) {
			continue;
		}
		seen.add(id);
		const vertex = dfg.getVertex(id);
		if(roots.has(id)) {
			found.add(id);
		} else if(DfgVertex.isUse(vertex)) {
			todo.push(...dfg.edgesFrom(id).entries().filter(([, e]) => DfEdge.includesType(e, EdgeType.Reads)).map(([to]) => to));
		} else if(DfgVertex.isVariableDefinition(vertex)) {
			todo.push(...dfg.edgesFrom(id).entries().filter(([, e]) => DfEdge.includesType(e, EdgeType.DefinedBy)).map(([to]) => to));
		} else if(DfgVertex.isFunctionCall(vertex)) {
			todo.push(...handedOn(dataflow, ast, vertex));
		}
	}
	return [...found];
}

/**
 * Describes the plots (the visualizations nothing is linked to): the `title` their `ggtitle`, `labs(title = )` or
 * `main =` states, and the file `ggsave` writes them to (the one of the `plot` it is given, else the last plot it is
 * linked to, as ggplot's `last_plot()`). A plot drawn on a graphics device that writes to a file is described by {@link linkPlotsToDevices}.
 * The title of the last statement stating one wins.
 */
export function describePlots(written: readonly DependencyInfo[], plots: DependencyInfo[], dataflow: DataflowInformation, ast: NormalizedAst, config: FlowrConfig, ctx: ReadOnlyFlowrAnalyzerContext): void {
	const dfg = dataflow.graph;
	const located = (id: NodeId) => ast.idMap.get(id)?.location;
	const bySource = (a: NodeId, b: NodeId) => {
		const [from, to] = [located(a), located(b)];
		return from && to ? SourceRange.compare(from, to) : 0;
	};
	const roots = new Map<NodeId, number>();
	plots.forEach(({ nodeId, linkedIds }, at) => {
		if(nodeId !== undefined && !linkedIds?.length) {
			roots.set(nodeId, at);
		}
	});
	if(roots.size === 0) {
		return;
	}
	const parts = new Map<NodeId, NodeId[]>([...roots.keys()].map(root => [root, [root]]));
	for(const { nodeId, linkedIds } of plots) {
		for(const root of linkedIds ?? []) {
			if(nodeId !== undefined) {
				parts.get(root)?.push(nodeId);
			}
		}
	}
	for(const [root, ids] of parts) {
		const title = ids.sort(bySource).map(id => dfg.getVertex(id)).filter(v => DfgVertex.isFunctionCall(v))
			.map(call => titleOf(call, dfg, config, ctx)).filter(isResolved).at(-1);
		if(title !== undefined) {
			const at = roots.get(root) as number;
			plots[at] = { ...plots[at], title };
		}
	}

	const rootIds = new Set(roots.keys());
	/* an addon names the plot it builds, a root itself */
	const rootsOf = (id: NodeId) => rootIds.has(id) ? [id] : plots.find(p => p.nodeId === id)?.linkedIds ?? [];
	for(const { nodeId, functionName, value, linkedIds } of written) {
		const call = nodeId === undefined ? undefined : dfg.getVertex(nodeId);
		if(!isResolved(value) || !DfgVertex.isFunctionCall(call) || Identifier.getName(functionName) !== 'ggsave') {
			continue;
		}
		const plot = argumentRoles(dataflow, call).filter(([, roles]) => (roles & ArgProp.Value) !== 0).map(([arg]) => arg);
		const saved = plot.length > 0 ? plot.flatMap(p => rootsReaching(dataflow, ast, p, rootIds)) : (linkedIds ?? []).flatMap(rootsOf);
		for(const root of saved) {
			const at = roots.get(root) as number;
			plots[at] = { ...plots[at], savedTo: value };
		}
	}
}
