import type { KnownParser } from '../../r-bridge/parser';
import { type CacheInvalidationEvent, CacheInvalidationEventType, FlowrCache } from './flowr-cache';
import {
	createDataflowPipeline,
	type DEFAULT_DATAFLOW_PIPELINE,
	type TREE_SITTER_DATAFLOW_PIPELINE
} from '../../core/steps/pipeline/default-pipelines';
import type { PipelineExecutor } from '../../core/pipeline-executor';
import type { IdGenerator } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { NoInfo } from '../../r-bridge/lang-4.x/ast/model/model';
import type { TreeSitterExecutor } from '../../r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { PipelineOutput } from '../../core/steps/pipeline/pipeline';
import { assertUnreachable, guard } from '../../util/assert';
import type { CfgSimplificationPassName } from '../../control-flow/cfg-simplification';
import type { ControlFlowInformation } from '../../control-flow/control-flow-graph';
import type { CfgKind } from '../cfg-kind';
import type { FlowrAnalyzerContext } from '../context/flowr-analyzer-context';
import { FlowrAnalyzerControlFlowCache } from './flowr-analyzer-controlflow-cache';
import type { CallGraph } from '../../dataflow/graph/call-graph';
import { computeCallGraph } from '../../dataflow/graph/call-graph';

interface FlowrAnalyzerCacheOptions<Parser extends KnownParser> {
	parser:  Parser;
	context: FlowrAnalyzerContext;
	getId?:  IdGenerator<NoInfo>
}

type AnalyzerPipeline<Parser extends KnownParser> = Parser extends TreeSitterExecutor ?
        typeof TREE_SITTER_DATAFLOW_PIPELINE : typeof DEFAULT_DATAFLOW_PIPELINE;
type AnalyzerPipelineExecutor<Parser extends KnownParser> = PipelineExecutor<AnalyzerPipeline<Parser>>;

/* for whatever reason moving the ternary in with `AnalyzerPipeline` just breaks the type system */
export type AnalyzerCacheType<Parser extends KnownParser> = Parser extends TreeSitterExecutor ? Partial<PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE>>
	: Partial<PipelineOutput<typeof DEFAULT_DATAFLOW_PIPELINE>>;

/**
 * This provides the full analyzer caching layer, please avoid using this directly
 * and prefer the {@link FlowrAnalyzer}.
 */
export class FlowrAnalyzerCache<Parser extends KnownParser> extends FlowrCache<AnalyzerCacheType<Parser>> {
	private args:             FlowrAnalyzerCacheOptions<Parser>;
	private pipeline:         AnalyzerPipelineExecutor<Parser> = undefined as unknown as AnalyzerPipelineExecutor<Parser>;
	private controlFlowCache: FlowrAnalyzerControlFlowCache = undefined as unknown as FlowrAnalyzerControlFlowCache;
	private callGraphCache:   CallGraph | undefined = undefined;

	protected constructor(args: FlowrAnalyzerCacheOptions<Parser>) {
		super();
		this.args = args;
		this.initCacheProviders();
	}

	private initCacheProviders() {
		this.pipeline = createDataflowPipeline(this.args.parser, {
			context: this.args.context,
			getId:   this.args.getId
		}) as AnalyzerPipelineExecutor<Parser>;
		this.controlFlowCache = new FlowrAnalyzerControlFlowCache();
		this.callGraphCache = undefined;
	}

	public static create<Parser extends KnownParser>(data: FlowrAnalyzerCacheOptions<Parser>): FlowrAnalyzerCache<Parser> {
		return new FlowrAnalyzerCache<Parser>(data);
	}

	public override receive(event: CacheInvalidationEvent): void {
		super.receive(event);
		switch(event.type) {
			case CacheInvalidationEventType.Full:
				this.initCacheProviders();
				break;
			default:
				assertUnreachable(event.type);
		}
	}

	private get(): AnalyzerCacheType<Parser> {
		/* this will do a ref assignment, so indirect force */
		return this.computeIfAbsent(false, () => this.pipeline.getResults(true));
	}

	public reset() {
		this.receive({ type: CacheInvalidationEventType.Full });
	}

	private async runTapeUntil<T>(force: boolean | undefined, until: () => T | undefined): Promise<T> {
		guard(this.args.context.files.loadingOrder.getUnorderedRequests().length > 0,
			'At least one request must be set to run the analysis pipeline');
		if(force) {
			this.reset();
		}
		let g: T | undefined;
		while((g = until()) === undefined && this.pipeline.hasNextStep()) {
			await this.pipeline.nextStep();
		}
		guard(g !== undefined, 'Could not reach the desired pipeline step, invalid cache state(?)');
		return g;
	}

	/**
	 * Get the parse output for the request, parsing if necessary.
	 * @param force - Do not use the cache, instead force a new parse.
	 * @see {@link FlowrAnalyzerCache#peekParse} - to get the parse output if already available without triggering a new parse.
	 */
	public async parse(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['parse']>> {
		const d = this.get();
		return this.runTapeUntil(force, () => d.parse);
	}

	/**
	 * Get the parse output for the request if already available, otherwise return `undefined`.
	 * This will not trigger a new parse.
	 * @see {@link FlowrAnalyzerCache#parse} - to get the parse output, parsing if necessary.
	 */
	public peekParse(): NonNullable<AnalyzerCacheType<Parser>['parse']> | undefined {
		return this.get().parse;
	}

	/**
	 * Get the normalized abstract syntax tree for the request, normalizing if necessary.
	 * @param force - Do not use the cache, instead force new analyses.
	 * @see {@link FlowrAnalyzerCache#peekNormalize} - to get the normalized AST if already available without triggering a new normalization.
	 */
	public async normalize(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['normalize']>> {
		const d = this.get();
		return this.runTapeUntil(force, () => d.normalize);
	}

	/**
	 * Get the normalized abstract syntax tree for the request if already available, otherwise return `undefined`.
	 * This will not trigger a new normalization.
	 * @see {@link FlowrAnalyzerCache#normalize} - to get the normalized AST, normalizing if necessary.
	 */
	public peekNormalize(): NonNullable<AnalyzerCacheType<Parser>['normalize']> | undefined {
		return this.get().normalize;
	}

	/**
	 * Get the dataflow graph for the request, computing if necessary.
	 * @param force - Do not use the cache, instead force new analyses.
	 * @see {@link FlowrAnalyzerCache#peekDataflow} - to get the dataflow graph if already available without triggering a new computation.
	 */
	public async dataflow(force?: boolean): Promise<NonNullable<AnalyzerCacheType<Parser>['dataflow']>> {
		const d = this.get();
		return this.runTapeUntil(force, () => d.dataflow);
	}

	/**
	 * Get the dataflow graph for the request if already available, otherwise return `undefined`.
	 * This will not trigger a new computation.
	 * @see {@link FlowrAnalyzerCache#dataflow} - to get the dataflow graph, computing if necessary.
	 */
	public peekDataflow(): NonNullable<AnalyzerCacheType<Parser>['dataflow']> | undefined {
		return this.get().dataflow;
	}

	/**
	 * Get the control flow graph (CFG) for the request, computing if necessary.
	 * @param force           - Do not use the cache, instead force new analyses.
	 * @param kind            - The kind of CFG that is requested.
	 * @param simplifications - Simplification passes to be applied to the CFG.
	 */
	public async controlflow(force: boolean | undefined, kind: CfgKind, simplifications?: readonly CfgSimplificationPassName[]): Promise<ControlFlowInformation> {
		const cfgInfo = {
			ctx:      this.args.context,
			cfgQuick: this.peekDataflow()?.cfgQuick,
			ast:      async() => await this.normalize(),
			dfg:      async() => await this.dataflow()
		};
		return this.controlFlowCache.get(force, kind, cfgInfo, simplifications);
	}

	/**
	 * Get the control flow graph (CFG) for the request if already available, otherwise return `undefined`.
	 * @param kind            - The kind of CFG that is requested.
	 * @param simplifications - Simplification passes to be applied to the CFG.
	 * @see {@link FlowrAnalyzerCache#controlflow} - to get the control flow graph, computing if necessary.
	 */
	public peekControlflow(kind: CfgKind, simplifications: readonly CfgSimplificationPassName[] | undefined): ControlFlowInformation | undefined {
		return this.controlFlowCache.peek(kind, simplifications);
	}

	/**
	 * Get the call graph for the request, computing if necessary.
	 * @param force - Do not use the cache, instead force new analyses.
	 */
	public async callGraph(force?: boolean): Promise<CallGraph> {
		if(!this.callGraphCache || force) {
			this.callGraphCache = computeCallGraph((await this.dataflow(force)).graph);
		}
		return this.callGraphCache;
	}

	/**
	 * Get the call graph for the request if already available, otherwise return `undefined`.
	 */
	public peekCallGraph(): CallGraph | undefined {
		return this.callGraphCache;
	}
}
