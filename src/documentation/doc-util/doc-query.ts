import type { RShell } from '../../r-bridge/shell';
import type { Queries, SupportedQueryTypes } from '../../queries/query';
import { executeQueries } from '../../queries/query';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
import { printAsMs } from './doc-ms';
import { jsonReplacer } from '../../util/json';
import { markdownFormatter } from '../../util/ansi';
import { asciiSummaryOfQueryResult } from '../../cli/repl/commands/repl-query';
import { FlowrWikiBaseRef } from './doc-files';

export interface ShowQueryOptions {
	readonly showCode?: boolean;
}

export async function showQuery(shell: RShell, code: string, queries: Queries<SupportedQueryTypes>, { showCode }: ShowQueryOptions = {}): Promise<string> {
	const now = performance.now();
	const analysis = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(code)
	}).allRemainingSteps();
	const results = executeQueries({ graph: analysis.dataflow.graph, ast: analysis.normalize }, queries);
	const duration = performance.now() - now;

	const metaInfo = `
The analysis required _${printAsMs(duration)}_ (including parsing and normalization and the query) within the generation environment.
	`.trim();

	const resultAsString = JSON.stringify(results, jsonReplacer, 2);

	return `

\`\`\`json
${JSON.stringify(queries, jsonReplacer, 2)}
\`\`\`

Results (prettified and summarized):

${
	asciiSummaryOfQueryResult(markdownFormatter, duration, results, analysis)
}


<details> <summary>Show Detailed Results as Json</summary>

${metaInfo}	

In general, the JSON contains the Ids of the nodes in question as they are present in the normalized AST or the dataflow graph of flowR.
Please consult the [Interface](${FlowrWikiBaseRef}/Interface) wiki page for more information on how to get those.

\`\`\`json
${resultAsString}
\`\`\`

${
	showCode ? `
<details> <summary>Original Code</summary>

\`\`\`r
${code}
\`\`\`

</details>
	` : ''
}

</details>

	`;

}
