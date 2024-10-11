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
import { jsonReplacer } from '../../util/json';
import type { PipelineOutput } from '../../core/steps/pipeline/pipeline';
import { printAsMs } from '../../util/time';

export function printDfGraph(graph: DataflowGraph, mark?: ReadonlySet<MermaidMarkdownMark>) {
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
	readonly mark?:               ReadonlySet<MermaidMarkdownMark>;
	readonly showCode?:           boolean;
	readonly codeOpen?:           boolean;
	readonly exposeResult?:       boolean;
	readonly switchCodeAndGraph?: boolean;
}

export async function printDfGraphForCode(shell: RShell, code: string, options: PrintDataflowGraphOptions & { exposeResult: true }): Promise<[string, PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]>;
export async function printDfGraphForCode(shell: RShell, code: string, options?: PrintDataflowGraphOptions & { exposeResult?: false | undefined }): Promise<string>;
export async function printDfGraphForCode(shell: RShell, code: string, { mark, showCode = true, codeOpen = false, exposeResult, switchCodeAndGraph = false }: PrintDataflowGraphOptions = {}): Promise<string | [string, PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]> {
	const now = performance.now();
	const result = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	const duration = performance.now() - now;

	if(switchCodeAndGraph) {
		guard(showCode, 'can not switch code and graph if code is not shown');
	}

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parsing and normalization) within the generation environment.`;
	const dfGraph = printDfGraph(result.dataflow.graph, mark);
	let resultText = '\n\n';

	if(showCode) {
		const codeText = `\`\`\`r
${code}
\`\`\``;
		resultText += switchCodeAndGraph ? codeText : dfGraph;
		resultText += `
<details${codeOpen ? ' open' : ''}>

<summary style="color:gray">${switchCodeAndGraph ? 'Dataflow Graph of the R Code' : 'R Code of the Dataflow Graph'}</summary>

${metaInfo} ${mark ? `The following marks are used in the graph to highlight sub-parts (uses ids): {${[...mark].join(', ')}}.` : ''}
We encountered ${result.dataflow.graph.unknownSideEffects.size > 0 ? 'unknown side effects (with ids: ' + JSON.stringify(result.dataflow.graph.unknownSideEffects, jsonReplacer) + ')' : 'no unknown side effects'} during the analysis.

${switchCodeAndGraph ? dfGraph : codeText}

<details>

<summary style="color:gray">Mermaid Code ${(mark?.size ?? 0) > 0 ? '(without markings)' : ''}</summary>

\`\`\`
${graphToMermaid({
		graph:  result.dataflow.graph,
		prefix: 'flowchart LR'
	}).string}
\`\`\`

</details>

</details>

`;
	} else {
		resultText += dfGraph + '\n(' + metaInfo + ')\n\n';
	}
	return exposeResult ? [resultText, result] : resultText;
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
