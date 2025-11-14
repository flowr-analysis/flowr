import type { DataflowGraph } from '../../dataflow/graph/graph';
import type { RShell } from '../../r-bridge/shell';
import { createDataflowPipeline, createNormalizePipeline } from '../../core/steps/pipeline/default-pipelines';
import { type RNodeWithParent , deterministicCountingIdGenerator } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { resolveDataflowGraph } from '../../dataflow/graph/resolve-graph';
import { diffOfDataflowGraphs } from '../../dataflow/graph/diff-dataflow-graph';
import { guard } from '../../util/assert';
import { normalizedAstToMermaid } from '../../util/mermaid/ast';
import { printAsMs } from '../../util/text/time';
import type { KnownParser } from '../../r-bridge/parser';
import { FlowrWikiBaseRef } from './doc-files';
import type { GraphDifferenceReport } from '../../util/diff-graph';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';


/**
 *
 */
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

/**
 * Generates and prints the normalized AST for the given code, along with optional metadata and the original code.
 * This is intended for documentation purposes.
 */
export async function printNormalizedAstForCode(parser: KnownParser, code: string, { showCode = true, prefix = 'flowchart TD\n' }: PrintNormalizedAstOptions = {}) {
	const now = performance.now();
	const result = await createNormalizePipeline(parser, {
		context: contextFromInput(code)
	}).allRemainingSteps();
	const duration = performance.now() - now;

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parsing with the [${parser.name}](${FlowrWikiBaseRef}/Engines) engine) within the generation environment.`;

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
	const info = await createDataflowPipeline(shell, {
		context: contextFromInput(code),
		getId:   deterministicCountingIdGenerator(0)
	}).allRemainingSteps();

	expectedSubgraph.setIdMap(info.normalize.idMap);
	expectedSubgraph = resolveDataflowGraph(expectedSubgraph);
	const report: GraphDifferenceReport = diffOfDataflowGraphs(
		{ name: 'expected', graph: expectedSubgraph },
		{ name: 'got',      graph: info.dataflow.graph },
		{
			leftIsSubgraph: true
		}
	);

	guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`);
	return expectedSubgraph;
}
