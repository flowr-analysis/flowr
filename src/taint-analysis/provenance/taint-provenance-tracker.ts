import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AnyAbstractDomain } from '../../abstract-interpretation/domains/abstract-domain';
import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { DataflowGraphVertexFunctionCall } from '../../dataflow/graph/vertex';
import type { ResolvedTaint } from '../taint-resolve';
import { type TaintProvenanceCall, TaintProvenanceGraph } from './taint-provenance-graph';

export interface TaintProvenanceTracker {
	/**
	 * Records a call whose taint was just resolved.
	 * @param call     - The call the taint was resolved for
	 * @param resolved - The resolved taint of the call
	 */
	record(call: DataflowGraphVertexFunctionCall, resolved: ResolvedTaint): void
	/**
	 * Builds the provenance graph once the abstract interpretation has finished.
	 * @param dfg     - The dataflow graph of the analysed program
	 * @param valueOf - The taint of a node at the end of the analysis
	 */
	graph(dfg: DataflowGraph, valueOf: (id: NodeId) => AnyAbstractDomain | undefined): TaintProvenanceGraph
}

/**
 * The default {@link TaintProvenanceTracker}. Besides the calls whose taints the analysis resolves, it records the
 * inputs of these calls and the variables they read, so the graph shows where each value stems from.
 */
export class CallProvenanceTracker implements TaintProvenanceTracker {
	private readonly calls = new Map<NodeId, TaintProvenanceCall>();

	public record(call: DataflowGraphVertexFunctionCall, { value, role, category, record, recorder }: ResolvedTaint): void {
		const { inputs, ...recorded } = recorder === undefined ? record : recorder(record) ?? { ...record, passthrough: true };
		this.calls.set(call.id, { value, inputs, resolution: { role, category, ...recorded } });
	}

	public graph(dfg: DataflowGraph, valueOf: (id: NodeId) => AnyAbstractDomain | undefined): TaintProvenanceGraph {
		return TaintProvenanceGraph.compute(dfg, this.calls, valueOf);
	}
}
