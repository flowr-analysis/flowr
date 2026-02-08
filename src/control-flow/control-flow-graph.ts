import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../util/objects';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
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
export type CfgSimpleVertex = CfgStatementVertex | CfgExpressionVertex | CfgBasicBlockVertex | CfgEndMarkerVertex;

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

type CfgFlowDependencyEdge = CfgEdgeType.Fd;
type CfgControlDependencyEdge = [c: NodeId, w: typeof RTrue | typeof RFalse];

/**
 * An edge in the {@link ControlFlowGraph}.
 * @see {@link CfgEdge} - for helper functions to work with edges.
 */
export type CfgEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge;

/**
 * Helper object for {@link CfgEdge}.
 */
export const CfgEdge = {
	/**
	 * Check whether the given edge is a flow dependency edge.
	 */
	isFlowDependency(this: void, edge: CfgEdge | undefined): edge is CfgFlowDependencyEdge {
		return edge === CfgEdgeType.Fd;
	},
	/**
	 * Check whether the given edge is a control dependency edge.
	 */
	isControlDependency(this: void, edge: CfgEdge | undefined): edge is CfgControlDependencyEdge {
		return Array.isArray(edge) && edge.length === 2;
	},
	/**
	 * Create a flow dependency edge.
	 */
	makeFd(this: void): CfgFlowDependencyEdge {
		return CfgEdgeType.Fd;
	},
	/**
	 * Create a control dependency edge with the given cause and condition.
	 * @param controlId - the id of the vertex that causes the control dependency
	 * @param whenTrue  - whether the control dependency is satisfied with a true condition or is it negated (e.g., else-branch)
	 * @see {@link CfgEdge#makeCdTrue|makeCdTrue()} - for a version of this function that assumes the control dependency is satisfied with a true condition
	 * @see {@link CfgEdge#makeCdFalse|makeCdFalse()} - for a version of this function that assumes the control dependency is negated (e.g., else-branch)
	 */
	makeCd(this: void, controlId: NodeId, whenTrue: typeof RTrue | typeof RFalse): CfgControlDependencyEdge {
		return [controlId, whenTrue];
	},
	/**
	 * Create a control dependency edge with the given cause and a true condition.
	 * @param controlId - the id of the vertex that causes the control dependency
	 * @see {@link CfgEdge#makeCd|makeCd()} - for a version of this function that allows to specify the condition as well
	 */
	makeCdTrue(this: void, controlId: NodeId): CfgControlDependencyEdge {
		return [controlId, RTrue];
	},
	/**
	 * Create a control dependency edge with the given cause and a negated condition (e.g., else-branch).
	 * @param controlId - the id of the vertex that causes the control dependency
	 * @see {@link CfgEdge#makeCd|makeCd()} - for a version of this function that allows to specify the condition as well
	 */
	makeCdFalse(this: void, controlId: NodeId): CfgControlDependencyEdge {
		return [controlId, RFalse];
	},
	/**
	 * Get the cause of a control dependency edge, i.e., the id of the vertex that causes the control dependency.
	 * If the edge is not a control dependency edge, this returns undefined.
	 *
	 * This is the pendant of {@link CfgEdge#isControlDependency|isControlDependency()} on a {@link CfgEdge}.
	 * @see {@link CfEdge#unpackCause|unpackCause()} - for a version of this function that assumes the edge is a control dependency edge and hence does not return undefined
	 */
	getCause(this: void, edge: CfgEdge): NodeId | undefined {
		if(CfgEdge.isControlDependency(edge)) {
			return edge[0];
		} else {
			return undefined;
		}
	},
	/**
	 * Get the cause of a control dependency edge, i.e., the id of the vertex that causes the control dependency.
	 */
	unpackCause(this: void, edge: CfgControlDependencyEdge): NodeId {
		return edge[0];
	},
	/**
	 * Get whether the control dependency edge is satisfied with a true condition or is it negated (e.g., else-branch).
	 * If the edge is not a control dependency edge, this returns undefined.
	 *
	 * This is the pendant of {@link CfgEdge#isControlDependency|isControlDependency()} on a {@link CfgEdge}.
	 * @see {@link CfEdge#unpackWhenTrue|unpackWhenTrue()} - for a version of this function that assumes the edge is a control dependency edge and hence does not return undefined
	 */
	getWhen(this: void, edge: CfgEdge): typeof RTrue | typeof RFalse | undefined {
		if(CfgEdge.isControlDependency(edge)) {
			return edge[1];
		} else {
			return undefined;
		}
	},
	/**
	 * Get whether the control dependency edge is satisfied with a true condition or is it negated (e.g., else-branch).
	 */
	unpackWhen(this: void, edge: CfgControlDependencyEdge): typeof RTrue | typeof RFalse {
		return edge[1];
	},
	/**
	 * Check whether two edges are equal.
	 */
	equals(this: void, a: CfgEdge, b: CfgEdge): boolean {
		if(CfgEdge.isFlowDependency(a) && CfgEdge.isFlowDependency(b)) {
			return true;
		} else if(CfgEdge.isControlDependency(a) && CfgEdge.isControlDependency(b)) {
			return a[0] === b[0] && a[1] === b[1];
		}
		return false;
	},
	/**
	 * Check whether the given edge is of the given type.
	 * @see {@link CfgEdge#getType|getType()} - for a version of this function that returns the type of the edge instead of checking against a given type
	 */
	isOfType(this: void, edge: CfgEdge, type: CfgEdgeType): boolean {
		return CfgEdge.getType(edge) === type;
	},
	/**
	 * Get the type of the given edge.
	 * @see {@link CfgEdge#isOfType|isOfType()} - for a version of this function that checks whether the edge is of a given type
	 */
	getType(this: void, edge: CfgEdge): CfgEdgeType {
		return CfgEdge.isFlowDependency(edge) ? CfgEdgeType.Fd : CfgEdgeType.Cd;
	},
	/**
	 * Provide a string representation of the given edge, e.g., for debugging or visualization purposes.
	 * @see {@link CfgEdge#toString|toString()} - for a version of this function that also includes the details of the edge (e.g., cause and condition for control dependency edges)
	 */
	typeToString(this: void, edge: CfgEdge): string {
		if(CfgEdge.isFlowDependency(edge)) {
			return 'FD';
		} else {
			return 'CD';
		}
	},
	/**
	 * Provide a string representation of the given edge, including its details (e.g., cause and condition for control dependency edges), e.g., for debugging or visualization purposes.
	 * @see {@link CfgEdge#type2String|type2String()} - for a version of this function that only includes the type of the edge
	 */
	toString(this: void, edge: CfgEdge): string {
		if(CfgEdge.isFlowDependency(edge)) {
			return 'FD';
		} else {
			return `CD(${edge[0]}, ${edge[1] === RTrue ? 'T' : 'F'})`;
		}
	}
} as const;

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
	 * @param includeBasicBlockElements - if true, the elements of basic block elements are included in the result, otherwise only the basic blocks themselves are included
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
	private readonly roots:        Set<NodeId> = new Set<NodeId>();
	/** Nesting-Independent vertex information, mapping the id to the vertex */
	private readonly vtxInfos:     Map<NodeId, Vertex> = new Map<NodeId, Vertex>();
	/** the basic block children map contains a mapping of ids to all vertices that are nested in basic blocks, mapping them to the Id of the block they appear in */
	private readonly bbChildren:   Map<NodeId, NodeId> = new Map<NodeId, NodeId>();
	/** basic block agnostic edges */
	private readonly edgeInfos:    Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();
	/** reverse edges for bidirectional mapping */
	private readonly revEdgeInfos: Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();
	/** used as an optimization to avoid unnecessary lookups */
	private _mayBB = false;


	/**
	 * Add a new vertex to the control flow graph.
	 * @see {@link ControlFlowGraph#addEdge|addEdge()} - to add an edge
	 */
	addVertex(vertex: Vertex, rootVertex = true): this {
		guard(!this.vtxInfos.has(vertex.id), `Node with id ${vertex.id} already exists`);

		if(vertex.type === CfgVertexType.Block) {
			this._mayBB = true;
			if(vertex.elems.some(e => this.bbChildren.has(e.id) || this.roots.has(e.id))) {
				throw new Error(`Vertex ${vertex.id} contains vertices that are already part of the graph`);
			}
			for(const elem of vertex.elems) {
				this.bbChildren.set(elem.id, vertex.id);
			}
		}

		this.vtxInfos.set(vertex.id, vertex);

		if(rootVertex) {
			this.roots.add(vertex.id);
		}
		return this;
	}

	/**
	 * Add a new edge to the control flow graph.
	 * @see {@link ControlFlowGraph#addVertex|addVertex()} - to add vertices
	 * @see {@link ControlFlowGraph#addEdges|addEdges()} - to add multiple edges at once
	 */
	addEdge(from: NodeId, to: NodeId, edge: CfgEdge): this {
		const edgesFrom = this.edgeInfos.get(from) ?? new Map<NodeId, CfgEdge>();
		if(!this.edgeInfos.has(from)) {
			this.edgeInfos.set(from, edgesFrom);
		}
		edgesFrom.set(to, edge);

		const edgesTo = this.revEdgeInfos.get(to) ?? new Map<NodeId, CfgEdge>();
		if(!this.revEdgeInfos.has(to)) {
			this.revEdgeInfos.set(to, edgesTo);
		}
		edgesTo.set(from, edge);
		return this;
	}

	/**
	 * Add multiple edges from a given source vertex to the control flow graph.
	 */
	addEdges(from: NodeId, to: Map<NodeId, CfgEdge>): this {
		for(const [toNode, edge] of to) {
			this.addEdge(from, toNode, edge);
		}
		return this;
	}

	outgoingEdges(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		return this.edgeInfos.get(node);
	}

	ingoingEdges(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		return this.revEdgeInfos.get(node);
	}

	rootIds(): ReadonlySet<NodeId> {
		return this.roots;
	}

	vertices(includeBasicBlockElements = true): ReadonlyMap<NodeId, CfgSimpleVertex> {
		if(includeBasicBlockElements) {
			const all = new Map<NodeId, CfgSimpleVertex>(this.vtxInfos);
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
			return this.vtxInfos;
		}
	}

	getBasicBlock(elemId: NodeId): CfgBasicBlockVertex | undefined {
		const block = this.bbChildren.get(elemId);
		if(block === undefined) {
			return undefined;
		}
		const blockVertex = this.vtxInfos.get(block);
		if(blockVertex === undefined || blockVertex.type !== CfgVertexType.Block) {
			return undefined;
		}
		return blockVertex;
	}

	edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>> {
		return this.edgeInfos;
	}

	/**
	 * Retrieve a vertex by its id.
	 */
	getVertex(id: NodeId, includeBlocks = true): CfgSimpleVertex | undefined {
		const res = this.vtxInfos.get(id);
		if(res || !includeBlocks) {
			return res;
		}
		const block = this.bbChildren.get(id);
		if(block === undefined) {
			return undefined;
		}
		const blockVertex = this.vtxInfos.get(block);
		if(blockVertex === undefined || blockVertex.type !== CfgVertexType.Block) {
			return undefined;
		}
		blockVertex.elems.find(e => e.id === id);
	}

	hasVertex(id: NodeId, includeBlocks = true): boolean {
		return this.vtxInfos.has(id) || (this._mayBB && includeBlocks && this.bbChildren.has(id));
	}

	mayHaveBasicBlocks(): boolean {
		return this._mayBB;
	}

	/**
	 * This removes the vertex and all edges to and from it.
	 * @param id - the id of the vertex to remove
	 * @see {@link ControlFlowGraph#addVertex|addVertex()} - to add a vertex
	 * @see {@link ControlFlowGraph#removeEdge|removeEdge()} - to remove a specific edge
	 */
	removeVertex(id: NodeId): this {
		this.vtxInfos.delete(id);
		this.edgeInfos.delete(id);
		this.revEdgeInfos.delete(id);
		this.bbChildren.delete(id);
		// remove all bbChildren with id as target
		for(const [a, b] of this.bbChildren.entries()) {
			if(b === id) {
				this.bbChildren.delete(a);
			}
		}
		for(const edges of this.edgeInfos.values()) {
			edges.delete(id);
		}
		for(const edges of this.revEdgeInfos.values()) {
			edges.delete(id);
		}
		this.roots.delete(id);
		return this;
	}

	/**
	 * Removes a all direct edges between `from` and `to` from the control flow graph.
	 * @see {@link ControlFlowGraph#addEdge|addEdge()} - to add an edge
	 * @see {@link ControlFlowGraph#removeVertex|removeVertex()} - to remove a vertex and all its edges
	 */
	removeEdge(from: NodeId, to: NodeId): this {
		const edgesFrom = this.edgeInfos.get(from);
		if(edgesFrom) {
			edgesFrom.delete(to);
			if(edgesFrom.size === 0) {
				this.edgeInfos.delete(from);
			}
		}
		const edgesTo = this.revEdgeInfos.get(to);
		if(edgesTo) {
			edgesTo.delete(from);
			if(edgesTo.size === 0) {
				this.revEdgeInfos.delete(to);
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
		this._mayBB ||= other._mayBB;

		const roots = other.roots;
		if(this._mayBB) {
			for(const [id, node] of other.vtxInfos) {
				this.addVertex(node, forceNested ? false : roots.has(id));
			}
		} else {
			for(const [id, node] of other.vtxInfos) {
				this.vtxInfos.set(id, node);
			}
			if(!forceNested) {
				for(const root of roots) {
					this.roots.add(root);
				}
			}
		}

		for(const [from, edges] of other.edgeInfos) {
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