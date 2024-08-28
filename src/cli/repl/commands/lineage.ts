import type { ReplCommand } from './main'
import { PipelineExecutor } from '../../../core/pipeline-executor'
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines'
import type { RShell } from '../../../r-bridge/shell'
import { requestFromInput } from '../../../r-bridge/retriever'
import type { SingleSlicingCriterion } from '../../../slicing/criterion/parse'
import { slicingCriterionToId } from '../../../slicing/criterion/parse'
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id'
import type { OutgoingEdges } from '../../../dataflow/graph/graph'
import type { DataflowGraphEdge } from '../../../dataflow/graph/edge'
import { edgeIncludesType, EdgeType } from '../../../dataflow/graph/edge'
import type { DataflowGraphVertexInfo } from '../../../dataflow/graph/vertex'
import type { DataflowInformation } from '../../../dataflow/info'
import type { NormalizedAst } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate'

function splitAt(str: string, idx: number) {
	return [str.slice(0, idx), str.slice(idx)]
}

async function getDfg(shell: RShell, remainingLine: string) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps()
}

function filterRelevantEdges(edge: DataflowGraphEdge) {
	return edgeIncludesType(EdgeType.DefinedBy | EdgeType.DefinedByOnCall | EdgeType.Returns | EdgeType.Reads, edge.types)
}

function pushRelevantEdges(queue: [NodeId, DataflowGraphEdge][], outgoingEdges: OutgoingEdges) {
	queue.push(...[...outgoingEdges].filter(([_, edge]) => filterRelevantEdges(edge)))
	return queue
}

/**
 * Get the lineage of a node in the dataflow graph
 *
 * @param criterion - The criterion to get the lineage of
 * @param ast       - The normalized AST
 * @param dfg       - The dataflow graph
 * @returns The lineage of the node represented as a list of node ids
 */
export function getLineage(criterion: SingleSlicingCriterion, ast: NormalizedAst, dfg: DataflowInformation) {
	const [vertex, outgoingEdges] = dfg.graph.get(slicingCriterionToId(criterion, ast)) as [DataflowGraphVertexInfo, OutgoingEdges]
	const result: NodeId[] = [vertex.id]
	const edgeQueue = pushRelevantEdges([], outgoingEdges)

	while(edgeQueue.length > 0) {
		const [target] = edgeQueue.shift() as [NodeId, DataflowGraphEdge]
		result.push(target)

		const outgoingEdges = dfg.graph.outgoingEdges(target)
		if(outgoingEdges !== undefined) {
			pushRelevantEdges(edgeQueue, outgoingEdges)
		}
	}

	return result
}

export const getLineageCommand: ReplCommand = {
	description:  'Get the lineage of an R object',
	usageExample: ':lineage',
	aliases:      ['lin'],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const [criterion, rest] = splitAt(remainingLine, remainingLine.indexOf(' '))
		const { dataflow: dfg, normalize: ast } = await getDfg(shell, rest)
		const lineageIds = getLineage(criterion as SingleSlicingCriterion, ast, dfg)
		output.stdout(lineageIds.join(', '))
	}
}