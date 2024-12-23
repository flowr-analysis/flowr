import type { ReplCommand } from './repl-main';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../r-bridge/retriever';
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse';
import { slicingCriterionToId } from '../../../slicing/criterion/parse';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph, OutgoingEdges } from '../../../dataflow/graph/graph';
import type { DataflowGraphEdge } from '../../../dataflow/graph/edge';
import { edgeIncludesType, EdgeType } from '../../../dataflow/graph/edge';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { guard } from '../../../util/assert';
import type { KnownParser } from '../../../r-bridge/parser';

function splitAt(str: string, idx: number) {
	return [str.slice(0, idx), str.slice(idx)];
}

async function getDfg(parser: KnownParser, remainingLine: string) {
	return await createDataflowPipeline(parser, {
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}

function filterRelevantEdges(edge: DataflowGraphEdge) {
	return edgeIncludesType(EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns | EdgeType.Reads, edge.types);
}

function pushRelevantEdges(queue: [NodeId, DataflowGraphEdge][], outgoingEdges: OutgoingEdges) {
	queue.push(...[...outgoingEdges].filter(([_, edge]) => filterRelevantEdges(edge)));
}

/**
 * Get the lineage of a node in the dataflow graph
 *
 * @param criterion - The criterion to get the lineage of
 * @param graph - The dataflow graph to search in
 * @param idMap - The ID map to use for resolving the criterion (will default to that shipped with the dfgraph)
 * @returns The lineage of the node represented as a set of node ids
 */
export function getLineage(criterion: SingleSlicingCriterion, graph: DataflowGraph, idMap?: AstIdMap): Set<NodeId> {
	idMap ??= graph.idMap;
	guard(idMap !== undefined, 'The ID map is required to get the lineage of a node');
	const src = graph.get(slicingCriterionToId(criterion, idMap));
	guard(src !== undefined, 'The ID pointed to by the criterion does not exist in the dataflow graph');
	const [vertex, outgoingEdges] = src;
	const result: Set<NodeId> = new Set([vertex.id]);
	const edgeQueue: [NodeId, DataflowGraphEdge][] = [];
	pushRelevantEdges(edgeQueue, outgoingEdges);

	while(edgeQueue.length > 0) {
		const [target] = edgeQueue.shift() as [NodeId, DataflowGraphEdge];
		if(result.has(target)) {
			continue;
		}

		result.add(target);

		const outgoingEdges = graph.outgoingEdges(target);
		if(outgoingEdges !== undefined) {
			pushRelevantEdges(edgeQueue, outgoingEdges);
		}
	}

	return result;
}

export const lineageCommand: ReplCommand = {
	description:  'Get the lineage of an R object',
	usageExample: ':lineage',
	aliases:      ['lin'],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const [criterion, rest] = splitAt(remainingLine, remainingLine.indexOf(' '));
		const { dataflow: dfg } = await getDfg(shell, rest);
		const lineageIds = getLineage(criterion as SingleSlicingCriterion, dfg.graph);
		output.stdout([...lineageIds].join('\n'));
	}
};
