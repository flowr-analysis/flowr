import type { AstIdMap, NormalizedAst, ParentInformation, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { DataflowCfgInformation, DataflowInformation } from '../../../dataflow/info';
import type { DataflowProcessorInformation } from '../../../dataflow/processor';
import type { ExpressionListCheckpoints, ExpressionListState } from '../../../dataflow/internal/process/functions/call/built-in/built-in-expression-list';
import { standaloneSourceFile } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { Environment, REnvironment } from '../../../dataflow/environments/environment';
import { Frame, LazyBindings } from '../../../dataflow/environments/frame-memory';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { RProjectFile } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { DataflowGraph } from '../../../dataflow/graph/graph';
import type { DFControlFlowEdge, DfEdge } from '../../../dataflow/graph/edge';
import { type ClonedFields, deepCloneSharing } from '../../../util/objects';
import { activeDataflowBudget } from '../../../gas';
import type { IncrementalDataflowPlan } from '../../plugins/incremental/incremental-dataflow/flowr-analyzer-incremental-dataflow-heuristic-plugin';
import type { FlowrConfig } from '../../../config';
import {
	type AnalyzedFile,
	type IncrementalUpdateResult,
	IncrementalUpdate,
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

/** What an analysis added to the AST and the context and read, which an analysis continuing it adds again, if it still holds. */
interface AnalysisAdditions {
	/** the nodes the analysis added to the id map, e.g., those of sourced files, not those later consumers added */
	readonly addedNodes: readonly (readonly [NodeId, RNodeWithParent])[];
	/** the files the analysis added to the AST, i.e., the sourced ones */
	readonly addedFiles: readonly RProjectFile<ParentInformation>[];
	/** the files the analysis read, with the content it read, as a change to one of them invalidates what it computed */
	readonly considered: readonly (readonly [path: string, content: string | undefined])[];
	/**
	 * The configuration the analysis ran with, if it stayed the same, as what the analysis learns about the project
	 * (e.g., the files a source call reads) may change the {@link ProjectKind} and with it the configuration.
	 */
	readonly config:     FlowrConfig | undefined;
}

/** What an analysis holds besides the dataflow information up to a checkpoint, and has to be restored to continue from it. */
interface AnalysisState extends AnalysisAdditions {
	readonly statementOrder: Map<NodeId, [start: number, end: number]> | undefined;
	readonly unreachable:    Set<NodeId> | undefined;
	readonly marks:          ProgramMarks;
}

/** Whether `o` is the node `idMap` holds for its id, which a copy shares as the AST does not change. */
function isNodeOf(o: object, idMap: AstIdMap): boolean {
	return 'info' in o && typeof o.info === 'object' && o.info !== null && 'id' in o.info && idMap.get(o.info.id as NodeId) === o;
}

/**
 * The edges are most of what a copy of a graph holds, and nearly all of them only carry their types, so these are copied as they are.
 * A control edge shares its dependency with the vertices behind it, so it goes through the clone; the edges without side effects on calls are derived from the edges, so they start out empty.
 */
const GraphCopiers: NonNullable<ClonedFields['replace']> = new Map<PropertyKey, (value: unknown, clone: (v: unknown) => unknown) => unknown>([
	['edgeInformation', (value, clone) => {
		const copy = new Map<NodeId, Map<NodeId, DfEdge>>();
		for(const [from, targets] of value as Map<NodeId, Map<NodeId, DfEdge>>) {
			const copied = new Map<NodeId, DfEdge>();
			for(const [to, edge] of targets) {
				copied.set(to, (edge as Partial<DFControlFlowEdge>).cd === undefined ? { types: edge.types } : clone(edge) as DfEdge);
			}
			copy.set(from, copied);
		}
		return copy;
	}],
	['beyondSideEffects', () => new Map()]
]);

/** what a graph, an environment, and a frame derive from what they hold on demand is left out, so a copy rebuilds it when it needs it */
const GraphFields: ClonedFields = { drop: new Set(['incomingIndex', 'qualifiedNames', 'targetWalks', 'derived']), replace: GraphCopiers };
const EnvironmentFields: ClonedFields = { drop: new Set(['cache', 'tailCache']) };
const FrameFields: ClonedFields = { drop: new Set(['flat', 'flatKeys']) };

function clonedFieldsOf(owner: object): ClonedFields | undefined {
	return owner instanceof DataflowGraph ? GraphFields : owner instanceof Environment ? EnvironmentFields : owner instanceof Frame ? FrameFields : undefined;
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
	/** what the analysis handed out, after the passes that finalize the graph */
	readonly finalized?:  FinalizedDataflow;
}

/** A finalized analysis, which an analysis of the same program hands out again as it is, just as a cache hit would. */
interface FinalizedDataflow extends AnalysisAdditions {
	readonly df: DataflowInformation;
}

/** The nodes `idMap` gained since it held `before` of them: it only grows during an analysis, and keeps the nodes in the order they were added. */
function nodesAddedSince(idMap: AstIdMap, before: number): (readonly [NodeId, RNodeWithParent])[] {
	return idMap.size > before ? [...idMap.entries().drop(before)] : [];
}

function cfgOf(info: DataflowCfgInformation | undefined): DataflowCfgInformation | undefined {
	return info === undefined ? undefined : { entryPoint: info.entryPoint, cfgEntry: info.cfgEntry, cfgExit: info.cfgExit, exitPoints: info.exitPoints, hooks: info.hooks };
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
	/** how many nodes the id map held before the analysis, which only adds to it */
	private readonly initialNodes: number;
	/** how many nodes of the id map the analysis of the statements does not add itself, see {@link resume} */
	private listNodes:             number;
	private readonly initialFiles: number;
	private readonly initialRead:  number;
	private readonly config:       FlowrConfig;
	private readonly keep:         number;
	/** the number of statements the checkpoints end at, see {@link IncrementalDataflowPlan#after} */
	private readonly after:        number;
	/** whether the analysis resumes from checkpoints, see `incremental.dataflow.activated` */
	private readonly resumes:      boolean;
	/** whether the analysis hands out the one before again for unchanged files, see `incremental.dataflow.reuse` */
	private readonly reuses:       boolean;
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
	private readonly previous:     DataflowSnapshot | undefined;
	private stored:                DataflowSnapshot | undefined;

	constructor(private readonly ast: NormalizedAst, private readonly ctx: FlowrAnalyzerContext, previous: DataflowSnapshot | undefined, update: IncrementalUpdateResult | undefined, plan: IncrementalDataflowPlan) {
		this.files = ast.ast.files.map(f => ({ filePath: f.filePath, root: f.root }));
		this.initialNodes = ast.idMap.size;
		this.listNodes = this.initialNodes;
		this.initialFiles = ast.ast.files.length;
		this.initialRead = ctx.files.consideredFilesList().length;
		this.config = ctx.config;
		this.keep = plan.checkpoints;
		this.after = plan.after ?? Infinity;
		this.resumes = plan.checkpoints > 0;
		this.reuses = plan.reuse;
		this.minimum = plan.minStatements;
		this.previous = previous;
		this.update = update;
		if(previous !== undefined && update !== undefined) {
			this.plan(previous, update);
		}
	}

	/** The configuration of this analysis if it stayed the same so far, see {@link AnalysisAdditions#config}. */
	private stableConfig(): FlowrConfig | undefined {
		return this.ctx.config === this.config ? this.config : undefined;
	}

	/** Whether the analysis up to the given state would run the same now: with the same configuration, and reading the same files. */
	private holds(state: AnalysisAdditions): boolean {
		return state.config === this.config && this.unchangedReads(state.considered);
	}

	private unchangedReads(considered: AnalysisAdditions['considered']): boolean {
		return considered.every(([path, content]) => contentOf(this.ctx, path) === content);
	}

	private plan(previous: DataflowSnapshot, update: IncrementalUpdateResult): void {
		const unchanged = IncrementalUpdate.unchanged(update) || IncrementalUpdate.is(update, IncrementalUpdateType.NewFileAtEnd);
		if(unchanged && previous.final !== undefined && this.holds(previous.final)) {
			this.reuseFinal = previous.final;
			this.reuseFrom = previous.files.length;
			return;
		}
		const prefix = unchanged ? previous.files[0]?.root.children.length : update.commonPrefix;
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
		this.listNodes = data.completeAst.idMap.size;
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
		const last = Math.min(this.after, total);
		return this.resumes && this.initialFiles === 1 && total >= this.minimum && count > last - this.keep && count <= last;
	}

	public record<OtherInfo>(fileIndex: number, list: ExpressionListState, info: DataflowProcessorInformation<OtherInfo & ParentInformation>): void {
		const data = info as unknown as DataflowProcessorInformation<ParentInformation>;
		if(fileIndex !== 0) {
			return;
		}
		/* resuming the list only needs where the statements before passed on the control flow, not all they computed */
		const cfg = { ...list, processed: list.processed.map(cfgOf), defaultReturn: cfgOf(list.defaultReturn) };
		this.recorded.push(this.stateOf({ list: cfg }, data, list.environment.current, this.listNodes));
	}

	/** The state to continue the analysis from: a copy of `changing` and of whatever else the analysis goes on to change, with what it added so far. */
	private stateOf<T extends object>(changing: T, data: DataflowProcessorInformation<ParentInformation>, environment: Environment, before: number): T & AnalysisState {
		return {
			...this.copy({ ...changing, statementOrder: data.statementOrder, unreachable: data.unreachable }, data),
			marks:      marksOf(environment),
			addedNodes: nodesAddedSince(data.completeAst.idMap, before),
			addedFiles: data.completeAst.ast.files.slice(this.initialFiles),
			considered: this.ctx.files.consideredFilesList().slice(this.initialRead).map(p => [p, contentOf(this.ctx, p)] as const),
			config:     this.stableConfig()
		};
	}

	/** A copy that shares what the analysis never changes in place: the AST, the built-in environment, and frozen frames. */
	private copy<T extends object>(state: T, data: DataflowProcessorInformation<ParentInformation>): T {
		const idMap = data.completeAst.idMap;
		/* the sourced files are known by identity, a file sourced again is analyzed again */
		const files = new Set<object>(data.completeAst.ast.files);
		/* a live frame is handed to the copy and forks on its owner's next write, so it costs nothing to copy */
		const shared = new Set<object>();
		return deepCloneSharing(state, o => {
			/* most of what a copy meets are plain records (edges, vertices, references), so these are asked first */
			if(Object.getPrototypeOf(o) === Object.prototype) {
				return o === this.config || files.has(o) || isNodeOf(o, idMap);
			} else if(o instanceof Environment) {
				if(o.builtInEnv === true) {
					return true;
				}
				shared.add(o.shareMemory());
				return false;
			}
			return o === idMap || o instanceof LazyBindings || (o instanceof Frame && (o.isFrozen || shared.has(o)));
		}, clonedFieldsOf);
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
		this.addAgain(state, data.completeAst);
	}

	/** Adds what the analysis before added to the AST and the context again, which a continued analysis does not do itself. */
	private addAgain(added: AnalysisAdditions, ast: NormalizedAst): void {
		for(const [id, node] of added.addedNodes) {
			/* an id added for a node of the AST names the node this AST holds for it */
			ast.idMap.set(id, ast.idMap.get(node.info.id) ?? node);
		}
		const files = ast.ast.files;
		for(const file of added.addedFiles) {
			if(!files.some(f => f.filePath === file.filePath)) {
				files.push(file);
			}
		}
		for(const [path] of added.considered) {
			this.ctx.files.addConsideredFile(path);
		}
	}

	/** Hands out the finalized analysis before again if the program did not change, which skips the analysis altogether. */
	public reuseFinalized(): DataflowInformation | undefined {
		const finalized = this.previous?.finalized;
		if(!this.reuses || this.update === undefined || !IncrementalUpdate.unchanged(this.update) || finalized === undefined || !this.holds(finalized)) {
			return undefined;
		}
		this.addAgain(finalized, this.ast);
		finalized.df.graph.setIdMap(this.ast.idMap);
		this.ctx.inc.storeAppliedIncrementalUpdate({ ...this.update, applied: true });
		this.ctx.inc.storeDataflowSnapshot({ ...this.previous as DataflowSnapshot, files: this.files, finalized });
		return finalized.df;
	}

	/** Keeps the finalized `df` for {@link reuseFinalized}, and hands it back. */
	public finalized(df: DataflowInformation): DataflowInformation {
		if(this.reuses && this.stored !== undefined) {
			const requested = new Set(this.files.map(f => f.filePath));
			this.ctx.inc.storeDataflowSnapshot({ ...this.stored, finalized: {
				df,
				addedNodes: nodesAddedSince(this.ast.idMap, this.initialNodes),
				addedFiles: this.ast.ast.files.slice(this.initialFiles),
				considered: this.ctx.files.consideredFilesList().slice(this.initialRead).filter(p => !requested.has(p)).map(p => [p, contentOf(this.ctx, p)] as const),
				config:     this.stableConfig()
			} });
		}
		return df;
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
		const final = this.resumes && this.initialFiles > 1 ? this.stateOf({ df: result.df }, result.dfData, result.df.environment.current, this.initialNodes) : undefined;
		this.stored = { files: this.files, checkpoints, final };
		this.ctx.inc.storeDataflowSnapshot(this.stored);
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
	/**
	 * Begins an incremental dataflow analysis of `ast`, before the analysis adds the files it sources, as the {@link FlowrAnalyzerIncrementalDataflowHeuristicPlugin} plans it
	 * for how the files changed; `undefined` if it plans neither to reuse nor to resume, and no analysis before kept its files to compare with.
	 */
	begin(this: void, ast: NormalizedAst, ctx: FlowrAnalyzerContext): IncrementalDataflowSession | undefined {
		const previous = ctx.inc.takeDataflowSnapshot();
		const update = previous === undefined ? undefined : ctx.inc.determineUpdateTypes(previous.files, ast, ctx);
		const plan = ctx.inc.planDataflow(ctx, update);
		return plan.reuse || plan.checkpoints > 0 || update !== undefined ? new IncrementalDataflowSession(ast, ctx, previous, update, plan) : undefined;
	}
} as const;

export type { IncrementalDataflowSession };
