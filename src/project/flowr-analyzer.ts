import type { FlowrConfigOptions } from '../config';
import type { DEFAULT_DATAFLOW_PIPELINE
} from '../core/steps/pipeline/default-pipelines';


import type { KnownParser, KnownParserName, ParseStepOutput } from '../r-bridge/parser';
import type { Queries, QueryResults, SupportedQueryTypes } from '../queries/query';
import { executeQueries } from '../queries/query';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';
import type { PipelineInput, PipelinePerStepMetaInformation } from '../core/steps/pipeline/pipeline';
import { FlowrAnalyzerCache } from './cache/flowr-analyzer-cache';
import type { FlowrSearchLike, SearchOutput } from '../search/flowr-search-builder';
import type { GetSearchElements } from '../search/flowr-search-executor';
import { runSearch } from '../search/flowr-search-executor';
import type { FlowrAnalyzerContext } from './context/flowr-analyzer-context';

/**
 * Exposes the central analyses and information provided by the {@link FlowrAnalyzer} to the linter, search, and query APIs.
 * This allows us to exchange the underlying implementation of the analyzer without affecting the APIs.
 */
export type FlowrAnalysisProvider = {
    parserName(): string
    parse(force?: boolean): Promise<ParseStepOutput<Awaited<ReturnType<KnownParser['parse']>>> & PipelinePerStepMetaInformation>
	normalize(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation>;
	dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation>;
	controlflow(simplifications?: readonly CfgSimplificationPassName[], useDataflow?: boolean, force?: boolean): Promise<ControlFlowInformation>;
	flowrConfig: FlowrConfigOptions;
}


/**
 * Central class for conducting analyses in FlowR.
 * Use the {@link FlowrAnalyzerBuilder} to create a new instance.
 *
 * If you want the original pattern of creating a pipeline and running all steps, you can still do this with {@link FlowrAnalyzer#runFull}.
 */
export class FlowrAnalyzer<Parser extends KnownParser = KnownParser> {
	/** This is the config used for the analyzer */
	public readonly flowrConfig: FlowrConfigOptions;
	/** The parser and engine backend */
	private readonly parser:     Parser;
	/** The cache used for storing analysis results */
	private readonly cache:      FlowrAnalyzerCache<Parser>;
	private readonly ctx:        FlowrAnalyzerContext;

	/**
     * Create a new analyzer instance.
     * **Prefer the use of the {@link FlowrAnalyzerBuilder} instead of calling this constructor directly.**
     *
     * @param config        - The FlowR config to use for the analyses
     * @param parser        - The parser to use for parsing the given request.
     * @param ctx           - The context to use for the analyses.
     * @param requiredInput - Additional parameters used for the analyses.
     */
	constructor(config: FlowrConfigOptions, parser: Parser, ctx: FlowrAnalyzerContext, requiredInput: Omit<PipelineInput<typeof DEFAULT_DATAFLOW_PIPELINE>, 'parser' | 'request'>) {
		this.flowrConfig = config;
		this.parser = parser;
		this.ctx = ctx;
		this.cache = FlowrAnalyzerCache.create({ parser, config, request: ctx.files.calculateLoadingOrder(), ...requiredInput });
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
	public async parse(force?: boolean): ReturnType<typeof this.cache.parse> {
		return this.cache.parse(force);
	}

	/**
     * Get the normalized abstract syntax tree for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
	public async normalize(force?: boolean): ReturnType<typeof this.cache.normalize> {
		return this.cache.normalize(force);
	}

	/**
     * Get the dataflow graph for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
	public async dataflow(force?: boolean): ReturnType<typeof this.cache.dataflow> {
		return this.cache.dataflow(force);
	}

	/**
     * This executes all steps of the core analysis (parse, normalize, dataflow).
     */
	public async runFull(force?: boolean): Promise<void> {
		await this.dataflow(force);
		return;
	}

	/**
     * Get the control flow graph (CFG) for the request.
     * @param simplifications - Simplification passes to be applied to the CFG.
     * @param useDataflow     - Whether to use the dataflow graph for the creation of the CFG.
     * @param force           - Do not use the cache, instead force new analyses.
     */
	public async controlflow(simplifications?: readonly CfgSimplificationPassName[], useDataflow?: boolean, force?: boolean): Promise<ControlFlowInformation> {
		return this.cache.controlflow(force, useDataflow ?? false, simplifications);
	}

	/**
     * Get a quick and dirty control flow graph (CFG) for the request.
     * @param force - Do not use the cache, instead force new analyses.
     */
	public async controlflowQuick(force?: boolean): Promise<ControlFlowInformation> {
		return this.controlflow(undefined, false, force);
	}

	/**
     * Access the query API for the request.
     * @param query - The list of queries.
     */
	public async query<
        Types extends SupportedQueryTypes = SupportedQueryTypes
    >(query: Queries<Types>): Promise<QueryResults<Types>> {
		return executeQueries({ analyzer: this }, query);
	}

	/**
     * Run a search on the current analysis.
     */
	public async runSearch<
        Search extends FlowrSearchLike
    >(search: Search): Promise<GetSearchElements<SearchOutput<Search>>> {
		return runSearch(search, this);
	}


	/**
     * Close the parser if it was created by this builder. This is only required if you rely on an RShell/remote engine.
     */
	public close() {
		return this.parser?.close();
	}
}