import type { FlowrConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import { createDataflowPipeline, createNormalizePipeline } from '../core/steps/pipeline/default-pipelines';
import type { KnownParser } from '../r-bridge/parser';
import type { Queries, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import { extractCfg } from '../control-flow/extract-cfg';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';

export class FlowrAnalyzer {
	public readonly flowrConfig: FlowrConfigOptions;
	private readonly request:    RParseRequests;
	private readonly parser:     KnownParser;

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

	public async controlflow(simplifications?: readonly CfgSimplificationPassName[], force?: boolean): Promise<ControlFlowInformation> {
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