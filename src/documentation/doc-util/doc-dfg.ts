import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RShell } from '../../r-bridge/shell';
import type { MermaidMarkdownMark } from '../../util/mermaid/dfg';
import { graphToMermaid } from '../../util/mermaid/dfg';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { resolveDataflowGraph } from '../../dataflow/graph/resolve-graph';
import type { DataflowDifferenceReport } from '../../dataflow/graph/diff';
import { diffOfDataflowGraphs } from '../../dataflow/graph/diff';
import { guard } from '../../util/assert';
import { printAsMs } from './doc-ms';

function printDfGraph(graph: DataflowGraph, mark?: ReadonlySet<MermaidMarkdownMark>) {
	return `
\`\`\`mermaid
${graphToMermaid({
		graph,
		prefix: 'flowchart LR',
		mark
	}).string}
\`\`\`
	`;
}

export interface PrintDataflowGraphOptions {
	readonly mark?:     ReadonlySet<MermaidMarkdownMark>;
	readonly showCode?: boolean;
}
export async function printDfGraphForCode(shell: RShell, code: string, { mark, showCode }: PrintDataflowGraphOptions = {}) {
	const now = performance.now();
	const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parsing and normalization) within the generation environment.`;

	return '\n\n' + '-'.repeat(42) + '\n' + printDfGraph(result.dataflow.graph, mark) + (showCode ? `
<details>

<summary>R Code of the Dataflow Graph</summary>

${metaInfo}
${mark ? `The following marks are used in the graph to highlight sub-parts (uses ids): ${[...mark].join(', ')}.` : ''}

\`\`\`r
${code}
\`\`\`

<details>

<summary>Mermaid Code (without markings)</summary>

\`\`\`
${graphToMermaid({
			graph:  result.dataflow.graph,
			prefix: 'flowchart LR'
		}).string}
\`\`\`

</details>

</details>

	` : '\n(' + metaInfo + ')\n\n') +
		'-'.repeat(42)
	;
}


/** returns resolved expected df graph */
export async function verifyExpectedSubgraph(shell: RShell, code: string, expectedSubgraph: DataflowGraph): Promise<DataflowGraph> {
	/* we verify that we get what we want first! */
	const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(code),
		getId:   deterministicCountingIdGenerator(0)
	}).allRemainingSteps();

	expectedSubgraph.setIdMap(info.normalize.idMap);
	expectedSubgraph = resolveDataflowGraph(expectedSubgraph);
	const report: DataflowDifferenceReport = diffOfDataflowGraphs(
		{ name: 'expected', graph: expectedSubgraph },
		{ name: 'got',      graph: info.dataflow.graph },
		{
			leftIsSubgraph: true
		}
	);

	guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`);
	return expectedSubgraph;
}
