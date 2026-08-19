import type { ReplCodeCommand, ReplOutput } from './repl-main';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { PipelinePerStepMetaInformation } from '../../../core/steps/pipeline/pipeline';
import { handleString } from '../core';
import { ReplClipboard } from './repl-clipboard';
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

interface ReferenceRow {
	readonly id:     string;
	readonly name:   string;
	readonly type:   string;
	readonly detail: string;
}

type ReferenceLine = ReferenceRow | string;

interface ReferenceSection {
	readonly title: string;
	readonly lines: readonly ReferenceLine[];
}

function referenceRow(ref: IdentifierReference, idMap: AstIdMap): ReferenceRow {
	const name = ref.name === undefined ? '<anonymous>' : Identifier.toString(ref.name);
	const node = idMap.get(ref.nodeId);
	const sl = SourceLocation.fromNode(node);
	const loc = sl ? ` [${SourceLocation.format(sl)}]` : '';
	return {
		id:     `$${ref.nodeId}`,
		name,
		type:   ReferenceType[ref.type],
		detail: node ? `"${node.lexeme ?? name}"${loc}` : ''
	};
}

function killRow(kill: KillReference, idMap: AstIdMap): ReferenceLine {
	switch(kill.kind) {
		case 'named':   return referenceRow(kill.reference, idMap);
		case 'all':     return 'kills entire scope';
		case 'unknown': return 'kills unknown, not statically resolvable references';
	}
}

function printCounts(output: ReplOutput, rows: readonly { label: string, value: number, indent?: boolean }[]): void {
	const labels = rows.map(r => `${r.indent ? ' - ' : ''}${r.label}:`);
	const labelWidth = Math.max(...labels.map(l => l.length));
	const valueWidth = Math.max(...rows.map(r => String(r.value).length));
	rows.forEach((r, i) => {
		const value = output.formatter.format(String(r.value).padStart(valueWidth), { color: Colors.Cyan, effect: ColorEffect.Foreground });
		output.stdout(`${labels[i].padEnd(labelWidth)} ${value}`);
	});
}

const MaxDetailedReferences = 4;
const MaxCompactReferences = 12;
const MaxIdsPerName = 3;

/** Lists each non-empty reference set and collapses all empty ones into a single trailing line */
function printReferenceSections(output: ReplOutput, sections: readonly ReferenceSection[]): void {
	const count = (n: number) => output.formatter.format(String(n), { color: Colors.Cyan, effect: ColorEffect.Foreground });
	const rows = sections.flatMap(s => s.lines.slice(0, MaxDetailedReferences)).filter(l => typeof l !== 'string');
	const width = (get: (row: ReferenceRow) => string) => Math.max(0, ...rows.map(r => get(r).length));
	const idWidth = width(r => r.id);
	const nameWidth = width(r => r.name);
	const typeWidth = width(r => r.type);
	const line = (l: ReferenceLine) => {
		if(typeof l === 'string') {
			return l;
		}
		const id = output.formatter.format(l.id.padStart(idWidth), { color: Colors.Cyan, effect: ColorEffect.Foreground });
		const type = output.formatter.format(l.type.padEnd(typeWidth), { color: Colors.Magenta, effect: ColorEffect.Foreground });
		return `${id}  ${l.name.padEnd(nameWidth)}  ${type}  ${l.detail}`.trimEnd();
	};
	const compact = (lines: readonly ReferenceLine[]) => {
		const byName = new Map<string, string[]>();
		for(const l of lines) {
			const name = typeof l === 'string' ? l : l.name;
			const ids = byName.get(name) ?? [];
			if(typeof l !== 'string') {
				ids.push(l.id);
			}
			byName.set(name, ids);
		}
		return Array.from(byName, ([name, ids]) => ids.length === 0 ? name :
			`${name} (${ids.slice(0, MaxIdsPerName).join(', ')}${ids.length > MaxIdsPerName ? ', ...' : ''})`);
	};
	for(const { title, lines } of sections.filter(s => s.lines.length > 0)) {
		output.stdout(`${title} (${count(lines.length)}):`);
		for(const l of lines.slice(0, MaxDetailedReferences)) {
			output.stdout(' - ' + line(l));
		}
		const rest = lines.slice(MaxDetailedReferences);
		if(rest.length > 0) {
			const shown = rest.slice(0, MaxCompactReferences);
			const hidden = rest.length - shown.length;
			output.stdout(' - ' + output.formatter.format(compact(shown).join(', ') + (hidden > 0 ? `, ... ${hidden} more` : ''),
				{ color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic }));
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
		await ReplClipboard.print(output, mermaid, formatInfo(output, 'mermaid code', result));
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
		await ReplClipboard.print(output, mermaid, formatInfo(output, 'mermaid url', result));
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
				{ color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic })
		);
		printCounts(output, [
			{ label: 'Edges', value: numOfEdges },
			{ label: 'Vertices', value: numOfVertices },
			...Object.entries(VertexType).map(([name, vertType]) => ({
				label:  name,
				value:  Array.from(result.graph.verticesOfType(vertType)).length,
				indent: true
			}))
		]);

		const { idMap } = await analyzer.normalize();
		printReferenceSections(output, [
			{ title: 'In', lines: result.in.map(r => referenceRow(r, idMap)) },
			{ title: 'Out', lines: result.out.map(r => referenceRow(r, idMap)) },
			{ title: 'Unknown References', lines: result.unknownReferences.map(r => referenceRow(r, idMap)) },
			{ title: 'Kill', lines: (result.kill ?? []).map(k => killRow(k, idMap)) }
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
		await ReplClipboard.print(output, mermaid, formatInfo(output, 'mermaid code', result));
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
		await ReplClipboard.print(output, mermaid, formatInfo(output, 'mermaid url', result));
	}
};
