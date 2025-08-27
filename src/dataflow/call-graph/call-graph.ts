import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { recoverContent } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { DefaultMap } from '../../util/collections/defaultmap';
import type { DataflowGraph } from '../graph/graph';
import type { DataflowGraphVertexFunctionDefinition } from '../graph/vertex';
import { VertexType } from '../graph/vertex';
import { getOriginInDfg, OriginType } from '../origin/dfg-get-origin';
import { isNotUndefined } from '../../util/assert';

export class CallGraph {
	private readonly edges: DefaultMap<NodeId, Set<NodeId>>;


	/**
     * Prefer using {@link CallGraph.create} to create a call graph from a dataflow graph
     */
	public constructor() {
		this.edges     = new DefaultMap<NodeId, Set<NodeId>>(() => new Set<NodeId>());
	}


	// TODO: support dynamic environment passing
	public static create(dfg: DataflowGraph): CallGraph {
		const cg = new CallGraph();
		for(const [id, info] of dfg.vertices(true)) {
			if(info.tag === VertexType.FunctionCall) {
				handleFunctionCall(id, dfg, cg);
			} else if(info.tag === VertexType.FunctionDefinition) {
				handleFunctionDefinition(info, dfg, cg);
			}
		}
		return cg;
	}

	public addEdge(callerId: NodeId, calleeId: NodeId): this {
		this.edges.get(callerId).add(calleeId);
		return this;
	}

	getCalls(callerId: NodeId): Set<NodeId> {
		return this.edges.get(callerId);
	}

	toJSON() {
		return { edges: Array.from(this.edges.entries()).map(([k, v]) => [k, Array.from(v)]) };
	}

	toMermaid(dfg: DataflowGraph): string {
		const lines = ['flowchart TD'];
		const gl = (id: NodeId) => {
			return String(id).startsWith('builtin:') ? id : recoverContent(id, dfg);
		};
		for(const [from, tos] of this.edges.entries()) {
			const fromLabel = gl(from);
			lines.push(`    ${from}["${fromLabel} (${from})"]`);
			for(const to of tos) {
				const toLabel = gl(to);
				lines.push(`    ${to}["${toLabel} (${to})"]`);
				lines.push(`    ${from} --> ${to}`);
			}
		}
		return lines.join('\n');
	}
}


function handleFunctionCall(id: NodeId, dfg: DataflowGraph, cg: CallGraph) {
	const origins = getOriginInDfg(dfg, id);
	for(const origin of origins ?? []) {
		if(origin.type === OriginType.FunctionCallOrigin) {
			cg.addEdge(id, origin.id);
		} else if(origin.type === OriginType.BuiltInFunctionOrigin) {
			cg.addEdge(id, origin.proc);
		}
	}
}

// take all calls within the body and link them to the function definition
function handleFunctionDefinition(def: DataflowGraphVertexFunctionDefinition, dfg: DataflowGraph, cg: CallGraph) {
	const body = def.subflow.graph;
	for(const info of [...body].map(v => dfg.getVertex(v, true)).filter(isNotUndefined)) {
		if(info.tag === VertexType.FunctionCall) {
			cg.addEdge(def.id, info.id);
		}
	}

}
