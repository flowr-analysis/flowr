import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../util/objects';
import type { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { arrayEqual } from '../util/arrays';

export enum CfgVertexType {
    /** Marks a break point in a construct (e.g., between the name and the value of an argument, or the formals and the body of a function)  */
    MidMarker   = 'mid',
    /** The explicit exit-nodes to ensure the hammock property */
    EndMarker   = 'end',
	/** A function definition */
	Function    = 'fn',
    /** something like an if, assignment, ... even though in the classical sense of R they are still expressions */
    Statement   = 'stm',
    /** something like an addition, ... */
    Expression  = 'expr',
	/** a (as far as R allows this) 'basic' block */
	Block	  = 'blk',
}

export const enum CfgEdgeType {
	/** a flow dependency */
	Fd = 0,
	/** a control dependency */
	Cd = 1,
	/** the flow to continue in case of a function call */
	Call= 2
}

export function edgeTypeToString(type: CfgEdgeType): string {
	switch(type) {
		case CfgEdgeType.Fd:
			return 'FD';
		case CfgEdgeType.Cd:
			return 'CD';
		case CfgEdgeType.Call:
			return 'Call';
		default:
			throw new Error(`Unknown edge type ${JSON.stringify(type)}`);
	}
}

interface CfgBaseVertex extends MergeableRecord {
	type: CfgVertexType,
	id:   NodeId,
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

export interface CfgFunction extends CfgBaseVertex {
	type:        CfgVertexType.Function
	children:    NodeId[],
	entryPoints: NodeId[]
}

export interface CfgExpressionVertex extends CfgWithMarker {
	type: CfgVertexType.Expression
}

export interface CfgMidMarkerVertex extends CfgBaseVertex {
	type: CfgVertexType.MidMarker
	// describing the separation performed by this marker
	kind: string
	/** the vertex for which this is a mid-marker */
	root: NodeId
}

export interface CfgEndMarkerVertex extends CfgBaseVertex {
	type: CfgVertexType.EndMarker
	/** the vertex for which this is an end-marker */
	root: NodeId,
}

export interface CfgBasicBlockVertex extends CfgBaseVertex {
	type:  CfgVertexType.Block,
	/** The vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs */
	elems: readonly Exclude<CfgSimpleVertex, CfgBasicBlockVertex>[]
}

/**
 * A vertex in the {@link ControlFlowGraph}.
 */
export type CfgSimpleVertex = CfgFunction | CfgStatementVertex | CfgExpressionVertex | CfgBasicBlockVertex | CfgMidMarkerVertex | CfgEndMarkerVertex

// TODO: check that we have all veretx type, add ne functiond efinition vertex type, add resolved call within the cfg
export function equalVertex(a: CfgSimpleVertex, b: CfgSimpleVertex): boolean {
	if(a.type !== b.type || a.id !== b.id) {
		return false;
	} else if(a.type === CfgVertexType.Block && b.type === CfgVertexType.Block) {
		return a.elems.length === b.elems.length && a.elems.every((e, i) => e.id === b.elems[i].id);
	} else if(a.type === CfgVertexType.MidMarker && b.type === CfgVertexType.MidMarker) {
		return a.kind === b.kind && a.root === b.root;
	} else if(a.type === CfgVertexType.EndMarker && b.type === CfgVertexType.EndMarker) {
		return a.root === b.root;
	} else if(a.type === CfgVertexType.Function && b.type === CfgVertexType.Function) {
		return arrayEqual(a.entryPoints, b.entryPoints) && arrayEqual(a.children, b.children);
	}
	return true;
}

interface CfgFlowDependencyEdge extends MergeableRecord {
    label: CfgEdgeType.Fd
}

interface CfgCallDependencyEdge extends MergeableRecord {
	label: CfgEdgeType.Call
}

interface CfgControlDependencyEdge extends MergeableRecord {
    label:  CfgEdgeType.Cd
    /** the id which caused the control dependency */
    caused: NodeId,
    when:   typeof RTrue | typeof RFalse
}

export type CfgEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge | CfgCallDependencyEdge

/**
 * A read-only view of the {@link ControlFlowGraph}.
 */
export interface ReadOnlyControlFlowGraph {
	readonly rootVertexIds: () => ReadonlySet<NodeId>
	readonly vertices:      (includeBasicBlockElements: boolean) => ReadonlyMap<NodeId, CfgSimpleVertex>
	readonly edges:         () => ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>>
	readonly outgoing:      (node: NodeId) => ReadonlyMap<NodeId, CfgEdge> | undefined
	readonly ingoing:       (node: NodeId) => ReadonlyMap<NodeId, CfgEdge> | undefined
	readonly getVertex:     (id: NodeId, includeBlocks?: boolean) => CfgSimpleVertex | undefined
	readonly hasVertex:     (id: NodeId, includeBlocks?: boolean) => boolean
	readonly getBasicBlock: (elemId: NodeId) => CfgBasicBlockVertex | undefined
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
	private rootVertices:      Set<NodeId> = new Set<NodeId>();
	private vertexInformation: Map<NodeId, Vertex> = new Map<NodeId, Vertex>();
	/** the basic block children maps contains a mapping of ids to all vertices that are nested in basic blocks, mapping them to the Id of the block they appear in */
	private bbChildren:        Map<NodeId, NodeId> = new Map<NodeId, NodeId>();
	/** basic block agnostic edges */
	private edgeInformation:   Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();

	addVertex(vertex: Vertex, rootVertex = true): this {
		if(this.vertexInformation.has(vertex.id)) {
			throw new Error(`Node with id ${vertex.id} already exists`);
		} else if(vertex.type === CfgVertexType.Block && vertex.elems.some(e => this.bbChildren.has(e.id) || this.rootVertices.has(e.id))) {
			throw new Error(`Vertex ${vertex.id} contains vertices that are already part of the graph`);
		}
		this.vertexInformation.set(vertex.id, vertex);
		if(vertex.type === CfgVertexType.Block) {
			for(const elem of vertex.elems) {
				this.bbChildren.set(elem.id, vertex.id);
			}
		}
		if(rootVertex) {
			this.rootVertices.add(vertex.id);
		}
		return this;
	}

	addEdge(from: NodeId, to: NodeId, edge: CfgEdge): this {
		if(!this.edgeInformation.has(from)) {
			this.edgeInformation.set(from, new Map<NodeId, CfgEdge>());
		}
		this.edgeInformation.get(from)?.set(to, edge);
		return this;
	}

	outgoing(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		return this.edgeInformation.get(node);
	}

	ingoing(id: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		const edges = new Map<NodeId, CfgEdge>();
		for(const [source, outgoing] of this.edgeInformation.entries()) {
			if(outgoing.has(id)) {
				edges.set(source, outgoing.get(id) as CfgEdge);
			}
		}
		return edges;
	}

	rootVertexIds(): ReadonlySet<NodeId> {
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
		return this.vertexInformation.has(id) || (includeBlocks && this.bbChildren.has(id));
	}

	/**
	 * This removes the vertex and all edges to and from it.
	 * @param id - the id of the vertex to remove
	 */
	removeVertex(id: NodeId): this {
		this.vertexInformation.delete(id);
		this.edgeInformation.delete(id);
		this.bbChildren.delete(id);
		// remove all bbChildren with id as target
		for(const [a, b] of this.bbChildren.entries()) {
			if(b === id) {
				// TODO: check for modify on iterate
				this.bbChildren.delete(a);
			}
		}
		for(const edges of this.edgeInformation.values()) {
			edges.delete(id);
		}
		this.rootVertices.delete(id);
		return this;
	}

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

		const bOutgoing = this.outgoing(b);

		this.removeVertex(b);

		// reroute all edge from b to a
		for(const [to, edge] of bOutgoing ?? []) {
			this.addEdge(a, to, edge);
		}
		return this;
	}

	merge(other: ControlFlowGraph<Vertex>, forceNested = false): this {
		for(const [id, node] of other.vertexInformation) {
			this.addVertex(node, forceNested ? false : other.rootVertices.has(id));
		}
		for(const [from, edges] of other.edgeInformation) {
			for(const [to, edge] of edges) {
				this.addEdge(from, to, edge);
			}
		}
		return this;
	}
}

export interface ControlFlowInformation<Vertex extends CfgSimpleVertex = CfgSimpleVertex> extends MergeableRecord {
    returns:     NodeId[],
    breaks:      NodeId[],
    nexts:       NodeId[],
    /** intended to construct a hammock graph, with 0 exit points representing a block that should not be part of the CFG (like a comment) */
    entryPoints: NodeId[],
    /** See {@link ControlFlowInformation#entryPoints|entryPoints} */
    exitPoints:  NodeId[],
    graph:       ControlFlowGraph<Vertex>
}

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