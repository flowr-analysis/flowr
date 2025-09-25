import type { FlowrConfigOptions } from '../config';
import type { RParseRequests } from '../r-bridge/retriever';
import type { DEFAULT_DATAFLOW_PIPELINE
} from '../core/steps/pipeline/default-pipelines';
import {
	createDataflowPipeline,
	createNormalizePipeline,
	createParsePipeline
} from '../core/steps/pipeline/default-pipelines';
import type { KnownParser, KnownParserName, ParseStepOutput } from '../r-bridge/parser';
import type { Queries, QueryResults, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import { extractCfg, extractCfgQuick } from '../control-flow/extract-cfg';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';
import type { PipelineInput, PipelinePerStepMetaInformation } from '../core/steps/pipeline/pipeline';
import type { NormalizeRequiredInput } from '../core/steps/all/core/10-normalize';
import { FlowrAnalyzerCache } from './cache/flowr-analyzer-cache';

/**
 * Exposes the central analyses and information provided by the {@link FlowrAnalyzer} to the linter, search, and query APIs.
 * This allows us to exchange the underlying implementation of the analyzer without affecting the APIs.
 */
export type FlowrAnalysisInput = {
    parserName(): string
    parse(force?: boolean): Promise<ParseStepOutput<Awaited<ReturnType<KnownParser['parse']>>> & PipelinePerStepMetaInformation>
	normalize(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation>;
	dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation>;
	controlflow(simplifications?: readonly CfgSimplificationPassName[], useDataflow?: boolean, force?: boolean): Promise<ControlFlowInformation>;
	flowrConfig: FlowrConfigOptions;
}



/**
 * Central class for creating analyses in FlowR.
 * Use the {@link FlowrAnalyzerBuilder} to create a new instance.
 */
export class FlowrAnalyzer<Parser extends KnownParser = KnownParser> {
	/** This is the config used for the analyzer */
	public readonly flowrConfig:    FlowrConfigOptions;
	/** The currently active request that governs this analyzer */
	private readonly request:       RParseRequests;
	/** The parser and engine backend */
	private readonly parser:        Parser;
	private readonly requiredInput: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser' | 'request'>;

	private readonly cache: FlowrAnalyzerCache<Parser>;

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
		this.cache = FlowrAnalyzerCache.create(parser);
	}

	/**
     * Reset all caches used by the analyzer and effectively force all analyses to be redone.
     */
	public reset() {
		this.cache.reset();
	}

	/**
     * Get the name of the parser used by the analyzer.
     */
	public parserName(): KnownParserName {
		return this.parser.name;
	}

	/**
     * Get the parse output for the request.
     *
     * The parse result type depends on the {@link KnownParser} used by the analyzer.
     * @param force - Do not use the cache, instead force a new parse.
     */
	public async parse(force?: boolean): Promise<ParseStepOutput<Awaited<ReturnType<Parser['parse']>>> & PipelinePerStepMetaInformation> {

		return this.cache.parse.computeIfAbsent(force,
			() =>  {

			}
		);

		if(this.parseCache && !force) {
			return {
				...this.parseCache,
				'.meta': {
					cached: true
				}
			};
		}

		const result = await createParsePipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.parseCache = result.parse as unknown as ParseStepOutput<Awaited<ReturnType<Parser['parse']>>> & PipelinePerStepMetaInformation;
		return this.parseCache;
	}

	/**
     * Get the normalized abstract syntax tree for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
	public async normalizedAst(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation> {
		if(this.normalizeCache && !force) {
			return {
				...this.normalizeCache,
				'.meta': {
					cached: true
				}
			};
		}

		const result = await createNormalizePipeline(
			this.parser,
			{ request: this.request, ...this.requiredInput },
			this.flowrConfig).allRemainingSteps();
		this.normalizeCache = result.normalize;
		return result.normalize;
	}

	/**
     * Get the dataflow graph for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
	public async dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation> {
		if(this.dataflowCache && !force) {
			return {
				...this.dataflowCache,
				'.meta': {
					cached: true
				}
			};
		}

		const result = await createDataflowPipeline(
			this.parser,
			{ request: this.request },
			this.flowrConfig).allRemainingSteps();
		this.dataflowCache = result.dataflow;
		this.normalizeCache = result.normalize;
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

		if(force || !this.normalizeCache) {
			await this.normalizedAst(force);
		}

		if(useDataflow && (force || !this.dataflowCache)) {
			await this.dataflow(force);
		}

		const result = extractCfg(this.normalizeCache, this.flowrConfig, this.dataflowCache?.graph, simplifications);
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

		if(force || !this.normalizeCache) {
			await this.normalizedAst(force);
		}

		const result = extractCfgQuick(this.normalizeCache);
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