import type { DataflowGraph, UnknownSideEffect } from '../../dataflow/graph/graph';
import { graphToMermaid } from '../../util/mermaid/dfg';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { createDataflowPipeline } from '../../core/steps/pipeline/default-pipelines';
import { deterministicCountingIdGenerator } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { resolveDataflowGraph } from '../../dataflow/graph/resolve-graph';
import { diffOfDataflowGraphs } from '../../dataflow/graph/diff-dataflow-graph';
import { guard } from '../../util/assert';
import type { PipelineOutput } from '../../core/steps/pipeline/pipeline';
import { printAsMs } from '../../util/text/time';
import type { KnownParser } from '../../r-bridge/parser';
import { FlowrWikiBaseRef } from './doc-files';
import { codeBlock } from './doc-code';
import type { GraphDifferenceReport } from '../../util/diff-graph';
import { contextFromInput } from '../../project/context/flowr-analyzer-context';
import type { MermaidMarkdownMark } from '../../util/mermaid/info';
import { computeCallGraph } from '../../dataflow/graph/call-graph';


/**
 * Visualizes the dataflow graph as a mermaid graph inside a markdown code block.
 * Please use this only for documentation purposes, for programmatic usage use {@link graphToMermaid} directly.
 */
export function printDfGraph(graph: DataflowGraph, mark?: ReadonlySet<MermaidMarkdownMark>, simplified = false) {
	return `
${codeBlock('mermaid', graphToMermaid({
	graph,
	prefix: 'flowchart LR',
	mark,
	simplified
}).string)}
	`;
}

export interface PrintDataflowGraphOptions {
	readonly mark?:               ReadonlySet<MermaidMarkdownMark>;
	readonly showCode?:           boolean;
	readonly codeOpen?:           boolean;
	readonly exposeResult?:       boolean;
	readonly switchCodeAndGraph?: boolean;
	readonly simplified?:         boolean;
	readonly callGraph?:          boolean;
}


/**
 * Visualizes a side effect for documentation purposes.
 */
export function formatSideEffect(ef: UnknownSideEffect): string {
	if(typeof ef === 'object') {
		return `${ef.id} (linked)`;
	} else {
		return `${ef}`;
	}
}

export async function printDfGraphForCode(parser: KnownParser, code: string, options: PrintDataflowGraphOptions & { exposeResult: true }): Promise<[string, PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]>;
export async function printDfGraphForCode(parser: KnownParser, code: string, options?: PrintDataflowGraphOptions & { exposeResult?: false | undefined }): Promise<string>;

/**
 * Visualizes the dataflow graph of the given R code using the given parser.
 * This function returns a markdown string containing the dataflow graph as a mermaid code block,
 * along with the R code itself in a collapsible section.
 */
export async function printDfGraphForCode(parser: KnownParser, code: string, { callGraph = false, simplified = false, mark, showCode = true, codeOpen = false, exposeResult, switchCodeAndGraph = false }: PrintDataflowGraphOptions = {}): Promise<string | [string, PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]> {
	const now = performance.now();
	const result = await createDataflowPipeline(parser, {
		context: contextFromInput(code)
	}).allRemainingSteps();
	const duration = performance.now() - now;

	if(switchCodeAndGraph) {
		guard(showCode, 'can not switch code and graph if code is not shown');
	}

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parse and normalize, using the [${parser.name}](${FlowrWikiBaseRef}/Engines) engine) within the generation environment.`;
	const graph = callGraph ? computeCallGraph(result.dataflow.graph) : result.dataflow.graph;
	const dfGraph = printDfGraph(graph, mark, simplified);
	const simplyText = simplified ? '(simplified) ' : '';
	const graphName = callGraph ? 'Call Graph' : 'Dataflow Graph';
	let resultText = '\n\n';

	if(showCode) {
		const codeText = codeBlock('r', code);
		resultText += switchCodeAndGraph ? codeText : dfGraph;
		resultText += `
<details${codeOpen ? ' open' : ''}>

<summary style="color:gray">${switchCodeAndGraph ? `${simplyText}${graphName} of the R Code` : `R Code of the ${simplyText}${graphName}`}</summary>

${metaInfo} ${mark ? `The following marks are used in the graph to highlight sub-parts (uses ids): {${[...mark].join(', ')}}.` : ''}
We encountered ${graph.unknownSideEffects.size > 0 ? 'unknown side effects (with ids: ' + [...graph.unknownSideEffects].map(formatSideEffect).join(', ') + ')' : 'no unknown side effects'} during the analysis.

${switchCodeAndGraph ? dfGraph : codeText}


</details>

`;
	} else {
		resultText += dfGraph + '\n(' + metaInfo + ')\n\n';
	}
	return exposeResult ? [resultText, result] : resultText;
}


/** returns resolved expected df graph */
export async function verifyExpectedSubgraph(parser: KnownParser, code: string, expectedSubgraph: DataflowGraph): Promise<DataflowGraph> {
	const context = contextFromInput(code);
	/* we verify that we get what we want first! */
	const info = await createDataflowPipeline(parser, {
		context: context,
		getId:   deterministicCountingIdGenerator(0)
	}).allRemainingSteps();

	expectedSubgraph.setIdMap(info.normalize.idMap);
	expectedSubgraph = resolveDataflowGraph(expectedSubgraph, context);
	const report: GraphDifferenceReport = diffOfDataflowGraphs(
		{ name: 'expected', graph: expectedSubgraph },
		{ name: 'got',      graph: info.dataflow.graph },
		{
			leftIsSubgraph: true
		}
	);

	guard(report.isEqual(), () => `report:\n * ${report.comments()?.join('\n * ') ?? ''}`);
	return expectedSubgraph;
}
