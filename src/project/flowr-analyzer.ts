import type { FlowrConfigOptions } from '../config';
import { cloneConfig, defaultConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import { requestFromInput } from '../r-bridge/retriever';
import type { DEFAULT_DATAFLOW_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import { createDataflowPipeline, createSlicePipeline } from '../core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../core/steps/pipeline/pipeline';
import { FlowrAnalyzerBuilder } from './flowr-analyzer-builder';
import { graphToMermaidUrl } from '../util/mermaid/dfg';
import type { KnownParser } from '../r-bridge/parser';
import type { SlicingCriteria } from '../slicing/criterion/parse';
import type { Queries, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import type { DataflowInformation } from '../dataflow/info';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';

export class FlowrAnalyzer {
	private readonly flowrConfig: FlowrConfigOptions = cloneConfig(defaultConfigOptions);
	private readonly request:     RParseRequests;
	private readonly parser:      KnownParser;
	private ast = undefined as unknown as NormalizedAst;
	private dataflowInfo = undefined as unknown as DataflowInformation;

	constructor(config: FlowrConfigOptions, parser: KnownParser, request: RParseRequests) {
		this.flowrConfig = config;
		this.request = request;
		this.parser = parser;
	}

	public async dataflow() : Promise<PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>> {
		const result = await createDataflowPipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.dataflowInfo = result.dataflow;
		this.ast = result.normalize;
		return result;
	}

	public async slice(criterion: SlicingCriteria) {
		return createSlicePipeline(
			this.parser,
			{
				request:   this.request,
				criterion: criterion
			},
			this.flowrConfig).allRemainingSteps();
	}

	public async query(query: Queries<SupportedQueryTypes>) {
		if(!this.dataflowInfo) {
			await this.dataflow();
		}
		return executeQueries({ ast: this.ast, dataflow: this.dataflowInfo, config: this.flowrConfig }, query);
	}
}

async function main() {
	const analyzer = await new FlowrAnalyzerBuilder(requestFromInput('x <- 1\nfoo <- function(){}\nfoo()'))
		.setEngine('r-shell')
		.amendConfig(c => {
			c.solver.pointerTracking = true;
			return c;
		})
		.build();
	const result = await analyzer.dataflow();
	const query = await analyzer.query([{
		type:     'call-context',
		kind:     'test-kind',
		subkind:  'test-subkind',
		callName: /foo/
	}]);
	const slice = await analyzer.slice(['3@foo']);
	console.log(graphToMermaidUrl(result.dataflow.graph));
	console.log(slice.reconstruct);
	console.log(query);
}

void main();