import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../util/objects';
import type { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { guard } from '../util/assert';

export enum CfgVertexType {
    /** The explicit exit-nodes to ensure the hammock property */
    EndMarker   = 'end',
    /** something like an if, assignment, ... even though in the classical sense of R they are still expressions */
    Statement   = 'stm',
    /** something like an addition, ... */
    Expression  = 'expr',
	/** a (as far as R allows this) 'basic' block */
	Block       = 'blk',
}

export const enum CfgEdgeType {
	/** a flow dependency */
	Fd = 0,
	/** a control dependency */
	Cd = 1
}

/**
 * Provide a string representation of the given edge type.
 */
export function edgeTypeToString(type: CfgEdgeType): string {
	switch(type) {
		case CfgEdgeType.Fd:
			return 'FD';
		case CfgEdgeType.Cd:
			return 'CD';
		default:
			throw new Error(`Unknown edge type ${JSON.stringify(type)}`);
	}
}

/**
 * A plain vertex in the {@link ControlFlowGraph}.
 * Please use {@link CfgSimpleVertex} to refer to all potential vertex types within the graph.
 */
interface CfgBaseVertex extends MergeableRecord {
	/** the type of the vertex */
	type:         CfgVertexType,
	/** the id of the vertex, for non-blocks this should directly relate to the AST node */
	id:           NodeId,
	/** child nodes attached to this one */
	children?:    NodeId[],
	/** if the vertex calls a function, this links all targets of this call */
	callTargets?: Set<NodeId>,
}

interface CfgWithMarker extends CfgBaseVertex {
	/** mid-markers linked to this statement */
	mid?: NodeId[]
	/** end-markers linked to this statement */
	end?: NodeId[]
}

export interface CfgStatementVertex extends CfgWithMarker {
	type: CfgVertexType.Statement
}

export interface CfgExpressionVertex extends CfgWithMarker {
	type: CfgVertexType.Expression
}

export interface CfgWithRoot extends CfgBaseVertex {
	/** the vertex for which this is a marker */
	root: NodeId
}

export interface CfgEndMarkerVertex extends CfgWithRoot {
	type: CfgVertexType.EndMarker
}

export interface CfgBasicBlockVertex extends CfgBaseVertex {
	type:  CfgVertexType.Block,
	/** The vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs */
	elems: readonly Exclude<CfgSimpleVertex, CfgBasicBlockVertex>[]
}

/**
 * A vertex in the {@link ControlFlowGraph}.
 */
export type CfgSimpleVertex = CfgStatementVertex | CfgExpressionVertex | CfgBasicBlockVertex | CfgEndMarkerVertex

/**
 * Checks whether two vertices are equal.
 */
export function equalVertex(a: CfgSimpleVertex, b: CfgSimpleVertex): boolean {
	if(a.type !== b.type || a.id !== b.id) {
		return false;
	} else if(a.type === CfgVertexType.Block && b.type === CfgVertexType.Block) {
		return a.elems.length === b.elems.length && a.elems.every((e, i) => e.id === b.elems[i].id);
	} else if(a.type === CfgVertexType.EndMarker && b.type === CfgVertexType.EndMarker) {
		return a.root === b.root;
	}
	return true;
}

/**
 * Checks whether a vertex is a marker vertex (i.e., does not correspond to an actual AST node
 * but is a marker in the control flow graph).
 */
export function isMarkerVertex(vertex: CfgSimpleVertex): vertex is CfgEndMarkerVertex {
	return vertex.type === CfgVertexType.EndMarker;
}

/**
 * Get the root id of a vertex, i.e., the id of the AST node it corresponds to.
 */
export function getVertexRootId(vertex: CfgSimpleVertex): NodeId {
	return isMarkerVertex(vertex) ? vertex.root : vertex.id;
}

interface CfgFlowDependencyEdge extends MergeableRecord {
    label: CfgEdgeType.Fd
}

export interface CfgControlDependencyEdge extends MergeableRecord {
    label:  CfgEdgeType.Cd
    /** the id which caused the control dependency */
    caused: NodeId,
	/** is the control dependency satisfied with a true condition or is it negated (e.g., else-branch)? */
    when:   typeof RTrue | typeof RFalse
}

export type CfgEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge

/**
 * A read-only view of the {@link ControlFlowGraph}.
 */
export interface ReadOnlyControlFlowGraph {
	/**
	 * Get all ids of the root vertices &mdash; vertices that are not part of
	 * any function definition or basic block and hence part of the "top-level" control flow.
	 *
	 * This is the pendant of {@link DataflowGraph#rootIds|rootIds()} on a {@link DataflowGraph}.
	 * @see {@link ReadOnlyControlFlowGraph#vertices|vertices()} - for a way to get all vertices in the graph.
	 * @see {@link ReadOnlyControlFlowGraph#getVertex|getVertex()} - for a way to get a specific vertex by its id.
	 * @see {@link ReadOnlyControlFlowGraph#edges|edges()} - for a way to get all edges in the graph.
	 */
	readonly rootIds:            () => ReadonlySet<NodeId>
	/**
	 * Provide a view of all vertices in the graph.
	 * @param includeBasicBlockElements - if true, the elements of basic block elements are included in the result, otherwise this will only the basic blocks themselves
	 * @see {@link ReadOnlyControlFlowGraph#rootVertexIds|rootVertexIds()} - for a way to get the root vertices of the graph.
	 * @see {@link ReadOnlyControlFlowGraph#getVertex|getVertex()} - for a way to get a specific vertex by its id.
	 * @see {@link ReadOnlyControlFlowGraph#edges|edges()} - for a way to get all edges in the graph.
	 */
	readonly vertices:           (includeBasicBlockElements: boolean) => ReadonlyMap<NodeId, CfgSimpleVertex>
	/**
	 * Get all edges in the graph, independent of their sources and targets.
	 * If you are only interested in the edges of a specific node, please use {@link ReadOnlyControlFlowGraph#outgoingEdges|outgoingEdges()} or {@link ReadOnlyControlFlowGraph#ingoingEdges|ingoingEdges()}.
	 *
	 * This is the pendant of {@link DataflowGraph#edges|edges()} on a {@link DataflowGraph}.
	 */
	readonly edges:              () => ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>>
	/**
	 * Receive all outgoing edges of a given vertex.
	 *
	 * This is the pendant of {@link DataflowGraph#ingoingEdges|ingoingEdges()} on a {@link DataflowGraph}.
	 * @see {@link ReadOnlyControlFlowGraph#ingoingEdges|ingoingEdges()} - for a way to get all ingoing edges of a vertex.
	 */
	readonly outgoingEdges:      (id: NodeId) => ReadonlyMap<NodeId, CfgEdge> | undefined
	/**
	 * Receive all ingoing edges of a given vertex.
	 *
	 * This is the pendant of {@link DataflowGraph#outgoingEdges|outgoingEdges()} on a {@link DataflowGraph}.
	 * @see {@link ReadOnlyControlFlowGraph#outgoingEdges|outgoingEdges()} - for a way to get all outgoing edges of a vertex.
	 */
	readonly ingoingEdges:       (id: NodeId) => ReadonlyMap<NodeId, CfgEdge> | undefined
	/**
	 * Retrieve a vertex by its id.
	 * @param id - the id of the vertex to retrieve
	 * @param includeBlocks - if true, the elements of basic block elements are included in the result, otherwise this will only the basic blocks themselves
	 *
	 * This is the pendant of {@link DataflowGraph#getVertex|getVertex()} on a {@link DataflowGraph}.
	 */
	readonly getVertex:          (id: NodeId, includeBlocks?: boolean) => CfgSimpleVertex | undefined
	/**
	 * Check if a vertex with the given id exists in the graph.
	 * @param id - the id of the vertex to check
	 * @param includeBlocks - if true, the elements of basic block elements are included in the check, otherwise this will only check the basic blocks themselves
	 *
	 * This is the pendant of {@link DataflowGraph#hasVertex|hasVertex()} on a {@link DataflowGraph}.
	 */
	readonly hasVertex:          (id: NodeId, includeBlocks?: boolean) => boolean
	/**
	 * Obtain the basic block associated with the given element id (i.e. if this is an element within a basic block, return the blockit belongs to).
	 */
	readonly getBasicBlock:      (elemId: NodeId) => CfgBasicBlockVertex | undefined
	/**
	 * Returns true if the graph may contain basic blocks and false if we know that it does not.
	 * This can be used for optimizations.
	 */
	readonly mayHaveBasicBlocks: () => boolean
}

/**
 * This class represents the control flow graph of an R program.
 * The control flow may be hierarchical when confronted with function definitions (see {@link CfgSimpleVertex} and {@link CFG#rootVertexIds|rootVertexIds()}).
 *
 * There are two very simple visitors to traverse a CFG:
 * - {@link visitCfgInOrder} visits the graph in the order of the vertices
 * - {@link visitCfgInReverseOrder} visits the graph in reverse order
 *
 * If you want to prohibit modification, please refer to the {@link ReadOnlyControlFlowGraph} interface.
 */
export class ControlFlowGraph<Vertex extends CfgSimpleVertex = CfgSimpleVertex> implements ReadOnlyControlFlowGraph {
	private readonly rootVertices:      Set<NodeId> = new Set<NodeId>();
	/** Nesting-Independent vertex information, mapping the id to the vertex */
	private readonly vertexInformation: Map<NodeId, Vertex> = new Map<NodeId, Vertex>();
	/** the basic block children map contains a mapping of ids to all vertices that are nested in basic blocks, mapping them to the Id of the block they appear in */
	private readonly bbChildren:        Map<NodeId, NodeId> = new Map<NodeId, NodeId>();
	/** basic block agnostic edges */
	private readonly edgeInformation:   Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();
	/** used as an optimization to avoid unnecessary lookups */
	private _mayHaveBasicBlocks = false;


	/**
	 * Add a new vertex to the control flow graph.
	 * @see {@link ControlFlowGraph#addEdge|addEdge()} - to add an edge
	 */
	addVertex(vertex: Vertex, rootVertex = true): this {
		guard(!this.vertexInformation.has(vertex.id), `Node with id ${vertex.id} already exists`);

		if(vertex.type === CfgVertexType.Block) {
			this._mayHaveBasicBlocks = true;
			if(vertex.elems.some(e => this.bbChildren.has(e.id) || this.rootVertices.has(e.id))) {
				throw new Error(`Vertex ${vertex.id} contains vertices that are already part of the graph`);
			}
			for(const elem of vertex.elems) {
				this.bbChildren.set(elem.id, vertex.id);
			}
		}

		this.vertexInformation.set(vertex.id, vertex);

		if(rootVertex) {
			this.rootVertices.add(vertex.id);
		}
		return this;
	}

	/**
	 * Add a new edge to the control flow graph.
	 * @see {@link ControlFlowGraph#addVertex|addVertex()} - to add vertices
	 * @see {@link ControlFlowGraph#addEdges|addEdges()} - to add multiple edges at once
	 */
	addEdge(from: NodeId, to: NodeId, edge: CfgEdge): this {
		const edgesFrom = this.edgeInformation.get(from) ?? new Map<NodeId, CfgEdge>();
		if(!this.edgeInformation.has(from)) {
			this.edgeInformation.set(from, edgesFrom);
		}
		edgesFrom.set(to, edge);
		return this;
	}

	/**
	 * Add multiple edges from a given source vertex to the control flow graph.
	 */
	addEdges(from: NodeId, to: Map<NodeId, CfgEdge>): this {
		const edgesFrom = this.edgeInformation.get(from) ?? new Map<NodeId, CfgEdge>();
		if(!this.edgeInformation.has(from)) {
			this.edgeInformation.set(from, edgesFrom);
		}
		for(const [toId, edge] of to) {
			edgesFrom.set(toId, edge);
		}
		return this;
	}

	outgoingEdges(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		return this.edgeInformation.get(node);
	}

	ingoingEdges(id: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		const edges = new Map<NodeId, CfgEdge>();
		for(const [source, outgoing] of this.edgeInformation.entries()) {
			if(outgoing.has(id)) {
				edges.set(source, outgoing.get(id) as CfgEdge);
			}
		}
		return edges;
	}

	rootIds(): ReadonlySet<NodeId> {
		return this.rootVertices;
	}

	vertices(includeBasicBlockElements = true): ReadonlyMap<NodeId, CfgSimpleVertex> {
		if(includeBasicBlockElements) {
			const all = new Map<NodeId, CfgSimpleVertex>(this.vertexInformation);
			for(const [id, block] of this.bbChildren.entries()) {
				const blockVertex = all.get(block);
				if(blockVertex === undefined || blockVertex.type !== CfgVertexType.Block) {
					continue;
				}
				const elem = blockVertex.elems.find(e => e.id === id);
				if(elem !== undefined) {
					all.set(id, elem);
				}
			}
			return all;
		} else {
			return this.vertexInformation;
		}
	}

	getBasicBlock(elemId: NodeId): CfgBasicBlockVertex | undefined {
		const block = this.bbChildren.get(elemId);
		if(block === undefined) {
			return undefined;
		}
		const blockVertex = this.vertexInformation.get(block);
		if(blockVertex === undefined || blockVertex.type !== CfgVertexType.Block) {
			return undefined;
		}
		return blockVertex;
	}

	edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>> {
		return this.edgeInformation;
	}

	/**
	 * Retrieve a vertex by its id.
	 */
	getVertex(id: NodeId, includeBlocks = true): CfgSimpleVertex | undefined {
		const res = this.vertexInformation.get(id);
		if(res || !includeBlocks) {
			return res;
		}
		const block = this.bbChildren.get(id);
		if(block === undefined) {
			return undefined;
		}
		const blockVertex = this.vertexInformation.get(block);
		if(blockVertex === undefined || blockVertex.type !== CfgVertexType.Block) {
			return undefined;
		}
		blockVertex.elems.find(e => e.id === id);
	}

	hasVertex(id: NodeId, includeBlocks = true): boolean {
		return this.vertexInformation.has(id) || (this._mayHaveBasicBlocks && includeBlocks && this.bbChildren.has(id));
	}

	mayHaveBasicBlocks(): boolean {
		return this._mayHaveBasicBlocks;
	}

	/**
	 * This removes the vertex and all edges to and from it.
	 * @param id - the id of the vertex to remove
	 * @see {@link ControlFlowGraph#addVertex|addVertex()} - to add a vertex
	 * @see {@link ControlFlowGraph#removeEdge|removeEdge()} - to remove a specific edge
	 */
	removeVertex(id: NodeId): this {
		this.vertexInformation.delete(id);
		this.edgeInformation.delete(id);
		this.bbChildren.delete(id);
		// remove all bbChildren with id as target
		for(const [a, b] of this.bbChildren.entries()) {
			if(b === id) {
				this.bbChildren.delete(a);
			}
		}
		for(const edges of this.edgeInformation.values()) {
			edges.delete(id);
		}
		this.rootVertices.delete(id);
		return this;
	}

	/**
	 * Removes a all direct edges between `from` and `to` from the control flow graph.
	 * @see {@link ControlFlowGraph#addEdge|addEdge()} - to add an edge
	 * @see {@link ControlFlowGraph#removeVertex|removeVertex()} - to remove a vertex and all its edges
	 */
	removeEdge(from: NodeId, to: NodeId): this {
		const edges = this.edgeInformation.get(from);
		if(edges) {
			edges.delete(to);
			if(edges.size === 0) {
				this.edgeInformation.delete(from);
			}
		}
		return this;
	}


	/** merges b into a */
	mergeTwoBasicBlocks(
		a: NodeId,
		b: NodeId
	): this {
		const aVertex = this.getVertex(a);
		const bVertex = this.getVertex(b);
		if(!aVertex || !bVertex || aVertex.type !== CfgVertexType.Block || bVertex.type !== CfgVertexType.Block) {
			return this;
		}

		const bElems = bVertex.elems;

		aVertex.elems = aVertex.elems.concat(bElems);
		// update cache
		for(const elem of bElems) {
			this.bbChildren.set(elem.id, a);
		}

		// drop all edges from a to b
		this.removeEdge(a, b);

		const bOutgoing = this.outgoingEdges(b);

		this.removeVertex(b);

		// reroute all edge from b to a
		for(const [to, edge] of bOutgoing ?? []) {
			this.addEdge(a, to, edge);
		}
		return this;
	}

	/**
	 * Merge another control flow graph into this one.
	 * @param other - the other control flow graph to merge into this one
	 * @param forceNested - should the other graph be assumed to be fully nested (e.g., within a function definition).
	 *
	 * This is the pendant of {@link DataflowGraph#mergeWith|mergeWith()} on a {@link DataflowGraph}.
	 */
	mergeWith(other: ControlFlowGraph<Vertex>, forceNested = false): this {
		this._mayHaveBasicBlocks ||= other._mayHaveBasicBlocks;

		const roots = other.rootVertices;
		if(this._mayHaveBasicBlocks) {
			for(const [id, node] of other.vertexInformation) {
				this.addVertex(node, forceNested ? false : roots.has(id));
			}
		} else {
			for(const [id, node] of other.vertexInformation) {
				this.vertexInformation.set(id, node);
			}
			if(!forceNested) {
				for(const root of roots) {
					this.rootVertices.add(root);
				}
			}
		}

		for(const [from, edges] of other.edgeInformation) {
			this.addEdges(from, edges);
		}
		return this;
	}
}

/**
 * Summarizes the control information of a program
 * @see {@link emptyControlFlowInformation} - to create an empty control flow information object
 */
export interface ControlFlowInformation<Vertex extends CfgSimpleVertex = CfgSimpleVertex> extends MergeableRecord {
	/** all active 'return'(-like) unconditional jumps */
    returns:     NodeId[],
	/** all active 'break'(-like) unconditional jumps */
    breaks:      NodeId[],
	/** all active 'next'(-like) unconditional jumps */
    nexts:       NodeId[],
    /** intended to construct a hammock graph, with 0 exit points representing a block that should not be part of the CFG (like a comment) */
    entryPoints: NodeId[],
    /** See {@link ControlFlowInformation#entryPoints|entryPoints} */
    exitPoints:  NodeId[],
	/** the control flow graph summarizing the flow information */
    graph:       ControlFlowGraph<Vertex>
}

/**
 * Create an empty control flow information object.
 */
export function emptyControlFlowInformation(): ControlFlowInformation {
	return {
		returns:     [],
		breaks:      [],
		nexts:       [],
		entryPoints: [],
		exitPoints:  [],
		graph:       new ControlFlowGraph()
	};
}