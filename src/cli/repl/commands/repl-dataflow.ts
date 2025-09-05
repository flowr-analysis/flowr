import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import { handleString } from '../core';

function formatInfo(out: ReplOutput, type: string, meta: PipelinePerStepMetaInformation ): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${meta['.meta'].cached ? 'cached' : meta['.meta'].timing + 'ms'}).`,
		{ color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const dataflowCommand: ReplCodeCommand = {
	description:  `Get mermaid code for the dataflow graph, start with '${fileProtocol}' to indicate a file`,
	usesAnalyzer: true,
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	argsParser:   (args: string) => handleString(args),
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaid({ graph: result.graph, includeEnvironments: false }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const dataflowStarCommand: ReplCodeCommand = {
	description:  'Returns the URL to mermaid.live',
	usesAnalyzer: true,
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	argsParser:   (args: string) => handleString(args),
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaidUrl(result.graph, false);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};


export const dataflowSimplifiedCommand: ReplCodeCommand = {
	description:  `Get mermaid code for the simplified dataflow graph, start with '${fileProtocol}' to indicate a file`,
	usesAnalyzer: true,
	usageExample: ':dataflowsimple',
	aliases:      [ 'ds', 'dfs' ],
	script:       false,
	argsParser:   (args: string) => handleString(args),
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaid({ graph: result.graph, includeEnvironments: false, simplified: true }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const dataflowSimpleStarCommand: ReplCodeCommand = {
	description:  'Returns the URL to mermaid.live',
	usesAnalyzer: true,
	usageExample: ':dataflowsimple*',
	aliases:      [ 'ds*', 'dfs*' ],
	script:       false,
	argsParser:   (args: string) => handleString(args),
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaidUrl(result.graph, false, undefined, true);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', result));
		} catch{ /* do nothing this is a service thing */ }
	}
};
