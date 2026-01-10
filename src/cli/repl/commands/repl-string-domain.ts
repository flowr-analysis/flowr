import type { Domain, Lift, Value } from '../../../abstract-interpretation/eval/domain';
import { Top, valueToString } from '../../../abstract-interpretation/eval/domain';
import type { Graph, NodeId } from '../../../abstract-interpretation/eval/graph';
import { createDomain, inferStringDomains } from '../../../abstract-interpretation/eval/inference';
import type { StringDomainInfo } from '../../../abstract-interpretation/eval/inference';
import { StringDomainVisitor } from '../../../abstract-interpretation/eval/visitor';
import type { FlowrConfigOptions } from '../../../config';
import { extractCfg } from '../../../control-flow/extract-cfg';
import { createDataflowPipeline } from '../../../core/steps/pipeline/default-pipelines';
import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { KnownParser } from '../../../r-bridge/parser';
import { requestFromInput } from '../../../r-bridge/retriever';
import { graphToMermaidUrl } from '../../../util/mermaid/dfg';
import { mermaidCodeToUrl } from '../../../util/mermaid/mermaid';
import { throwError } from '../../../util/null-or-throw';
import { ColorEffect, Colors, FontStyles } from '../../../util/text/ansi';
import type { ReplCommand, ReplOutput } from './repl-main';

/**
 * Obtain the dataflow graph using a known parser (such as the {@link RShell} or {@link TreeSitterExecutor}).
 */
async function replGetDataflow(config: FlowrConfigOptions, parser: KnownParser, code: string) {
	return await createDataflowPipeline(parser, {
		request: requestFromInput(code.trim())
	}, config).allRemainingSteps();
}

function handleString(code: string): string {
	return code.startsWith('"') ? JSON.parse(code) as string : code;
}

function formatInfo(out: ReplOutput, type: string, timing: number): string {
	return out.formatter.format(`Copied ${type} to clipboard (dataflow: ${timing}ms).`, { color: Colors.White, effect: ColorEffect.Foreground, style: FontStyles.Italic });
}

export const stringValuesGraphStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':svg* <code>',
	aliases:      [ 'svg*' ],
	script:       false,
	fn:           async({ output, parser, remainingLine, config }) => {
		const totalStart = Date.now();
		const result = await replGetDataflow(config, parser, handleString(remainingLine));
		const dfg = result.dataflow.graph;
		const normalizedAst: NormalizedAst<ParentInformation & StringDomainInfo> = result.normalize;
		const controlFlow = extractCfg(normalizedAst, config, dfg);
		const values = inferStringDomains(
			controlFlow,
			dfg,
			normalizedAst,
			config,
		);
		const totalEnd = Date.now();
		const totalDuration = totalEnd - totalStart;
		const mermaid = graphToMermaidUrl(dfg, false, undefined, false, ['sdvalue']);
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', totalDuration));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export const stringGraphStarCommand: ReplCommand = {
	description:  'Returns the URL to mermaid.live',
	usageExample: ':sg* <code>',
	aliases:      [ 'sg*' ],
	script:       false,
	fn:           async({ output, parser, remainingLine, config }) => {
		const totalStart = Date.now();
		const result = await replGetDataflow(config, parser, handleString(remainingLine));
		const dfg = result.dataflow.graph;
		const normalizedAst: NormalizedAst<ParentInformation & StringDomainInfo> = result.normalize;

		const controlFlow = extractCfg(normalizedAst, config, dfg);

		const visitor = new StringDomainVisitor({ controlFlow, dfg, normalizedAst, flowrConfig: config });
		visitor.start();
		const graph = visitor.graph;
		const domain = createDomain(config);
		const values = visitor.graph.inferValues(domain as Domain<Value>);

		const mermaid = mermaidCodeToUrl(stringGraphToMermaidCode(normalizedAst, values, graph));
		const totalEnd = Date.now();
		const totalDuration = totalEnd - totalStart;
		output.stdout(mermaid);
		try {
			const clipboard = await import('clipboardy');
			clipboard.default.writeSync(mermaid);
			output.stdout(formatInfo(output, 'mermaid url', totalDuration));
		} catch{ /* do nothing this is a service thing */ }
	}
};

export function stringGraphToMermaidUrl(ast: NormalizedAst<ParentInformation & StringDomainInfo>, values: ReadonlyMap<NodeId, Lift<Value>>, graph: Graph) {
	return mermaidCodeToUrl(stringGraphToMermaidCode(ast, values, graph));
}

function stringGraphToMermaidCode(ast: NormalizedAst<ParentInformation & StringDomainInfo>, values: ReadonlyMap<NodeId, Lift<Value>>, graph: Graph) {
	const lines = ['flowchart BT'];
	const nodes = graph.nodes();

	for(const [id, node] of nodes) {
		const astNode = ast.idMap.get(id);
		let content: string;
		if(astNode) {
			content = `
**${node.type.toUpperCase()}**
type: ${astNode.type} (${id})
src: (${astNode.location?.[0] ?? '?'}:${astNode.location?.[1] ?? '?'}) ${escape(astNode.lexeme)}
value: ${escape(valueToString(values.get(id) ?? Top))}
			`;
		} else {
			content = `
**${node.type.toUpperCase()}**
value: ${escape(valueToString(values.get(id) ?? Top))}
			`;
		}

		lines.push(
			`  ${id}["\``,
			...content.split('\n').map(it => `  ${it.replaceAll('"', "'")}`),
			'  `"]',
		);
	}

	for(const [id] of nodes) {
		for(const depId of graph.depsOf(id)) {
			if(!nodes.has(depId)) {
				const astNode = ast.idMap.get(depId) ?? throwError('unreachable');
				const content = `
**MISSING NODE**
type: ${astNode.type} (${depId})
src: (${astNode.location?.[0] ?? '?'}:${astNode.location?.[1] ?? '?'}) ${escape(astNode.lexeme)}
value: ${escape(valueToString(astNode.info.sdvalue ?? Top))}
		`;

				lines.push(
					`  ${depId}["\``,
					...content.split('\n').map(it => `  ${it.replaceAll('"', "'")}`),
					'  `"]',
				);
			}
			lines.push(`  ${id} --> ${depId}`);
		}
	}

	return lines.join('\n');
}

function escape(str: string | undefined): string | undefined {
	return str?.replaceAll('"', "'").replaceAll('_', '\\_').replaceAll('*', '\\*');
}
