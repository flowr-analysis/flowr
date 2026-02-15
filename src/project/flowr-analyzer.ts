import type { FlowrConfigOptions } from '../config';
import type { KnownParser, KnownParserInformation } from '../r-bridge/parser';
import { executeQueries, type Queries, type QueryResults, type SupportedQueryTypes } from '../queries/query';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { decorateAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowInformation } from '../dataflow/info';
import type { CfgSimplificationPassName } from '../control-flow/cfg-simplification';
import type { PipelinePerStepMetaInformation } from '../core/steps/pipeline/pipeline';
import type { AnalyzerCacheType, FlowrAnalyzerCache } from './cache/flowr-analyzer-cache';
import type { FlowrSearchLike, SearchOutput } from '../search/flowr-search-builder';
import { type GetSearchElements, runSearch } from '../search/flowr-search-executor';
import type { FlowrAnalyzerContext, ReadOnlyFlowrAnalyzerContext } from './context/flowr-analyzer-context';
import { CfgKind } from './cfg-kind';
import type { RAnalysisRequest } from './context/flowr-analyzer-files-context';
import type { RParseRequest, RParseRequestFromFile } from '../r-bridge/retriever';
import { isParseRequest, fileProtocol, requestFromInput } from '../r-bridge/retriever';
import { isFilePath } from '../util/files';
import type { FlowrFileProvider } from './context/flowr-file';
import type { CallGraph } from '../dataflow/graph/call-graph';
import type { Tree } from 'web-tree-sitter';
import { normalizeTreeSitterTreeToAst } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-normalize';
import { TreeSitterExecutor } from '../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

/**
 * Extends the {@link ReadonlyFlowrAnalysisProvider} with methods that allow modifying the analyzer state.
 */
export interface FlowrAnalysisProvider<Parser extends KnownParser = KnownParser> extends ReadonlyFlowrAnalysisProvider<Parser> {
	/**
	 * Returns project context information.
	 * If you are a user that wants to inspect the context, prefer {@link inspectContext} instead.
	 * Please be aware that modifications to the context may break analyzer assumptions.
	 */
	context():  FlowrAnalyzerContext
	/**
	 * Add one or multiple requests to analyze.
	 * @param request - One or multiple requests or a file path (with the `file://` protocol). If you just enter a string without the {@link fileProtocol}, it will be interpreted as R code.
	 * @see {@link FlowrAnalysisProvider.addFile|addFile} - for adding files to the analyzer's context.
	 */
	addRequest(...request: (RAnalysisRequest | `${typeof fileProtocol}${string}` | string)[]): void
	/**
	 * Add one or multiple files to the analyzer's context.
	 * @param f - One or multiple file paths, file providers, or parse requests from file.
	 * @see {@link FlowrFileProvider} - for creating custom file providers.
	 * @see {@link FlowrAnalysisProvider.addRequest|addRequest} - for adding analysis requests to the analyzer.
	 */
	addFile(...f: (string | FlowrFileProvider<string> | RParseRequestFromFile)[]): void
	/**
	 * Reset the analyzer state, including the context and the cache.
	 */
	reset(): void;
}

/**
 * Exposes the central analyses and information provided by the {@link FlowrAnalyzer} to the linter, search, and query APIs.
 * This allows us to exchange the underlying implementation of the analyzer without affecting the APIs.
 * You can also use {@link ReadonlyFlowrAnalysisProvider#parseStandalone|parseStandalone} to parse standalone R code snippets.
 */
export interface ReadonlyFlowrAnalysisProvider<Parser extends KnownParser = KnownParser> {
	/**
	 * Returns a set of additional data and helper functions exposed by the underlying {@link KnownParser},
	 * including the parser's {@link BaseParserInformation.name} and corresponding version information.
	 */
	parserInformation(): KnownParserInformation
	/**
	 * Returns a read-only version of the project context information.
	 * This is the preferred method for users that want to inspect the context.
	 */
	inspectContext(): ReadOnlyFlowrAnalyzerContext
	/**
	 * Get the parse output for the request.
	 *
	 * The parse result type depends on the {@link KnownParser} used by the analyzer.
	 * @param force - Do not use the cache, instead force a new parse.
	 * @see {@link ReadonlyFlowrAnalysisProvider#peekParse} - to get the parse output if already available without triggering a new computation.
	 */
	parse(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['parse']>>
	/**
	 * Peek at the parse output for the request, if it was already computed.
	 */
	peekParse(): NonNullable<AnalyzerCacheType<Parser>['parse']> | undefined;
	/**
	 * Parse standalone R code provided as a string or via the `file://` protocol.
	 * @note this method will always use the {@link TreeSitterExecutor} internally, make sure it is initialized!
	 * @param data - The R code to parse, either as a string or as a `file://` URL.
	 */
	parseStandalone(data: `${typeof fileProtocol}${string}` | string | RParseRequest): Tree;
	/**
	 * Get the normalized abstract syntax tree for the request.
	 * @param force - Do not use the cache, instead force new analyses.
	 * @see {@link ReadonlyFlowrAnalysisProvider#peekNormalize} - to get the normalized AST if already available without triggering a new computation.
	 */
	normalize(force?: boolean): Promise<NormalizedAst & PipelinePerStepMetaInformation>;
	/**
	 * Peek at the normalized abstract syntax tree for the request, if it was already computed.
	 */
	peekNormalize(): NormalizedAst & PipelinePerStepMetaInformation | undefined;

	/**
	 * Normalize standalone R code provided as a string or via the `file://` protocol.
	 * @note this method will always use the {@link TreeSitterExecutor} internally, make sure it is initialized!
	 * @param data - The R code to normalize, either as a string or as a `file://` URL.
	 */
	normalizeStandalone(data: `${typeof fileProtocol}${string}` | string | RParseRequest): NormalizedAst;
	/**
	 * Get the dataflow graph for the request.
	 * @param force - Do not use the cache, instead force new analyses.
	 * @see {@link ReadonlyFlowrAnalysisProvider#peekDataflow} - to get the dataflow graph if already available without triggering a new computation.
	 */
	dataflow(force?: boolean): Promise<DataflowInformation & PipelinePerStepMetaInformation>;
	/**
	 * Peek at the dataflow graph for the request, if it was already computed.
	 */
	peekDataflow(): DataflowInformation & PipelinePerStepMetaInformation | undefined;
	/**
	 * Get the control flow graph (CFG) for the request.
	 * @param simplifications - Simplification passes to be applied to the CFG.
	 * @param kind            - The kind of CFG that is requested. By default, the CFG without dataflow information is returned.
	 * @param force           - Do not use the cache, instead force new analyses.
	 * @see {@link ReadonlyFlowrAnalysisProvider#peekControlflow} - to get the CFG if already available without triggering a new computation.
	 */
	controlflow(simplifications?: readonly CfgSimplificationPassName[], kind?: CfgKind, force?: boolean): Promise<ControlFlowInformation>;
	/**
	 * Peek at the control flow graph (CFG) for the request, if it was already computed.
	 */
	peekControlflow(simplifications?: readonly CfgSimplificationPassName[], kind?: CfgKind): ControlFlowInformation | undefined;
	/**
	 * Calculate the call graph for the request.
	 */
	callGraph(force?: boolean): Promise<CallGraph>;
	/**
	 * Peek at the call graph for the request, if it was already computed.
	 */
	peekCallGraph(): CallGraph | undefined;
	/**
	 * Access the query API for the request.
	 * @param query - The list of queries.
	 */
	query<Types extends SupportedQueryTypes = SupportedQueryTypes>(query: Queries<Types>): Promise<QueryResults<Types>>;
	/**
	 * Run a search on the current analysis.
	 */
	runSearch<Search extends FlowrSearchLike>(search: Search): Promise<GetSearchElements<SearchOutput<Search>>>;
	/**
	 * This executes all steps of the core analysis (parse, normalize, dataflow).
	 */
	runFull(force?: boolean): Promise<void>;
	/** This is the config used for the analyzer */
	flowrConfig: FlowrConfigOptions;
}


/**
 * Central class for conducting analyses with FlowR.
 * Use the {@link FlowrAnalyzerBuilder} to create a new instance.
 *
 * If you want the original pattern of creating a pipeline and running all steps, you can still do this with {@link FlowrAnalyzer#runFull}.
 *
 * To inspect the context of the analyzer, use {@link FlowrAnalyzer#inspectContext} (if you are a plugin and need to modify it, use {@link FlowrAnalyzer#context} instead).
 * @see https://github.com/flowr-analysis/flowr/wiki/Analyzer
 */
export class FlowrAnalyzer<Parser extends KnownParser = KnownParser> implements ReadonlyFlowrAnalysisProvider<Parser> {
	/** The parser and engine backend */
	private readonly parser: Parser;
	/** The cache used for storing analysis results */
	private readonly cache:  FlowrAnalyzerCache<Parser>;
	private readonly ctx:    FlowrAnalyzerContext;
	private parserInfo:      KnownParserInformation | undefined;

	/**
	 * Create a new analyzer instance.
	 * **Prefer the use of the {@link FlowrAnalyzerBuilder} instead of calling this constructor directly.**
	 * @param parser - The parser to use for parsing the given request.
	 * @param ctx    - The context to use for the analyses.
	 * @param cache  - The caching layer to use for storing analysis results.
	 */
	constructor(parser: Parser, ctx: FlowrAnalyzerContext, cache: FlowrAnalyzerCache<Parser>) {
		this.parser = parser;
		this.ctx = ctx;
		ctx.setAnalyzer(this);
		this.cache = cache;
	}

	public get flowrConfig(): FlowrConfigOptions {
		return this.ctx.config;
	}

	public context(): FlowrAnalyzerContext {
		return this.ctx;
	}

	public parserInformation(): KnownParserInformation {
		this.parserInfo ??= this.parser.information(this);
		return this.parserInfo;
	}

	public inspectContext(): ReadOnlyFlowrAnalyzerContext {
		return this.ctx.inspect();
	}

	public reset() {
		this.ctx.reset();
		this.cache.reset();
	}

	public parseStandalone(data: `${typeof fileProtocol}${string}` | string | RParseRequest): Tree {
		const request = isParseRequest(data) ? data : requestFromInput(data);
		if(this.parser.name === 'tree-sitter') {
			return this.parser.parse(request);
		} else {
			const ts = new TreeSitterExecutor();
			return ts.parse(request);
		}
	}

	public normalizeStandalone(data: `${typeof fileProtocol}${string}` | string | RParseRequest): NormalizedAst {
		const parse = this.parseStandalone(data);
		return decorateAst(normalizeTreeSitterTreeToAst([{ parsed: parse, filePath: undefined }], true), {});
	}

	public addRequest(...request: (RAnalysisRequest | readonly RAnalysisRequest[] | `${typeof fileProtocol}${string}` | string)[]): this {
		for(const r of request) {
			if(typeof r === 'string') {
				const trimmed = r.substring(fileProtocol.length);
				if(r.startsWith(fileProtocol) && !isFilePath(trimmed)) {
					this.addAnalysisRequest({ request: 'project', content: trimmed });
				} else {
					this.addRequestFromInput(r);
				}
			} else {
				this.addAnalysisRequest(r);
			}
		}
		return this;
	}

	public addFile(...f: (string | FlowrFileProvider | RParseRequestFromFile)[]): this {
		this.ctx.addFiles(f);
		return this;
	}

	/**
	 * Add a request created from the given input.
	 * This is a convenience method that uses {@link requestFromInput} internally.
	 */
	private addRequestFromInput(input: Parameters<typeof requestFromInput>[0]): this {
		this.addAnalysisRequest(requestFromInput(input));
		return this;
	}

	/**
	 * Add one or multiple requests to analyze the builder.
	 */
	private addAnalysisRequest(request: RAnalysisRequest | readonly RAnalysisRequest[]): this {
		this.ctx.addRequests((Array.isArray(request) ? request : [request]) as RAnalysisRequest[]);
		return this;
	}

	public async parse(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['parse']>> {
		return this.cache.parse(force);
	}

	public peekParse(): NonNullable<AnalyzerCacheType<Parser>['parse']> | undefined {
		return this.cache.peekParse();
	}

	public async normalize(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['normalize']>> {
		return this.cache.normalize(force);
	}

	public peekNormalize(): NonNullable<AnalyzerCacheType<Parser>['normalize']> | undefined {
		return this.cache.peekNormalize();
	}

	public async dataflow(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['dataflow']>> {
		return this.cache.dataflow(force);
	}

	public peekDataflow(): NonNullable<AnalyzerCacheType<Parser>['dataflow']> | undefined {
		return this.cache.peekDataflow();
	}

	public async runFull(force?: boolean): Promise<void> {
		await this.dataflow(force);
		return;
	}

	public async controlflow(simplifications?: readonly CfgSimplificationPassName[], kind?: CfgKind, force?: boolean): Promise<ControlFlowInformation> {
		return this.cache.controlflow(force, kind ?? CfgKind.NoDataflow, simplifications);
	}

	public peekControlflow(simplifications?: readonly CfgSimplificationPassName[], kind?: CfgKind): ControlFlowInformation | undefined {
		return this.cache.peekControlflow(kind ?? CfgKind.NoDataflow, simplifications);
	}

	public async callGraph(force?: boolean): Promise<CallGraph> {
		return this.cache.callGraph(force);
	}

	public peekCallGraph(): CallGraph | undefined {
		return this.cache.peekCallGraph();
	}

	public async query<
		Types extends SupportedQueryTypes = SupportedQueryTypes
	>(query: Queries<Types>): Promise<QueryResults<Types>> {
		return executeQueries({ analyzer: this }, query);
	}

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
