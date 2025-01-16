import type { ReplCommand } from './repl-main';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid/dfg';
import type { KnownParser } from '../../../r-bridge/parser';

async function dataflow(parser: KnownParser, remainingLine: string) {
	return await createDataflowPipeline(parser, {
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
