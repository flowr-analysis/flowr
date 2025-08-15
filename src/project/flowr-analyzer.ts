import type { FlowrConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import { requestFromInput } from '../r-bridge/retriever';
import { createDataflowPipeline, createNormalizePipeline } from '../core/steps/pipeline/default-pipelines';
import { FlowrAnalyzerBuilder } from './flowr-analyzer-builder';
import { graphToMermaidUrl } from '../util/mermaid/dfg';
import type { KnownParser } from '../r-bridge/parser';
import type { Queries, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import type { DataflowInformation } from '../dataflow/info';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { extractCfg } from '../control-flow/extract-cfg';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';

export class FlowrAnalyzer {
	private readonly flowrConfig: FlowrConfigOptions;
	private readonly request:     RParseRequests;
	private readonly parser:      KnownParser;

	private ast = undefined as unknown as NormalizedAst;
	private dataflowInfo = undefined as unknown as DataflowInformation;
	private controlflowInfo = undefined as unknown as ControlFlowInformation;

	constructor(config: FlowrConfigOptions, parser: KnownParser, request: RParseRequests) {
		this.flowrConfig = config;
		this.request = request;
		this.parser = parser;
	}

	public reset() {
		this.ast = undefined as unknown as NormalizedAst;
		this.dataflowInfo = undefined as unknown as DataflowInformation;
		this.controlflowInfo = undefined as unknown as ControlFlowInformation;
	}

	public async normalizedAst(force?: boolean): Promise<NormalizedAst> {
		if(this.ast && !force) {
			return this.ast;
		}

		const result = await createNormalizePipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.ast = result.normalize;
		return result.normalize;
	}

	public async dataflow(force?: boolean): Promise<DataflowInformation> {
		if(this.dataflowInfo && !force) {
			return this.dataflowInfo;
		}

		const result = await createDataflowPipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.dataflowInfo = result.dataflow;
		this.ast = result.normalize;
		return result.dataflow;
	}

	public async controlflow(force?: boolean): Promise<ControlFlowInformation> {
		if(this.controlflowInfo && !force) {
			return this.controlflowInfo;
		}

		if(force || !this.ast) {
			await this.normalizedAst(force);
		}

		const result = extractCfg(this.ast, this.flowrConfig);
		this.controlflowInfo = result;
		return result;
	}

	public async query(query: Queries<SupportedQueryTypes>, force?: boolean) {
		if(!this.dataflowInfo) {
			await this.dataflow(force);
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
	console.log(graphToMermaidUrl(result.graph));
	console.log(query);
}

if(require.main === module) {
	void main();
}