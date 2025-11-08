import type { DataflowGraph, UnknownSidEffect } from '../../dataflow/graph/graph';
import type { RShell } from '../../r-bridge/shell';
import { type MermaidMarkdownMark , graphToMermaid } from '../../util/mermaid/dfg';
import { PipelineExecutor } from '../../core/pipeline-executor';
import { createDataflowPipeline, DEFAULT_DATAFLOW_PIPELINE } from '../../core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../r-bridge/retriever';
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
import { defaultConfigOptions } from '../../config';


/**
 *
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
}


/**
 *
 */
export function formatSideEffect(ef: UnknownSidEffect): string {
	if(typeof ef === 'object') {
		return `${ef.id} (linked)`;
	} else {
		return `${ef}`;
	}
}

export async function printDfGraphForCode(parser: KnownParser, code: string, options: PrintDataflowGraphOptions & { exposeResult: true }): Promise<[string, PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]>;
export async function printDfGraphForCode(parser: KnownParser, code: string, options?: PrintDataflowGraphOptions & { exposeResult?: false | undefined }): Promise<string>;

/**
 *
 */
export async function printDfGraphForCode(parser: KnownParser, code: string, { simplified = false, mark, showCode = true, codeOpen = false, exposeResult, switchCodeAndGraph = false }: PrintDataflowGraphOptions = {}): Promise<string | [string, PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>]> {
	const now = performance.now();
	const result = await createDataflowPipeline(parser, {
		request: requestFromInput(code)
	}, defaultConfigOptions).allRemainingSteps();
	const duration = performance.now() - now;

	if(switchCodeAndGraph) {
		guard(showCode, 'can not switch code and graph if code is not shown');
	}

	const metaInfo = `The analysis required _${printAsMs(duration)}_ (including parse and normalize, using the [${parser.name}](${FlowrWikiBaseRef}/Engines) engine) within the generation environment.`;
	const dfGraph = printDfGraph(result.dataflow.graph, mark, simplified);
	const simplyText = simplified ? '(simplified) ' : '';
	let resultText = '\n\n';

	if(showCode) {
		const codeText = codeBlock('r', code);
		resultText += switchCodeAndGraph ? codeText : dfGraph;
		resultText += `
<details${codeOpen ? ' open' : ''}>

<summary style="color:gray">${switchCodeAndGraph ? `${simplyText}Dataflow Graph of the R Code` : `R Code of the ${simplyText}Dataflow Graph`}</summary>

${metaInfo} ${mark ? `The following marks are used in the graph to highlight sub-parts (uses ids): {${[...mark].join(', ')}}.` : ''}
We encountered ${result.dataflow.graph.unknownSideEffects.size > 0 ? 'unknown side effects (with ids: ' + [...result.dataflow.graph.unknownSideEffects].map(formatSideEffect).join(', ') + ')' : 'no unknown side effects'} during the analysis.

${switchCodeAndGraph ? dfGraph : codeText}


</details>

`;
	} else {
		resultText += dfGraph + '\n(' + metaInfo + ')\n\n';
	}
	return exposeResult ? [resultText, result] : resultText;
}


/** returns resolved expected df graph */
export async function verifyExpectedSubgraph(shell: RShell, code: string, expectedSubgraph: DataflowGraph): Promise<DataflowGraph> {
	/* we verify that we get what we want first! */
	const info = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
		parser:  shell,
		request: requestFromInput(code),
		getId:   deterministicCountingIdGenerator(0)
	}, defaultConfigOptions).allRemainingSteps();

	expectedSubgraph.setIdMap(info.normalize.idMap);
	expectedSubgraph = resolveDataflowGraph(expectedSubgraph);
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
