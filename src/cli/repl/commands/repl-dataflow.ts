import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import { handleString } from '../core';
import { VertexType } from '../../../dataflow/graph/vertex';
import { dfgToAscii } from '../../../util/simple-df/dfg-ascii';
import { Dataflow } from '../../../dataflow/graph/df-helper';
import { isSigDbEnabled } from '../../../config';
import type { IdentifierReference } from '../../../dataflow/environments/identifier';
import { Identifier, ReferenceType } from '../../../dataflow/environments/identifier';
import type { KillReference } from '../../../dataflow/info';
import type { AstIdMap } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { SourceLocation } from '../../../util/range';

function formatInfo(out: ReplOutput, type: string, meta: PipelinePerStepMetaInformation ): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${meta['.meta'].timing + 'ms'}).`,
		{ color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

function formatReference(output: ReplOutput, ref: IdentifierReference, idMap: AstIdMap): string {
	const id = output.formatter.format(`$${ref.nodeId}`, { color: Colors.Cyan, effect: ColorEffect.Foreground });
	const name = ref.name === undefined ? '<anonymous>' : Identifier.toString(ref.name);
	const node = idMap.get(ref.nodeId);
	const sl = SourceLocation.fromNode(node);
	const loc = sl ? ` [${SourceLocation.format(sl)}]` : '';
	const detail = node ? ` "${node.lexeme ?? name}"${loc}` : '';
	return `${id} ${name} (${ReferenceType[ref.type]})${detail}`;
}

/** Formats a single {@link KillReference}, which unlike a plain reference may kill the whole (or an unknown part of the) scope */
function formatKill(output: ReplOutput, kill: KillReference, idMap: AstIdMap): string {
	switch(kill.kind) {
		case 'named':   return formatReference(output, kill.reference, idMap);
		case 'all':     return 'kills entire scope';
		case 'unknown': return 'kills unknown, not statically resolvable references';
	}
}

/**
 * Prints the reference sets, listing each non-empty one and collapsing all empty ones into a single trailing
 * line, as a screen full of `(0):` headers says nothing.
 */
function printReferenceSections(output: ReplOutput, sections: readonly { title: string, lines: readonly string[] }[]): void {
	const count = (n: number) => output.formatter.format(String(n), { color: Colors.Cyan, effect: ColorEffect.Foreground });
	for(const { title, lines } of sections.filter(s => s.lines.length > 0)) {
		output.stdout(`${title} (${count(lines.length)}):`);
		for(const line of lines) {
			output.stdout(' - ' + line);
		}
	}
	const empty = sections.filter(s => s.lines.length === 0);
	if(empty.length > 0) {
		output.stdout(output.formatter.format('Empty: ', { style: FontStyles.Italic }) + `${empty.map(s => `${s.title} (${count(0)})`).join(', ')}`);
	}
}

export const dataflowCommand: ReplCodeCommand = {
	description:   'Get mermaid code for the dataflow graph',
	isCodeCommand: true,
	usageExample:  ':dataflow',
	aliases:       [ 'd', 'df' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = Dataflow.visualize.mermaid.convert({ graph: result.graph, includeEnvironments: false, qualifyBaseR: isSigDbEnabled(analyzer.flowrConfig) }).string;
		output.stdout(mermaid);
		if(output.allowClipboard !== false) {
			try {
				const clipboard = await import('clipboardy');
				clipboard.default.writeSync(mermaid);
				output.stdout(formatInfo(output, 'mermaid code', result));
			} catch{ /* do nothing this is a service thing */
			}
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
		const mermaid = Dataflow.visualize.mermaid.url(result.graph, false, undefined, false, isSigDbEnabled(analyzer.flowrConfig));
		output.stdout(mermaid);
		if(output.allowClipboard !== false) {
			try {
				const clipboard = await import('clipboardy');
				clipboard.default.writeSync(mermaid);
				output.stdout(formatInfo(output, 'mermaid url', result));
			} catch{ /* do nothing this is a service thing */ }
		}
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
				` - ${(longVertexName + ':').padEnd(longestVertexType + 1)} ` + output.formatter.format(`${String(vertsOfType.length).padStart(8)}`, { color: Colors.Cyan, effect: ColorEffect.Foreground }).padStart(9, ' ')
			);
		}

		const { idMap } = await analyzer.normalize();
		printReferenceSections(output, [
			{ title: 'In', lines: result.in.map(r => formatReference(output, r, idMap)) },
			{ title: 'Out', lines: result.out.map(r => formatReference(output, r, idMap)) },
			{ title: 'Unknown References', lines: result.unknownReferences.map(r => formatReference(output, r, idMap)) },
			{ title: 'Kill', lines: (result.kill ?? []).map(k => formatKill(output, k, idMap)) }
		]);
	}
};


export const dataflowSimplifiedCommand: ReplCodeCommand = {
	description:   'Get mermaid code for the simplified dataflow graph',
	isCodeCommand: true,
	usageExample:  ':dataflowsimple',
	aliases:       [ 'ds', 'dfs' ],
	script:        false,
	argsParser:    (args: string) => handleString(args),
	fn:            async({ output, analyzer }) => {
		const result = await analyzer.dataflow();
		const mermaid = Dataflow.visualize.mermaid.convert({ graph: result.graph, includeEnvironments: false, simplified: true, qualifyBaseR: isSigDbEnabled(analyzer.flowrConfig) }).string;
		output.stdout(mermaid);
		if(output.allowClipboard !== false) {
			try {
				const clipboard = await import('clipboardy');
				clipboard.default.writeSync(mermaid);
				output.stdout(formatInfo(output, 'mermaid code', result));
			} catch{ /* do nothing this is a service thing */ }
		}
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
		const mermaid = Dataflow.visualize.mermaid.url(result.graph, false, undefined, true, isSigDbEnabled(analyzer.flowrConfig));
		output.stdout(mermaid);
		if(output.allowClipboard !== false) {
			try {
				const clipboard = await import('clipboardy');
				clipboard.default.writeSync(mermaid);
				output.stdout(formatInfo(output, 'mermaid url', result));
			} catch{ /* do nothing this is a service thing */ }
		}
	}
};
