import type { ReplCommand, ReplOutput } from './repl-main';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import { fileProtocol, requestFromInput } from '../../../r-bridge/retriever';
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid/dfg';
import type { KnownParser } from '../../../r-bridge/parser';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';

/**
 * Obtain the dataflow graph using a known parser (such as the {@link RShell} or {@link TreeSitterExecutor}).
 */
async function replGetDataflow(parser: KnownParser, code: string) {
	return await createDataflowPipeline(parser, {
		request: requestFromInput(code.trim())
	}).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

function formatInfo(out: ReplOutput, type: string, timing: number): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${timing}ms).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const dataflowCommand: ReplCommand = {
	description:  `Get mermaid code for the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await replGetDataflow(shell, handleString(remainingLine));
		const mermaid = graphToMermaid({ graph: result.dataflow.graph, includeEnvironments: false }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', result.dataflow['.meta'].timing));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const dataflowStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await replGetDataflow(shell, handleString(remainingLine));
		const mermaid = graphToMermaidUrl(result.dataflow.graph, false);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result.dataflow['.meta'].timing));
		} catch{ /* do nothing this is a service thing */ }
	}
};


export const dataflowSimplifiedCommand: ReplCommand = {
	description:  `Get simplified mermaid code for the dataflow graph of R code, start with '${fileProtocol}' to indicate a file`,
	usageExample: ':dataflowsimple',
	aliases:      [ 'ds', 'dfs' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await replGetDataflow(shell, handleString(remainingLine));
		const mermaid = graphToMermaid({ graph: result.dataflow.graph, includeEnvironments: false, simplified: true }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', result.dataflow['.meta'].timing));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const dataflowSimpleStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':dataflowsimple*',
	aliases:      [ 'ds*', 'dfs*' ],
	script:       false,
	fn:           async(output, shell, remainingLine) => {
		const result = await replGetDataflow(shell, handleString(remainingLine));
		const mermaid = graphToMermaidUrl(result.dataflow.graph, false, undefined, true);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result.dataflow['.meta'].timing));
		} catch{ /* do nothing this is a service thing */ }
	}
};
