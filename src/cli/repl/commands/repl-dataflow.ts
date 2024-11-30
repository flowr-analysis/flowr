import type { ReplCommand } from './repl-main';
import { PipelineExecutor } from '../../../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../core/steps/pipeline/default-pipelines';
import type { RShell } from '../../../r-bridge/shell';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid/dfg';

async function dataflow(shell: RShell, remainingLine: string) {
	return await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		shell,
		request: requestFromInput(remainingLine.trim())
	}).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

export const dataflowCommand: ReplCommand = {
	description:  `Get mermaid code for the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await dataflow(shell, handleString(remainingLine));
		output.stdout(graphToMermaid({ graph: result.dataflow.graph, includeEnvironments: false }).string);
	}
};

export const dataflowStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await dataflow(shell, handleString(remainingLine));
		output.stdout(graphToMermaidUrl(result.dataflow.graph, false));
	}
};
