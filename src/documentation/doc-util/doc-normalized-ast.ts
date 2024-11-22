import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RShell } from '../../r-bridge/shell';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE, DEFAULT_NORMALIZE_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import type { RNodeWithParent } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { deterministicCountingIdGenerator } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { resolveDataflowGraph } from '../../dataflow/graph/resolve-graph';
import type { DataflowDifferenceReport } from '../../dataflow/graph/diff';
import { diffOfDataflowGraphs } from '../../dataflow/graph/diff';
import { guard } from '../../util/assert';
import { normalizedAstToMermaid } from '../../util/mermaid/ast';
import { printAsMs } from '../../util/time';

export function printNormalizedAst(ast: RNodeWithParent, prefix = 'flowchart TD\n') {
	return `
\`\`\`mermaid
${normalizedAstToMermaid(ast, prefix)}
\`\`\`
	`;
}

export interface PrintNormalizedAstOptions {
	readonly showCode?: boolean;
	readonly prefix?:   string;
}
export async function printNormalizedAstForCode(shell: RShell, code: string, { showCode = true, prefix = 'flowchart TD\n' }: PrintNormalizedAstOptions = {}) {
	const now = performance.now();
	const result = await new PipelineExecutor(DEFAULT_NORMALIZE_PIPELINE, {
		shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parsing with the R&nbsp;shell) within the generation environment.`;

	return '\n\n' +  printNormalizedAst(result.normalize.ast, prefix) + (showCode ? `
<details>

<summary style="color:gray">R Code of the Normalized AST</summary>

${metaInfo}

\`\`\`r
${code}
\`\`\`

<details>

<summary style="color:gray">Mermaid Code</summary>

\`\`\`
${normalizedAstToMermaid(result.normalize.ast, prefix)}
\`\`\`

</details>

</details>

` : '\n(' + metaInfo + ')\n\n')
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
