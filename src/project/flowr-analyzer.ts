import type { FlowrConfigOptions } from '../config';
import { cloneConfig, defaultConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import { requestFromInput } from '../r-bridge/retriever';
import { PipelineExecutor } from '../core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../core/steps/pipeline/default-pipelines';
import { RShell } from '../r-bridge/shell';
import type { PipelineOutput } from '../core/steps/pipeline/pipeline';
import { FlowrAnalyzerBuilder } from './flowr-analyzer-builder';
import { graphToMermaidUrl } from '../util/mermaid/dfg';

export class FlowrAnalyzer {
	private flowrConfig: FlowrConfigOptions = cloneConfig(defaultConfigOptions);
	private request:     RParseRequests;

	constructor(config: FlowrConfigOptions, request: RParseRequests) {
		this.flowrConfig = config;
		this.request = request;
	}

	public dataflow() : Promise<PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>> {
		return new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  new RShell(),
			request: this.request
		}, this.flowrConfig).allRemainingSteps();
	}
}

async function main() {
	const result = await new FlowrAnalyzerBuilder(requestFromInput('x <- 1'))
		.amendConfig(c => {
			c.solver.pointerTracking = true;
			return c;
		})
		.build()
		.dataflow();
	console.error(graphToMermaidUrl(result.dataflow.graph));
}

void main();