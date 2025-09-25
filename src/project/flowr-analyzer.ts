import type { FlowrConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import {
	createDataflowPipeline,
	createNormalizePipeline,
	createParsePipeline
} from '../core/steps/pipeline/default-pipelines';
import type { KnownParser, ParseStepOutput } from '../r-bridge/parser';
import type { Queries, QueryResults, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import { extractCfg, extractCfgQuick } from '../control-flow/extract-cfg';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';
import type { PipelinePerStepMetaInformation } from '../core/steps/pipeline/pipeline';
import type { NormalizeRequiredInput } from '../core/steps/all/core/10-normalize';
import { ObjectMap } from '../util/collections/objectmap';

/**
 * Exposes the central analyses and information provided by the {@link FlowrAnalyzer} to the linter, search, and query APIs
 */
export type FlowrAnalysisInput = {
    parserName(): string
    parseOutput(force?: boolean): Promise<ParseStepOutput<Awaited<ReturnType<KnownParser['parse']>>> & PipelinePerStepMetaInformation>
	normalizedAst(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation>;
	dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation>;
	controlFlow(simplifications?: readonly CfgSimplificationPassName[], useDataflow?: boolean, force?: boolean): Promise<ControlFlowInformation>;
	flowrConfig: FlowrConfigOptions;
}

interface ControlFlowCache {
	simplified: ObjectMap<CfgSimplificationPassName, ControlFlowInformation>,
	quick: 		   ControlFlowInformation
}

/**
 * Central class for creating analyses in FlowR.
 * Use the {@link FlowrAnalyzerBuilder} to create a new instance.
 */
export class FlowrAnalyzer<Parser extends KnownParser = KnownParser> {
	public readonly flowrConfig:    FlowrConfigOptions;
	private readonly request:       RParseRequests;
	private readonly parser:        Parser;
	private readonly requiredInput: Omit<NormalizeRequiredInput, 'request'>;

	private parse = undefined as unknown as ParseStepOutput<Awaited<ReturnType<Parser['parse']>>> & PipelinePerStepMetaInformation;
	private ast = undefined as unknown as NormalizedAst;
	private dataflowInfo = undefined as unknown as DataflowInformation;
	private controlFlowInfos: ControlFlowCache = {
		simplified: new ObjectMap<CfgSimplificationPassName, ControlFlowInformation>(),
		quick:      undefined as unknown as ControlFlowInformation
	};

	/**
     * Create a new analyzer instance.
     * Prefer the use of the {@link FlowrAnalyzerBuilder} instead of calling this constructor directly.
     * @param config        - The FlowR config to use for the analyses
     * @param parser        - The parser to use for parsing the given request.
     * @param request       - The code to analyze.
     * @param requiredInput - Additional parameters used for the analyses.
     */
	constructor(config: FlowrConfigOptions, parser: Parser, request: RParseRequests, requiredInput: Omit<NormalizeRequiredInput, 'request'>) {
		this.flowrConfig = config;
		this.request = request;
		this.parser = parser;
		this.requiredInput = requiredInput;
	}

	public reset() {
		this.ast = undefined as unknown as NormalizedAst;
		this.dataflowInfo = undefined as unknown as DataflowInformation;
		this.controlFlowInfos = { 
			simplified: new ObjectMap<CfgSimplificationPassName, ControlFlowInformation>(),
			quick:      undefined as unknown as ControlFlowInformation
		};
	}

	public parserName(): string {
		return this.parser.name;
	}

	/**
     * Get the parse output for the request.
     * The parse result type depends on the {@link KnownParser} used by the analyzer.
     * @param force - Do not use the cache, instead force a new parse.
     */
	public async parseOutput(force?: boolean): Promise<ParseStepOutput<Awaited<ReturnType<Parser['parse']>>> & PipelinePerStepMetaInformation> {
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
		this.parse = result.parse as unknown as ParseStepOutput<Awaited<ReturnType<Parser['parse']>>> & PipelinePerStepMetaInformation;
		return this.parse;
	}

	/**
     * Get the normalized abstract syntax tree for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
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

	/**
     * Get the dataflow graph for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
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

	/**
     * Get the control flow graph (CFG) for the request.
     * @param simplifications - Simplification passes to be applied to the CFG.
     * @param useDataflow     - Whether to use the dataflow graph for the creation of the CFG.
     * @param force           - Do not use the cache, instead force new analyses.
     */
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

	/**
     * Get a more performant version of the control flow graph.
     * @param force - Do not use the cache, instead force new analyses.
     */
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

	/**
     * Access the query API for the request.
     * @param query - The list of queries.
     */
	public async query<
        Types extends SupportedQueryTypes = SupportedQueryTypes
    >(query: Queries<Types>): Promise<QueryResults<Types>> {
		return executeQueries({ input: this }, query);
	}
}