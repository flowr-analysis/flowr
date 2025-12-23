import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { fileProtocol } from '../../../r-bridge/retriever';
import { graphToMermaid, graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import { handleString } from '../core';
import { VertexType } from '../../../dataflow/graph/vertex';
import { dfgToAscii } from '../../../util/simple-df/dfg-ascii';

function formatInfo(out: ReplOutput, type: string, meta: PipelinePerStepMetaInformation ): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${meta['.meta'].timing + 'ms'}).`,
		{ color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const dataflowCommand: ReplCodeCommand = {
	description:   `Get mermaid code for the dataflow graph, start with '${fileProtocol}' to indicate a file`,
	isCodeCommand: true,
	usageExample:  ':dataflow',
	aliases:       [ 'd', 'df' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = graphToMermaid({ graph: result.graph, includeEnvironments: false }).string;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid code', result));
		} catch{ /* do nothing this is a service thing */
		}
	}
};

export const dataflowStarCommand: ReplCodeCommand = {
	description:   'Returns the URL to mermaid.live',
	isCodeCommand: true,
	usageExample:  ':dataflow*',
	aliases:       [ 'd*', 'df*' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
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

export const dataflowAsciiCommand: ReplCodeCommand = {
	description:   'Returns an ASCII representation of the dataflow graph',
	isCodeCommand: true,
	usageExample:  ':dataflowascii',
	aliases:       [ 'df!' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		output.stdout(dfgToAscii(result.graph));
	}
};

export const dataflowSilentCommand: ReplCodeCommand = {
	description:   'Just calculates the DFG, but only prints summary info',
	isCodeCommand: true,
	usageExample:  ':dataflowsilent',
	aliases:       [ 'd#', 'df#' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const numOfEdges = Array.from(result.graph.edges().flatMap(e => e[1].entries())).length;
		const numOfVertices = Array.from(result.graph.vertices(true)).length;
		output.stdout(
			output.formatter.format(`Dataflow calculated in ${result['.meta'].timing}ms.`,
				{ color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic }) + '\n' +
            'Edges:    ' + output.formatter.format(`${String(numOfEdges).padStart(12)}`, { color: Colors.Cyan, effect: ColorEffect.Foreground }) + '\n' +
            // number of vertices and edges
            'Vertices: ' + output.formatter.format(`${String(numOfVertices).padStart(12)}`, { color: Colors.Cyan, effect: ColorEffect.Foreground })
		);
		const longestVertexType = Math.max(...Object.keys(VertexType).map(vt => vt.length));
		for(const vertType of Object.values(VertexType)) {
			const vertsOfType = Array.from(result.graph.verticesOfType(vertType));
			const longVertexName = Object.entries(VertexType).find(([, v]) => v === vertType)?.[0] ?? vertType;
			output.stdout(
				` - ${(longVertexName + ':').padEnd(longestVertexType+1)} ` + output.formatter.format(`${String(vertsOfType.length).padStart(8)}`, { color: Colors.Cyan, effect: ColorEffect.Foreground }).padStart(9, ' ')
			);
		}
	}
};


export const dataflowSimplifiedCommand: ReplCodeCommand = {
	description:   `Get mermaid code for the simplified dataflow graph, start with '${fileProtocol}' to indicate a file`,
	isCodeCommand: true,
	usageExample:  ':dataflowsimple',
	aliases:       [ 'ds', 'dfs' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
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
	description:   'Returns the URL to mermaid.live',
	isCodeCommand: true,
	usageExample:  ':dataflowsimple*',
	aliases:       [ 'ds*', 'dfs*' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
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
