import { guard } from '../../util/assert';
import type { DFControlFlowEdge } from './edge';
import { DfEdge, EdgeType } from './edge';
import type { DataflowInformation } from '../info';
import {
	type DataflowGraphVertexArgument,
	type DataflowGraphVertexFunctionCall,
	type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexInfo,
	type DataflowGraphVertexVariableDefinition,
	type DataflowGraphVertices, VertexType
} from './vertex';
import { uniqueArrayMerge } from '../../util/collections/arrays';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { BrandedIdentifier, Identifier, IdentifierDefinition, IdentifierReference } from '../environments/identifier';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { RLoopConstructs } from '../../r-bridge/lang-4.x/ast/model/model';
import { Environment, type EnvType, type REnvironmentInformation } from '../environments/environment';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { cloneEnvironmentInformation } from '../environments/clone';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import type { Writable } from 'ts-essentials';
import type { BuiltInMemory } from '../environments/built-in';
import { FunctionDefinitionVertex, ValueVertex, UseVertex, VariableDefinitionVertex } from './vertex';
import { activeDataflowBudget } from '../../gas';

/**
 * Describes the information we store per function body.
 * The {@link DataflowInformation#exitPoints} this type omits are stored within the enclosing {@link DataflowGraphVertexFunctionDefinition} vertex.
 */
export type DataflowFunctionFlowInformation = Omit<DataflowInformation, 'graph' | 'exitPoints'>  & { graph: Set<NodeId> };

/** A reference with a name, e.g. `a` and `b` in `foo(a = 3, b = 2)`, see {@link PositionalFunctionArgument}. */
export interface NamedFunctionArgument extends IdentifierReference {
	readonly name:    string
	readonly valueId: NodeId | undefined
}

/** A reference without a name, e.g. the references to `3` and `2` in `foo(3, 2)`, see {@link NamedFunctionArgument}. */
export interface PositionalFunctionArgument extends Omit<IdentifierReference, 'name'> {
	readonly name?: undefined
}

/**
 * Summarizes either named (`foo(a = 3, b = 2)`), unnamed (`foo(3, 2)`), or empty (`foo(,)`) arguments within a function.
 * See the {@link FunctionArgument} helper functions to check for the specific types.
 */
export type FunctionArgument = NamedFunctionArgument | PositionalFunctionArgument | typeof EmptyArgument;

/** Helper functions to work with {@link FunctionArgument}s. {@link EmptyArgument} marks an empty argument. */
export const FunctionArgument = {
	name: 'FunctionArgument',
	/** Whether `arg` is positional, e.g. the `2` in `foo(b=3, 2)`. */
	isPositional(this: void, arg: FunctionArgument): arg is PositionalFunctionArgument {
		return arg !== EmptyArgument && arg.name === undefined;
	},
	/** Whether `arg` is named, e.g. the `b=3` in `foo(b=3, 2)`. */
	isNamed(this: void, arg: FunctionArgument): arg is NamedFunctionArgument {
		return arg !== EmptyArgument && arg.name !== undefined;
	},
	/** Whether `arg` is unnamed, i.e. positional or empty, e.g. both arguments of `foo(, 2)` and `foo(3, 2)`. */
	isUnnamed(this: void, arg: FunctionArgument): arg is PositionalFunctionArgument | typeof EmptyArgument {
		return arg === EmptyArgument || arg.name === undefined;
	},
	/** Whether `arg` is the {@link EmptyArgument} marker, e.g. the first argument of `foo(, 2)`. */
	isEmpty(this: void, arg: unknown): arg is typeof EmptyArgument {
		return arg === EmptyArgument;
	},
	/** @see {@link FunctionArgument.isEmpty} */
	isNotEmpty<T>(this: void, arg: T): arg is Exclude<T, typeof EmptyArgument> {
		return arg !== EmptyArgument;
	},
	/** The node id of a non-empty `arg`, e.g. of either `a` or `2` in `foo(a=3, 2)`. */
	getId(this: void, arg: FunctionArgument): NodeId | undefined {
		if(arg !== EmptyArgument) {
			return arg?.nodeId;
		}
		return undefined;
	},
	/** The name of `arg` if named, `undefined` otherwise. */
	getName(this: void, arg: FunctionArgument): string | undefined {
		return FunctionArgument.isNamed(arg) ? arg.name : undefined;
	},
	/** The value node id of a non-empty `arg`: its own id if positional, or its value's id (skipping the name) if named. */
	getReference(this: void, arg: FunctionArgument): NodeId | undefined {
		if(arg === EmptyArgument) {
			return undefined;
		} else if(arg.name === undefined) {
			return arg.nodeId;
		}
		return arg.valueId;
	},
	/** Whether `arg` is named exactly `name` (textual match only, not R's argument-matching; see {@link pMatch} for that). */
	hasName(this: void, arg: FunctionArgument, name: string | undefined): arg is NamedFunctionArgument {
		return FunctionArgument.isNamed(arg) && arg.name === name;
	}
} as const;

/**
 * Maps the edges target to the edge information
 */
export type OutgoingEdges<Edge extends DfEdge = DfEdge> = Map<NodeId, Edge>;
/**
 * Similar to {@link OutgoingEdges}, but inverted regarding the edge direction.
 * In other words, it maps the source to the edge information.
 */
export type IngoingEdges<Edge extends DfEdge = DfEdge> = Map<NodeId, Edge>;
/**
 * {@link IngoingEdges} as handed out by {@link DataflowGraph#ingoingEdges|ingoingEdges()}: a vertex without any
 * shares the single {@link NoEdges}, so what a caller gets back is not theirs to write into.
 */
export type ReadonlyIngoingEdges<Edge extends DfEdge = DfEdge> = ReadonlyMap<NodeId, Edge>;

/**
 * The shared answer for a vertex without edges. Use it instead of a fresh `[]` fallback, the lookups sit in
 * traversal loops where a miss is the common case.
 * @example
 * ```ts
 * for(const [target, edge] of graph.outgoingEdges(id) ?? NoEdges) { /* ... *\/ }
 * ```
 */
export const NoEdges: ReadonlyMap<NodeId, never> = new Map<NodeId, never>();

/**
 * Resolves the `pkg::fn` name of the call `id`, without and with the base-R qualification.
 * Passed to {@link DataflowGraph#qualify}, which caches what it returns.
 */
export type CallQualifier =
	(graph: DataflowGraph, id: NodeId, vertex: DataflowGraphVertexInfo | undefined) => readonly [bare: Identifier | undefined, baseR: Identifier | undefined];

/** the cached `pkg::fn` names, `complete` once every call vertex is in there */
interface QualificationCache {
	readonly bare:  Map<NodeId, Identifier | undefined>,
	readonly baseR: Map<NodeId, Identifier | undefined>,
	complete:       boolean
}

/** The structure of the serialized {@link DataflowGraph}. */
export interface DataflowGraphJson {
	readonly rootVertices:        NodeId[],
	readonly vertexInformation:   [NodeId, DataflowGraphVertexInfo][],
	readonly edgeInformation:     [NodeId, [NodeId, DfEdge][]][]
	readonly _unknownSideEffects: UnknownSideEffect[]
}

/**
 * An unknown side effect describes something that we cannot handle correctly (in all cases).
 * For example, `load` will be marked as an unknown side effect as we have no idea of how it will affect the program.
 * Linked side effects are used whenever we know that a call may be affected by another one in a way that we cannot
 * grasp from the dataflow perspective (e.g., an indirect dependency based on the currently active graphic device).
 */
export type UnknownSideEffect = NodeId | LinkedUnknownSideEffect;

/** A {@link UnknownSideEffect} that carries a {@link LinkTo} target. */
export interface LinkedUnknownSideEffect {
	readonly id:     NodeId,
	readonly linkTo: LinkTo<RegExp>
}

/**
 * Helpers for the {@link UnknownSideEffect} union, which is either a plain {@link NodeId} or a
 * `{ id, linkTo }` object. Use these instead of hand-rolling `typeof x === 'object' ? x.id : x`
 * checks so the object/non-object discrimination lives in one place.
 */
export const UnknownSideEffect = {
	name: 'UnknownSideEffect',
	/** Whether the effect carries a {@link LinkTo} target (i.e., is the object variant). */
	isLinked(this: void, effect: UnknownSideEffect): effect is LinkedUnknownSideEffect {
		return typeof effect === 'object';
	},
	/** The affected node id, regardless of whether the effect is plain or linked. */
	id(this: void, effect: UnknownSideEffect): NodeId {
		return typeof effect === 'object' ? effect.id : effect;
	},
	/** The {@link LinkTo} target of the effect, or `undefined` if it is a plain (unlinked) one. */
	linkTo(this: void, effect: UnknownSideEffect): LinkTo<RegExp> | undefined {
		return typeof effect === 'object' ? effect.linkTo : undefined;
	},
	/** Both {@link id} and {@link linkTo} in one pass (a single discrimination); use when you need both. */
	split(this: void, effect: UnknownSideEffect): { id: NodeId, linkTo: LinkTo<RegExp> | undefined } {
		return typeof effect === 'object' ? effect : { id: effect, linkTo: undefined };
	}
} as const;

/**
 * The dataflow graph holds the dataflow information found within the given AST: directed edges ({@link EdgeType}) are hoisted
 * into a flat adjacency list, while vertices ({@link DataflowGraphVertexArgument}) nest hierarchically (a function-definition
 * vertex contains its subgraph's node ids). After analysis every edge endpoint must be a vertex, though not yet during construction.
 * All methods return the modified graph to allow for chaining. The helper object associated with the DFG is {@link Dataflow}.
 */
export class DataflowGraph<
	Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo,
	Edge   extends DfEdge       = DfEdge
> {
	private _idMap: AstIdMap | undefined;

	/*
	 * Set of vertices which have sideEffects that we do not know anything about.
	 * As a (temporary) solution until we have FD edges, a side effect may also store known target links
	 * that have to be/should be resolved (as globals) as a separate pass before the df analysis ends.
	 */
	private readonly _unknownSideEffects = new Set<UnknownSideEffect>();

	constructor(idMap: AstIdMap | undefined) {
		this._idMap = idMap;
	}

	/** Contains the vertices of the root level graph (i.e., included those vertices from the complete graph, that are nested within function definitions) */
	protected rootVertices:    Set<NodeId> = new Set<NodeId>();
	/** All vertices in the complete graph (including those nested in function definition) */
	private vertexInformation: DataflowGraphVertices<Vertex> = new Map<NodeId, Vertex>();
	/** All edges in the complete graph (including those nested in function definition) */
	private edgeInformation:   Map<NodeId, OutgoingEdges<Edge>> = new Map<NodeId, OutgoingEdges<Edge>>();
	/* the reverse of `edgeInformation`, built on demand, then kept up to date by `addEdge` and dropped only on a
	 * bulk write (`mergeEdges`, `fromJson`): rebuilding it per lookup made every caller asking for the ingoing
	 * edges of many nodes scan the whole graph once per node */
	private incomingIndex?:    Map<NodeId, IngoingEdges<Edge>>;

	/* tag to the ids carrying it; a lookup re-checks the vertex, as another graph may retag an object they share */
	private readonly types: Map<Vertex['tag'], NodeId[]> = new Map<Vertex['tag'], NodeId[]>();

	/** The id list of `tag`, created on first use, so a caller adding many ids looks it up once. */
	private typeList(tag: Vertex['tag']): NodeId[] {
		let ids = this.types.get(tag);
		if(ids === undefined) {
			this.types.set(tag, ids = []);
		}
		return ids;
	}

	private indexType(tag: Vertex['tag'], id: NodeId): void {
		this.typeList(tag).push(id);
	}

	/** Every write above keeps an id listed under one tag at most once, so a lookup never hands the same one out twice. */
	private unindexType(tag: Vertex['tag'], id: NodeId): void {
		const ids = this.types.get(tag);
		if(ids === undefined) {
			return;
		}
		for(let idx = ids.lastIndexOf(id); idx >= 0; idx = ids.lastIndexOf(id)) {
			ids.splice(idx, 1);
		}
	}

	/* the qualified call names, built on demand and dropped on every change, as vertices and edges both decide them */
	private qualifiedNames?: QualificationCache;

	toJSON(): DataflowGraphJson {
		return {
			rootVertices:        Array.from(this.rootVertices),
			vertexInformation:   Array.from(this.vertexInformation),
			/* mapping inside `Array.from`, a trailing `.map()` would build the outer array twice */
			edgeInformation:     Array.from(this.edgeInformation, ([id, edges]) => [id, Array.from(edges)] as [NodeId, [NodeId, DfEdge][]]),
			_unknownSideEffects: Array.from(this._unknownSideEffects)
		};
	}

	/** Gets the {@link DataflowGraphVertexInfo} attached to `id` (searching function definitions too if `includeDefinedFunctions`) and its outgoing edges. */
	public get(id: NodeId, includeDefinedFunctions = true): [Vertex, OutgoingEdges] | undefined {
		// if we do not want to include function definitions, only retrieve the value if the id is part of the root vertices
		const vertex: Vertex | undefined = includeDefinedFunctions ? this.getVertex(id) : this.getRootVertex(id);
		return vertex === undefined ? undefined : [vertex, this.outgoingEdges(id) ?? new Map()];
	}

	/** Gets the {@link DataflowGraphVertexInfo} attached to `id`, see {@link DataflowGraph#getRootVertex}. */
	public getVertex(id: NodeId): Vertex | undefined {
		return this.vertexInformation.get(id);
	}

	/** Gets the {@link DataflowGraphVertexInfo} attached to `id`, but only if it is a root-level vertex, see {@link DataflowGraph#getVertex}. */
	public getRootVertex(id: NodeId): Vertex | undefined {
		if(!this.rootVertices.has(id)) {
			return undefined;
		}
		return this.vertexInformation.get(id);
	}

	public outgoingEdges(id: NodeId): OutgoingEdges | undefined {
		return this.edgeInformation.get(id);
	}

	public ingoingEdges(id: NodeId): ReadonlyIngoingEdges | undefined {
		if(this.incomingIndex === undefined) {
			const index = new Map<NodeId, IngoingEdges<Edge>>();
			for(const [source, outgoing] of this.edgeInformation.entries()) {
				for(const [target, edge] of outgoing) {
					const into = index.get(target);
					if(into === undefined) {
						index.set(target, new Map([[source, edge]]));
					} else {
						into.set(source, edge);
					}
				}
			}
			this.incomingIndex = index;
		}
		/* the historic contract is an (possibly empty) map for every id, never `undefined`; the miss is the common
		 * case in traversal loops, so it answers with the shared empty map rather than a fresh one */
		return this.incomingIndex.get(id) ?? NoEdges;
	}

	/**
	 * Whether `id` is quoted, i.e. affected by a {@link EdgeType.NonStandardEvaluation} edge that keeps it from being
	 * evaluated (a loop's own NSE-marked body still is evaluated, so that does not count). `withOutgoing` also checks whether `id` itself quotes something.
	 */
	public isQuoted(id: NodeId, withOutgoing = false): boolean {
		/* an nse edge quotes iff it does not originate from a loop marking its body */
		const quotes = (source: NodeId, e: DfEdge): boolean =>
			DfEdge.includesType(e, EdgeType.NonStandardEvaluation) && !RLoopConstructs.is(this.idMap?.get(source));
		if(this.ingoingEdges(id)?.entries().some(([source, e]) => quotes(source, e))) {
			return true;
		}
		return withOutgoing && (this.outgoingEdges(id)?.values().some(e => quotes(id, e)) ?? false);
	}

	/**
	 * The cached `pkg::fn` name of the call `id`, asking `resolve` only for a call the cache does not know yet.
	 * @useInstead {@link Dataflow.qualify} - which passes the resolution
	 */
	public qualify(id: NodeId, qualifyBaseR: boolean, resolve: CallQualifier): Identifier | undefined {
		const cache = this.qualifications();
		const wanted = qualifyBaseR ? cache.baseR : cache.bare;
		const hit = wanted.get(id);
		if(hit !== undefined || wanted.has(id)) {
			return hit;
		}
		this.resolveInto(cache, id, this.vertexInformation.get(id), resolve);
		return wanted.get(id);
	}

	/**
	 * The cached `pkg::fn` name of every call, resolving the calls that are still missing.
	 * @useInstead {@link Dataflow.qualifyAll} - which passes the resolution
	 */
	public qualifyAll(qualifyBaseR: boolean, resolve: CallQualifier): ReadonlyMap<NodeId, Identifier | undefined> {
		const cache = this.qualifications();
		const wanted = qualifyBaseR ? cache.baseR : cache.bare;
		if(cache.complete) {
			return wanted;
		}
		for(const id of this.types.get(VertexType.FunctionCall) ?? []) {
			if(!wanted.has(id)) {
				this.resolveInto(cache, id, this.vertexInformation.get(id), resolve);
			}
		}
		cache.complete = true;
		return wanted;
	}

	private qualifications(): QualificationCache {
		return this.qualifiedNames ??= { bare: new Map(), baseR: new Map(), complete: false };
	}

	/** one resolution fills both variants: what costs is resolving the call, not qualifying it */
	private resolveInto(cache: QualificationCache, id: NodeId, vertex: Vertex | undefined, resolve: CallQualifier): void {
		const [bare, baseR] = resolve(this, id, vertex);
		cache.bare.set(id, bare);
		cache.baseR.set(id, baseR);
	}

	/** set by a `consume` merge, see {@link DataflowGraph#mergeWith|mergeWith()}; the graph must not change after that */
	private consumed = false;

	/** Drops the cached qualifications, as the graph may no longer imply them. Every mutator runs through here, so the guard covers them all. */
	private dropQualifications(): void {
		guard(!this.consumed, 'this graph was consumed by a merge and must not be changed any more');
		if(this.qualifiedNames !== undefined) {
			this.qualifiedNames = undefined;
		}
	}

	/** For a node of the normalized AST: `nodeId` if it is a DFG vertex itself, else the DFG vertices linked to it, else `undefined`. */
	public getLinked(nodeId: NodeId): NodeId[] | undefined {
		if(this.vertexInformation.has(nodeId)) {
			return [nodeId];
		}
		const linked: NodeId[] = [];
		for(const [id, vtx] of this.vertexInformation) {
			if(vtx.link?.origin.includes(nodeId)) {
				linked.push(id);
			}
		}
		return linked.length > 0 ? linked : undefined;
	}

	/** Retrieves the id-map to the normalized AST attached to the dataflow graph */
	public get idMap(): AstIdMap | undefined {
		return this._idMap;
	}

	/** Retrieves the set of vertices which have side effects that we do not know anything about. */
	public get unknownSideEffects(): Set<UnknownSideEffect> {
		return this._unknownSideEffects;
	}

	/** Allows setting the id-map explicitly (which should only be used when, e.g., you plan to compare two dataflow graphs on the same AST-basis) */
	public setIdMap(idMap: AstIdMap): void {
		this._idMap = idMap;
	}

	/** Ids of all toplevel vertices (or all, including those nested in function definitions, if `includeDefinedFunctions`) with their info, see {@link DataflowGraph#edges}. */
	public* vertices(includeDefinedFunctions: boolean): MapIterator<[NodeId, Vertex]> {
		if(includeDefinedFunctions) {
			yield* this.vertexInformation.entries();
		} else {
			for(const id of this.rootVertices) {
				yield [id, this.vertexInformation.get(id) as Vertex];
			}
		}
	}

	/** Every vertex carrying `type`, in the order the graph learned of them. */
	public* verticesOfType<T extends Vertex['tag']>(type: T): MapIterator<[NodeId, Vertex & { tag: T }]> {
		const ids = this.types.get(type);
		if(ids === undefined) {
			return;
		}
		for(const id of ids) {
			const vertex = this.vertexInformation.get(id);
			/* a stale entry would hand out a vertex without the fields its tag promises */
			if(vertex?.tag === type) {
				yield [id, vertex as Vertex & { tag: T }];
			}
		}
	}

	/** The ids of {@link DataflowGraph#verticesOfType|verticesOfType}, as a fresh array the caller may keep. */
	public vertexIdsOfType<T extends Vertex['tag']>(type: T): NodeId[] {
		const ids = this.types.get(type);
		if(ids === undefined) {
			return [];
		}
		return ids.filter(id => this.vertexInformation.get(id)?.tag === type);
	}

	/** Ids of all edges in the graph together with their edge information, see {@link DataflowGraph#vertices}. */
	public* edges(): MapIterator<[NodeId, OutgoingEdges]> {
		yield* this.edgeInformation.entries();
	}

	/** Whether the graph contains a node with `id` (checking function definitions too if `includeDefinedFunctions`). */
	public hasVertex(id: NodeId, includeDefinedFunctions = true): boolean {
		return includeDefinedFunctions ? this.vertexInformation.has(id) : this.rootVertices.has(id);
	}

	/** Returns true if the root level of the graph contains a node with the given id. */
	public isRoot(id: NodeId): boolean {
		return this.rootVertices.has(id);
	}

	public rootIds(): ReadonlySet<NodeId> {
		return this.rootVertices;
	}

	/**
	 * Takes `type` off the edge `fromId -> toId`, dropping the edge itself once it states nothing.
	 * An edge with no type is no edge: every removal has to go through here so none is left behind.
	 */
	public removeEdgeType(fromId: NodeId, toId: NodeId, type: EdgeType | number): this {
		const from = NodeId.normalize(fromId), to = NodeId.normalize(toId);
		const targets = this.edgeInformation.get(from);
		const edge = targets?.get(to);
		if(edge === undefined || targets === undefined) {
			return this;
		}
		this.dropQualifications();
		edge.types &= ~type;
		if(DfEdge.hasAnyType(edge)) {
			/* the reverse index holds this very object, so a narrowed type is already visible through it */
			return this;
		}
		targets.delete(to);
		if(targets.size === 0) {
			this.edgeInformation.delete(from);
		}
		const into = this.incomingIndex?.get(to);
		into?.delete(from);
		if(into?.size === 0) {
			this.incomingIndex?.delete(to);
		}
		return this;
	}

	/**
	 * Adds `vertex` to the graph, filling in `fallbackEnv` if it carries no environment. `asRoot = false` skips
	 * adding it to {@link rootIds|root vertices} (mostly useful when constructing graphs for tests); `overwrite` replaces an existing vertex of the same id.
	 */
	public addVertex(vertex: DataflowGraphVertexArgument & Omit<Vertex, keyof DataflowGraphVertexArgument>, fallbackEnv: REnvironmentInformation | (() => REnvironmentInformation), asRoot = true, overwrite = false): this {
		const vid = vertex.id;
		const previous = this.vertexInformation.get(vid);
		if(previous !== undefined && !overwrite) {
			return this;
		}
		this.dropQualifications();
		const vtag = vertex.tag;

		// keep a clone of the original environment, isolating the snapshot from later updates
		let environment: REnvironmentInformation | undefined;
		if(vertex.environment) {
			environment = cloneEnvironmentInformation(vertex.environment);
		} else if(vtag === VertexType.FunctionDefinition || (vtag === VertexType.FunctionCall && !vertex.onlyBuiltin)) {
			/* only here is a fallback wanted, so a thunk spares every other vertex one it would discard */
			environment = typeof fallbackEnv === 'function' ? fallbackEnv() : fallbackEnv;
		}
		(vertex as { environment: REnvironmentInformation | undefined }).environment = environment;
		this.vertexInformation.set(vid, vertex as Vertex);
		if(activeDataflowBudget !== undefined) {
			activeDataflowBudget.vertex();
		}
		/* an overwrite keeping the tag is indexed already */
		if(previous?.tag !== vtag) {
			if(previous !== undefined) {
				this.unindexType(previous.tag, vid);
			}
			this.indexType(vtag, vid);
		}

		if(asRoot) {
			this.rootVertices.add(vid);
		}
		return this;
	}

	public addEdge(fromId: NodeId, toId: NodeId, type: EdgeType.ControlEdge, data: Omit<DFControlFlowEdge, 'types'>): this;
	public addEdge(fromId: NodeId, toId: NodeId, type: Exclude<EdgeType, EdgeType.ControlEdge> | number): this;
	public addEdge(fromId: NodeId, toId: NodeId, type: EdgeType | number, data?: Omit<DFControlFlowEdge, 'types'>): this {
		if(fromId === toId) {
			return this;
		}
		this.dropQualifications();
		const fromEdges = this.edgeInformation.get(fromId);
		const existing = fromEdges?.get(toId);
		if(existing !== undefined) {
			/* the reverse index holds this very object, so a widened type is already visible through it */
			existing.types |= type;
			if(data !== undefined) {
				Object.assign(existing, data);
			}
			return this;
		}

		/* the spread would build the object through a slower path, and this runs for every edge of every graph */
		const added = (data === undefined ? { types: type } : { types: type, cd: data.cd }) as unknown as Edge;
		if(fromEdges === undefined) {
			this.edgeInformation.set(fromId, new Map([[toId, added]]));
		} else {
			fromEdges.set(toId, added);
		}
		/*
		 * carry the new edge into the reverse index rather than dropping it: construction interleaves `addEdge`
		 * with `ingoingEdges`, and rebuilding costs a pass over every edge in the graph each time
		 */
		const into = this.incomingIndex?.get(toId);
		if(into !== undefined) {
			into.set(fromId, added);
		} else {
			this.incomingIndex?.set(toId, new Map([[fromId, added]]));
		}
		return this;
	}

	/**
	 * Merges `otherGraph` into *this* one in-place (the return value is only for convenience);
	 * `mergeRootVertices = false` excludes its root vertices (useful when merging in a function definition).
	 *
	 * `consume` takes `otherGraph`'s edge tables instead of copying them (perf). Pass it only for a graph that dies with the call.
	 */
	public mergeWith(otherGraph: DataflowGraph<Vertex, Edge> | undefined, mergeRootVertices = true, consume = false): this {
		if(otherGraph === undefined || otherGraph === this) {
			return this;
		}
		guard(!otherGraph.consumed, 'a graph consumed by an earlier merge cannot be merged again');

		this.mergeVertices(otherGraph, mergeRootVertices);
		this.mergeEdges(otherGraph, consume);
		otherGraph.consumed ||= consume;
		return this;
	}

	public mergeVertices(otherGraph: DataflowGraph<Vertex, Edge>, mergeRootVertices = true) {
		this.dropQualifications();
		// merge root ids
		if(mergeRootVertices) {
			for(const root of otherGraph.rootVertices) {
				this.rootVertices.add(root);
			}
		}

		for(const unknown of otherGraph.unknownSideEffects) {
			this._unknownSideEffects.add(unknown);
		}
		/* the tags of the vertices coming in repeat, so the list each goes on is looked up only when it changes */
		let lastTag: Vertex['tag'] | undefined;
		let lastIds: NodeId[] = [];
		for(const [id, info] of otherGraph.vertexInformation) {
			const currentInfo = this.vertexInformation.get(id);
			if(currentInfo === undefined) {
				this.vertexInformation.set(id, info);
				if(info.tag !== lastTag) {
					lastIds = this.typeList(lastTag = info.tag);
				}
				lastIds.push(id);
			} else {
				/* a known vertex keeps its tag, and with it its place in the index */
				const merged = mergeNodeInfos(currentInfo, info);
				if(merged !== currentInfo) {
					this.vertexInformation.set(id, merged);
				}
			}
		}
	}

	private mergeEdges(otherGraph: DataflowGraph<Vertex, Edge>, consume = false) {
		this.dropQualifications();
		this.incomingIndex = undefined;
		for(const [id, edges] of otherGraph.edgeInformation) {
			const existing = this.edgeInformation.get(id);
			if(existing === undefined) {
				this.edgeInformation.set(id, consume ? edges : new Map(edges));
			} else {
				for(const [target, edge] of edges) {
					const get = existing.get(target);
					if(get === undefined) {
						existing.set(target, edge);
					} else {
						get.types |= edge.types;
					}
				}
			}
		}
	}

	/** Marks the vertex referenced by `reference` as a definition, with `sourceIds` as the source vertex ids of the def if known. */
	public setDefinitionOfVertex(reference: IdentifierReference, sourceIds: readonly NodeId[] | undefined): void {
		this.dropQualifications();
		const vertex = this.getVertex(reference.nodeId);
		guard(vertex !== undefined, () => `node must be defined for ${JSON.stringify(reference)} to set reference`);
		if(FunctionDefinitionVertex.is(vertex) || VariableDefinitionVertex.is(vertex)) {
			vertex.cds = reference.cds;
		} else {
			const oldTag = vertex.tag;
			const vid = reference.nodeId;
			(vertex as unknown as Writable<DataflowGraphVertexVariableDefinition>).tag = VertexType.VariableDefinition;
			if(sourceIds) {
				(vertex as unknown as Writable<DataflowGraphVertexVariableDefinition>).source = sourceIds;
			}
			this.unindexType(oldTag, vid);
			this.indexType(VertexType.VariableDefinition, vid);
		}
	}

	/** Marks the vertex `info.id` in the graph to be a function call with the new `info`. */
	public updateToFunctionCall(info: DataflowGraphVertexFunctionCall): void {
		this.dropQualifications();
		const infoId = info.id;
		const vertex = this.getVertex(infoId);
		guard(vertex !== undefined && (UseVertex.is(vertex) || ValueVertex.is(vertex)), () => `node must be a use or value node for ${JSON.stringify(info.id)} to update it to a function call but is ${vertex?.tag}`);
		const previousTag = vertex.tag;
		this.vertexInformation.set(infoId, { ...vertex, ...info, tag: VertexType.FunctionCall });
		this.unindexType(previousTag, infoId);
		this.indexType(VertexType.FunctionCall, infoId);
	}

	/** If you do not pass the `to` node, this will just mark the node as maybe */
	public addControlDependency(from: NodeId, to: NodeId, when?: boolean): this {
		to = NodeId.normalize(to);
		const vertex = this.getVertex(from);
		guard(vertex !== undefined, () => `node must be defined for ${from} to add control dependency`);
		if(vertex.cds) {
			for(const { id, when: cond } of vertex.cds) {
				if(id === to && when !== cond) {
					return this;
				}
			}
		} else {
			vertex.cds = [];
		}
		vertex.cds.push({ id: to, when });
		return this;
	}

	/** Marks the given node as having unknown side effects */
	public markIdForUnknownSideEffects(id: NodeId, target?: LinkTo<RegExp | string>): this {
		if(target) {
			this._unknownSideEffects.add({
				id:     NodeId.normalize(id),
				linkTo: typeof target.callName === 'string' ? { ...target, callName: new RegExp(target.callName) } : target as LinkTo<RegExp>
			});
			return this;
		}
		this._unknownSideEffects.add(NodeId.normalize(id));
		return this;
	}

	/** Constructs a dataflow graph instance from the given JSON data, e.g. as sent by the flowR server for further analysis. */
	public static fromJson(data: DataflowGraphJson): DataflowGraph {
		const graph = new DataflowGraph(undefined);
		graph.rootVertices = new Set<NodeId>(data.rootVertices);
		graph.vertexInformation = new Map<NodeId, DataflowGraphVertexInfo>(data.vertexInformation);
		for(const [id, vertex] of graph.vertexInformation) {
			if(vertex.environment) {
				(vertex.environment as Writable<REnvironmentInformation>) = renvFromJson(vertex.environment as unknown as REnvironmentInformationJson);
			}
			/* the index is not serialized, without rebuilding it every lookup by tag comes up empty */
			graph.indexType(vertex.tag, id);
		}
		graph.edgeInformation = new Map<NodeId, OutgoingEdges>(data.edgeInformation.map(([id, edges]) => [id, new Map<NodeId, DfEdge>(edges)]));
		graph.incomingIndex = undefined;
		for(const unknown of data._unknownSideEffects) {
			graph._unknownSideEffects.add(unknown);
		}
		return graph;
	}
}

function mergeNodeInfos<Vertex extends DataflowGraphVertexInfo>(current: Vertex, next: Vertex): Vertex {
	if(current.tag !== next.tag) {
		return current;
	} else if(FunctionDefinitionVertex.is(current)) {
		const n = next as DataflowGraphVertexFunctionDefinition;
		current.exitPoints = uniqueArrayMerge(current.exitPoints, n.exitPoints);
		if(n.mode && n.mode.length > 0) {
			current.mode ??= [];
			for(const m of n.mode) {
				if(!current.mode.includes(m)) {
					current.mode.push(m);
				}
			}
		}
	}

	return current;
}

export interface IEnvironmentJson {
	readonly id: number;
	parent:      IEnvironmentJson;
	memory:      Record<BrandedIdentifier, IdentifierDefinition[]>;
	builtInEnv:  true | undefined;
	n?:          string;
	t?:          EnvType;
	globalEnv?:  true;
}

interface REnvironmentInformationJson {
	readonly current: IEnvironmentJson;
	readonly level:   number;
}

function envFromJson(json: IEnvironmentJson): Environment {
	const parent = json.parent ? envFromJson(json.parent) : undefined;
	const memory: BuiltInMemory = new Map();
	for(const [key, value] of Object.entries(json.memory)) {
		memory.set(key, value);
	}
	const obj = new Environment(parent as Environment, json.builtInEnv);
	(obj as { id: NodeId }).id = json.id;
	obj.adoptMap(memory);
	const env = obj;
	env.n = json.n;
	env.t = json.t;
	env.globalEnv = json.globalEnv;
	return env;
}

function renvFromJson(json: REnvironmentInformationJson): REnvironmentInformation {
	const current = envFromJson(json.current);
	return {
		current,
		level: json.level
	};
}
