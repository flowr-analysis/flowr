import type { FlowrConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import {
	createDataflowPipeline,
	createNormalizePipeline,
	createParsePipeline
} from '../core/steps/pipeline/default-pipelines';
import type { KnownParser, ParseStepOutput } from '../r-bridge/parser';
import type { Queries, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import { extractCfg, extractSimpleCfg } from '../control-flow/extract-cfg';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';
import type { PipelinePerStepMetaInformation } from '../core/steps/pipeline/pipeline';

export class FlowrAnalyzer {
	public readonly flowrConfig: FlowrConfigOptions;
	private readonly request:    RParseRequests;
	private readonly parser:     KnownParser;

	private parse = undefined as unknown as ParseStepOutput<any>;
	private ast = undefined as unknown as NormalizedAst;
	private dataflowInfo = undefined as unknown as DataflowInformation;
	private controlFlowInfo = undefined as unknown as ControlFlowInformation;
	private simpleControlFlowInfo = undefined as unknown as ControlFlowInformation; // TODO Differentiate between simple and regular CFG

	constructor(config: FlowrConfigOptions, parser: KnownParser, request: RParseRequests) {
		this.flowrConfig = config;
		this.request = request;
		this.parser = parser;
	}

	public reset() {
		this.ast = undefined as unknown as NormalizedAst;
		this.dataflowInfo = undefined as unknown as DataflowInformation;
		this.controlFlowInfo = undefined as unknown as ControlFlowInformation;
	}

	public parserName(): string {
		return this.parser.name;
	}

	// TODO TSchoeller Fix type
	// TODO TSchoeller Do we want to expose parsing in this way?
	public async parseOutput(force?: boolean): Promise<ParseStepOutput<any> & PipelinePerStepMetaInformation> {
		if(this.parse && !force) {
			return {
				...this.parse,
				'.meta': {
					cached: true
				}
			};
		}

		const result = await createParsePipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.parse = result.parse;
		return result.parse;
	}

	public async normalizedAst(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation> {
		if(this.ast && !force) {
			return {
				...this.ast,
				'.meta': {
					cached: true
				}
			};
		}

		const result = await createNormalizePipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.ast = result.normalize;
		return result.normalize;
	}

	public async dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation> {
		if(this.dataflowInfo && !force) {
			return {
				...this.dataflowInfo,
				'.meta': {
					cached: true
				}
			};
		}

		const result = await createDataflowPipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.dataflowInfo = result.dataflow;
		this.ast = result.normalize;
		return result.dataflow;
	}

	public async controlFlow(simplifications?: readonly CfgSimplificationPassName[], useDataflow?: boolean, force?: boolean): Promise<ControlFlowInformation> {
		if(this.controlFlowInfo && !force) {
			return this.controlFlowInfo;
		}

		if(force || !this.ast) {
			await this.normalizedAst(force);
		}

		if(useDataflow && (force || !this.dataflowInfo)) {
			await this.dataflow(force);
		}

		const result = extractCfg(this.ast, this.flowrConfig, this.dataflowInfo?.graph, simplifications);
		this.controlFlowInfo = result;
		return result;
	}

	public async simpleControlFlow(simplifications?: readonly CfgSimplificationPassName[], force?: boolean): Promise<ControlFlowInformation> {
		if(this.simpleControlFlowInfo && !force) {
			return this.simpleControlFlowInfo;
		} else if(this.controlFlowInfo && !force) {
			// Use the full CFG is it is already available
			return this.controlFlowInfo;
		}

		if(force || !this.ast) {
			await this.normalizedAst(force);
		}

		const result = extractSimpleCfg(this.ast);
		this.simpleControlFlowInfo = result;
		return result;
	}

	public async query(query: Queries<SupportedQueryTypes>, force?: boolean) {
		if(!this.dataflowInfo) {
			await this.dataflow(force);
		}
		return executeQueries({ ast: this.ast, dataflow: this.dataflowInfo, config: this.flowrConfig }, query);
	}
}