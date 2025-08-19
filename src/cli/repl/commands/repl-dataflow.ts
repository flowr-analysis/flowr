import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';

function formatInfo(out: ReplOutput, type: string, timing: number): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${timing}ms).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const dataflowCommand: ReplCodeCommand = {
	description:  `Get mermaid code for the dataflow graph, start with '${fileProtocol}' to indicate a file`,
	usesAnalyzer: true,
	usageExample: ':dataflow',
	aliases:      [ 'd', 'df' ],
	script:       false,
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaid({ graph: result.graph, includeEnvironments: false }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', 0)); // TODO
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const dataflowStarCommand: ReplCodeCommand = {
	description:  'Returns the URL to mermaid.live',
	usesAnalyzer: true,
	usageExample: ':dataflow*',
	aliases:      [ 'd*', 'df*' ],
	script:       false,
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaidUrl(result.graph, false);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', 0)); // TODO
		} catch{ /* do nothing this is a service thing */ }
	}
};


export const dataflowSimplifiedCommand: ReplCodeCommand = {
	description:  `Get mermaid code for the simplified dataflow graph, start with '${fileProtocol}' to indicate a file`,
	usesAnalyzer: true,
	usageExample: ':dataflowsimple',
	aliases:      [ 'ds', 'dfs' ],
	script:       false,
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaid({ graph: result.graph, includeEnvironments: false, simplified: true }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', 0)); // TODO
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const dataflowSimpleStarCommand: ReplCodeCommand = {
	description:  'Returns the URL to mermaid.live',
	usesAnalyzer: true,
	usageExample: ':dataflowsimple*',
	aliases:      [ 'ds*', 'dfs*' ],
	script:       false,
	fn:           async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaidUrl(result.graph, false, undefined, true);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', 0)); // TODO
		} catch{ /* do nothing this is a service thing */ }
	}
};
