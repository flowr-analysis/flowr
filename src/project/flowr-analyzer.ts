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
import { extractCfg, extractCfgQuick } from '../control-flow/extract-cfg';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';
import type { PipelinePerStepMetaInformation } from '../core/steps/pipeline/pipeline';
import type { NormalizeRequiredInput } from '../core/steps/all/core/10-normalize';
import { ArrayMap } from '../util/collections/arraymap';

export type FlowrAnalysisInput = {
	normalizedAst(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation>;
	dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation>;
	controlFlow(simplifications?: readonly CfgSimplificationPassName[], useDataflow?: boolean, force?: boolean): Promise<ControlFlowInformation>;
	flowrConfig: FlowrConfigOptions;
}

interface ControlFlowCache {
	simplified: ArrayMap<CfgSimplificationPassName, ControlFlowInformation>,
	quick: 		   ControlFlowInformation
}

export class FlowrAnalyzer {
	public readonly flowrConfig:    FlowrConfigOptions;
	private readonly request:       RParseRequests;
	private readonly parser:        KnownParser;
	private readonly requiredInput: Omit<NormalizeRequiredInput, 'request'>;

	private parse = undefined as unknown as ParseStepOutput<any>;
	private ast = undefined as unknown as NormalizedAst;
	private dataflowInfo = undefined as unknown as DataflowInformation;
	private controlFlowInfos: ControlFlowCache = {
		simplified: new ArrayMap<CfgSimplificationPassName, ControlFlowInformation>(),
		quick:      undefined as unknown as ControlFlowInformation
	};

	constructor(config: FlowrConfigOptions, parser: KnownParser, request: RParseRequests, requiredInput: Omit<NormalizeRequiredInput, 'request'>) {
		this.flowrConfig = config;
		this.request = request;
		this.parser = parser;
		this.requiredInput = requiredInput;
	}

	public reset() {
		this.ast = undefined as unknown as NormalizedAst;
		this.dataflowInfo = undefined as unknown as DataflowInformation;
		this.controlFlowInfos = { 
			simplified: new ArrayMap<CfgSimplificationPassName, ControlFlowInformation>(),
			quick:      undefined as unknown as ControlFlowInformation
		};
	}

	public parserName(): string {
		return this.parser.name;
	}

	// TODO TSchoeller Fix type
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
			{ request: this.request, ...this.requiredInput },
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
		if(!force) {
			const value = this.controlFlowInfos.simplified.get(simplifications ?? []);
			if(value !== undefined) {
				return value;
			}
		}

		if(force || !this.ast) {
			await this.normalizedAst(force);
		}

		if(useDataflow && (force || !this.dataflowInfo)) {
			await this.dataflow(force);
		}

		const result = extractCfg(this.ast, this.flowrConfig, this.dataflowInfo?.graph, simplifications);
		this.controlFlowInfos.simplified.set(simplifications ?? [], result);
		return result;
	}

	public async controlFlowQuick(force?: boolean): Promise<ControlFlowInformation> {
		if(!force) {
			if(this.controlFlowInfos.quick) {
				return this.controlFlowInfos.quick;
			}

			// Use the unsimplified CFG if it is already available
			const value = this.controlFlowInfos.simplified.get([]);
			if(value !== undefined) {
				return value;
			}
		}

		if(force || !this.ast) {
			await this.normalizedAst(force);
		}

		const result = extractCfgQuick(this.ast);
		this.controlFlowInfos.quick = result;
		return result;
	}

	public async query(query: Queries<SupportedQueryTypes>, force?: boolean) {
		if(!this.dataflowInfo) {
			await this.dataflow(force);
		}
		return executeQueries({ input: this }, query);
	}
}