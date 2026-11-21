import type { NormalizedAst, ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { DataflowInformation } from '../../../dataflow/info';
import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import type { ExpressionListCheckpoints, ExpressionListState } from '../../../dataflow/internal/process/functions/call/built-in/built-in-expression-list';
import { standaloneSourceFile } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { Environment, REnvironment } from '../../../dataflow/environments/environment';
import { Frame, LazyBindings } from '../../../dataflow/environments/frame-memory';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RProjectFile } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { deepCloneSharing } from '../../../util/objects';
import { activeDataflowBudget } from '../../../gas';
import type { FlowrConfig } from '../../../config';
import {
	type AnalyzedFile,
	type IncrementalUpdateResult,
	IncrementalUpdateType
} from '../../plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-update-type-plugin';

/** The dataflow information before {@link finalizeDataflow} ran over it, together with the processor information that produced it. */
export interface IncrementalDataflowResult {
	readonly df:     DataflowInformation;
	readonly dfData: DataflowProcessorInformation<ParentInformation>;
}

export type DataflowProcessorInformationBase<OtherInfo> = Omit<DataflowProcessorInformation<OtherInfo>, 'environment' | 'referenceChain' | 'cds'>;

/** What the built-in environment, which every analysis of a context shares, notes about the program analyzed. */
interface ProgramMarks {
	readonly forcing:          true | undefined;
	readonly locking:          true | undefined;
	readonly methods:          true | undefined;
	readonly unknownMethodsAt: NodeId[] | undefined;
}

/** What an analysis holds besides the dataflow information up to a checkpoint, and has to be restored to continue from it. */
interface AnalysisState {
	readonly statementOrder: Map<NodeId, [start: number, end: number]> | undefined;
	readonly unreachable:    Set<NodeId> | undefined;
	readonly marks:          ProgramMarks;
	/** the nodes the analysis added to the id map, e.g., those of sourced files */
	readonly addedNodes:     readonly (readonly [NodeId, RNodeWithParent])[];
	/** the files the analysis added to the AST, i.e., the sourced ones */
	readonly addedFiles:     readonly RProjectFile<ParentInformation>[];
	/** the files the analysis read, with the content it read, as a change to one of them invalidates the checkpoint */
	readonly considered:     readonly (readonly [path: string, content: string | undefined])[];
	/**
	 * The configuration the analysis ran with up to here, if it stayed the same, as what the analysis learns about the project
	 * (e.g., the files a source call reads) may change the {@link ProjectKind} and with it the configuration.
	 */
	readonly config:         FlowrConfig | undefined;
}

interface ListCheckpoint extends AnalysisState {
	readonly list: ExpressionListState;
}

interface FinalCheckpoint extends AnalysisState {
	readonly df: DataflowInformation;
}

/**
 * What an analysis keeps for the next one: the files it analyzed, and the states it can be continued from.
 * The states are copies, so their size is bounded by {@link FlowrConfig.incremental.dataflow.checkpoints}.
 */
export interface DataflowSnapshot {
	readonly files:       readonly AnalyzedFile[];
	/** the states of the list of a single analyzed file after some of its top-level statements, ascending by count */
	readonly checkpoints: readonly ListCheckpoint[];
	/** the complete dataflow information of an analysis of multiple files */
	readonly final?:      FinalCheckpoint;
}

function marksOf(environment: Environment): ProgramMarks {
	const builtIn = REnvironment.findBuiltIn(environment);
	return { forcing: builtIn.forcing, locking: builtIn.locking, methods: builtIn.methods, unknownMethodsAt: builtIn.unknownMethodsAt?.slice() };
}

function restoreMarks(environment: Environment, marks: ProgramMarks): void {
	const builtIn = REnvironment.findBuiltIn(environment);
	builtIn.forcing = marks.forcing;
	builtIn.locking = marks.locking;
	builtIn.methods = marks.methods;
	builtIn.unknownMethodsAt = marks.unknownMethodsAt?.slice();
}

function contentOf(ctx: FlowrAnalyzerContext, path: string): string | undefined {
	try {
		const content = ctx.files.resolveFile(path)?.content();
		return typeof content === 'string' ? content : undefined;
	} catch{
		return undefined;
	}
}

/**
 * One dataflow analysis that may reuse what the analysis before it kept, and keeps what the next one may reuse.
 * Created by {@link IncrementalDataflow.begin}.
 */
class IncrementalDataflowSession implements ExpressionListCheckpoints {
	private readonly files:        readonly AnalyzedFile[];
	/** the nodes of the id map before the analysis */
	private readonly initialNodes: ReadonlySet<NodeId>;
	/** the nodes of the id map the analysis of the statements does not add itself, see {@link resume} */
	private listNodes:             ReadonlySet<NodeId>;
	private readonly initialFiles: number;
	private readonly initialRead:  number;
	private readonly config:       FlowrConfig;
	private readonly keep:         number;
	private readonly minimum:      number;
	private readonly recorded:     ListCheckpoint[] = [];
	private readonly update:       IncrementalUpdateResult | undefined;
	private resumeFrom:            ListCheckpoint | undefined;
	private reuseFinal:            FinalCheckpoint | undefined;
	/** the first file the reused analysis did not analyze */
	private reuseFrom = 0;
	/** the earlier checkpoints that hold for this analysis too */
	private carried:               readonly ListCheckpoint[] = [];
	private applied = false;

	constructor(private readonly ast: NormalizedAst, private readonly ctx: FlowrAnalyzerContext, previous: DataflowSnapshot | undefined) {
		this.files = ast.ast.files.map(f => ({ filePath: f.filePath, root: f.root }));
		this.initialNodes = new Set(ast.idMap.keys());
		this.listNodes = this.initialNodes;
		this.initialFiles = ast.ast.files.length;
		this.initialRead = ctx.files.consideredFilesList().length;
		this.config = ctx.config;
		this.keep = ctx.config.incremental.dataflow.checkpoints;
		this.minimum = ctx.config.incremental.dataflow.minStatements;
		this.update = previous === undefined ? undefined : ctx.inc.determineUpdateTypes(previous.files, ast, ctx);
		if(previous !== undefined && this.update !== undefined) {
			this.plan(previous, this.update);
		}
	}

	/** Whether the analysis up to the given state would run the same now: with the same configuration, and reading the same files. */
	private holds(state: AnalysisState): boolean {
		return state.config === this.config && state.considered.every(([path, content]) => contentOf(this.ctx, path) === content);
	}

	private plan(previous: DataflowSnapshot, update: IncrementalUpdateResult): void {
		const types = update.types;
		const only = types.length === 1 ? types[0] : undefined;
		const unchanged = types.every(t => t === IncrementalUpdateType.Nothing || t === IncrementalUpdateType.Comment) || only === IncrementalUpdateType.NewFileAtEnd;
		if(unchanged && previous.final !== undefined && this.holds(previous.final)) {
			this.reuseFinal = previous.final;
			this.reuseFrom = previous.files.length;
			return;
		}
		const changedAtEnd = only === IncrementalUpdateType.AddedAtEnd || only === IncrementalUpdateType.RemovedAtEnd || only === IncrementalUpdateType.ChangedAtEnd;
		const prefix = unchanged ? previous.files[0]?.root.children.length : changedAtEnd ? update.commonPrefix : undefined;
		if(prefix === undefined) {
			return;
		}
		const usable = previous.checkpoints.filter(c => c.list.count <= prefix && this.holds(c));
		this.resumeFrom = usable.at(-1);
		const total = this.ast.ast.files[0].root.children.length;
		this.carried = usable.filter(c => c !== this.resumeFrom && this.wants(c.list.count, total));
	}

	/** Reuses the complete dataflow information of the analysis before, if nothing it read changed. */
	public reuse<OtherInfo>(base: DataflowProcessorInformationBase<OtherInfo & ParentInformation>): IncrementalDataflowResult | undefined {
		const final = this.reuseFinal;
		if(final === undefined) {
			return undefined;
		}
		this.reuseFinal = undefined;
		const files = this.ast.ast.files;
		const dfData: DataflowProcessorInformation<ParentInformation> = {
			...base as unknown as DataflowProcessorInformationBase<ParentInformation>,
			environment:    final.df.environment,
			cds:            undefined,
			referenceChain: [files[0].filePath],
			statementOrder: new Map(),
			unreachable:    new Set()
		};
		this.restore(final, dfData);
		final.df.graph.setIdMap(this.ast.idMap);
		this.applied = true;
		let df = final.df;
		for(let i = this.reuseFrom; i < this.initialFiles; i++) {
			df = standaloneSourceFile(i, files[i], dfData, df);
		}
		return { df, dfData };
	}

	public resume<OtherInfo>(fileIndex: number, info: DataflowProcessorInformation<OtherInfo & ParentInformation>): ExpressionListState | undefined {
		const data = info as unknown as DataflowProcessorInformation<ParentInformation>;
		if(fileIndex !== 0) {
			return undefined;
		}
		/* the list wraps its statements as arguments before it starts, which every analysis does anew, so these do not count as added by a statement */
		this.listNodes = new Set(data.completeAst.idMap.keys());
		const from = this.resumeFrom;
		if(from === undefined) {
			return undefined;
		}
		this.resumeFrom = undefined;
		this.restore(from, data);
		from.list.graph.setIdMap(data.completeAst.idMap);
		this.applied = true;
		const total = data.completeAst.ast.files[0].root.children.length;
		if(this.wants(from.list.count, total)) {
			this.record(fileIndex, from.list, data);
		}
		return from.list;
	}

	public wants(count: number, total: number): boolean {
		return this.initialFiles === 1 && total >= this.minimum && count > total - this.keep;
	}

	public record<OtherInfo>(fileIndex: number, list: ExpressionListState, info: DataflowProcessorInformation<OtherInfo & ParentInformation>): void {
		const data = info as unknown as DataflowProcessorInformation<ParentInformation>;
		if(fileIndex !== 0) {
			return;
		}
		this.recorded.push(this.copy({ ...this.stateOf(data, list.environment.current, this.listNodes), list }, data));
	}

	private stateOf(data: DataflowProcessorInformation<ParentInformation>, environment: Environment, before: ReadonlySet<NodeId>): AnalysisState {
		const idMap = data.completeAst.idMap;
		const addedNodes: (readonly [NodeId, RNodeWithParent])[] = [];
		if(idMap.size > before.size) {
			for(const [id, node] of idMap) {
				if(!before.has(id)) {
					addedNodes.push([id, node]);
				}
			}
		}
		return {
			statementOrder: data.statementOrder,
			unreachable:    data.unreachable,
			marks:          marksOf(environment),
			addedNodes,
			addedFiles:     data.completeAst.ast.files.slice(this.initialFiles),
			considered:     this.ctx.files.consideredFilesList().slice(this.initialRead).map(p => [p, contentOf(this.ctx, p)] as const),
			config:         this.ctx.config === this.config ? this.config : undefined
		};
	}

	/** A copy that shares what the analysis never changes in place: the AST, the built-in environment, and frozen frames. */
	private copy<T extends AnalysisState>(state: T, data: DataflowProcessorInformation<ParentInformation>): T {
		const idMap = data.completeAst.idMap;
		/* the sourced files are known by identity, a file sourced again is analyzed again */
		const files = new Set<object>(data.completeAst.ast.files);
		return deepCloneSharing(state, o =>
			o === idMap
			|| files.has(o)
			|| o === this.config
			|| o instanceof LazyBindings
			|| (o instanceof Frame && o.isFrozen)
			|| (o instanceof Environment && o.builtInEnv === true)
			|| ('info' in o && typeof o.info === 'object' && o.info !== null && 'id' in o.info && idMap.get(o.info.id as NodeId) === o)
		);
	}

	private restore(state: AnalysisState, data: DataflowProcessorInformation<ParentInformation>): void {
		if(state.statementOrder !== undefined) {
			for(const [id, span] of state.statementOrder) {
				data.statementOrder?.set(id, span);
			}
		}
		if(state.unreachable !== undefined) {
			for(const id of state.unreachable) {
				data.unreachable?.add(id);
			}
		}
		restoreMarks(data.environment.current, state.marks);
		for(const [id, node] of state.addedNodes) {
			data.completeAst.idMap.set(id, node);
		}
		const files = data.completeAst.ast.files;
		for(const file of state.addedFiles) {
			if(!files.some(f => f.filePath === file.filePath)) {
				files.push(file);
			}
		}
		for(const [path] of state.considered) {
			this.ctx.files.addConsideredFile(path);
		}
	}

	/** Keeps what the next analysis may continue from, unless the analysis was cut short. */
	public end(result: IncrementalDataflowResult): void {
		if(this.update !== undefined) {
			this.ctx.inc.storeAppliedIncrementalUpdate({ ...this.update, applied: this.applied });
		}
		if(activeDataflowBudget?.exhausted !== undefined) {
			return;
		}
		const checkpoints = [...this.carried, ...this.recorded].sort((a, b) => a.list.count - b.list.count);
		const final = this.initialFiles > 1 ? this.copy({ ...this.stateOf(result.dfData, result.df.environment.current, this.initialNodes), df: result.df }, result.dfData) : undefined;
		this.ctx.inc.storeDataflowSnapshot({ files: this.files, checkpoints, final });
	}
}

/**
 * Helper functions of the incremental dataflow analysis, which continues the analysis before it where the files did not change.
 * The dataflow analysis {@link IncrementalDataflow.begin|begins} a session, which may {@link IncrementalDataflowSession#reuse|reuse} a complete earlier analysis,
 * or hands itself to the processors as their {@link DataflowProcessorInformation#checkpoints|checkpoints} to resume the top-level statements of a file after
 * those that did not change.
 * Either way, it {@link IncrementalDataflowSession#end|ends} before the dataflow is finalized, keeping copies of what the next analysis may continue from.
 */
export const IncrementalDataflow = {
	name: 'IncrementalDataflow',
	/** Whether the analysis of the given context is incremental, see {@link FlowrConfig.incremental.dataflow}. */
	enabled(this: void, ctx: FlowrAnalyzerContext): boolean {
		return ctx.config.incremental.dataflow.activated;
	},
	/** Begins an incremental dataflow analysis of `ast`, before the analysis adds the files it sources; `undefined` if not {@link IncrementalDataflow.enabled|enabled}. */
	begin(this: void, ast: NormalizedAst, ctx: FlowrAnalyzerContext): IncrementalDataflowSession | undefined {
		return IncrementalDataflow.enabled(ctx) ? new IncrementalDataflowSession(ast, ctx, ctx.inc.takeDataflowSnapshot()) : undefined;
	}
} as const;

export type { IncrementalDataflowSession };
