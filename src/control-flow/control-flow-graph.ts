import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../util/objects';
import type { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';

export const enum CfgVertexType {
    /** Marks a break point in a construct (e.g., between the name and the value of an argument, or the formals and the body of a function)  */
    MidMarker   = 'mid-marker',
    /** The explicit exit-nodes to ensure the hammock property */
    EndMarker   = 'end-marker',
    /** something like an if, assignment, ... even though in the classical sense of R they are still expressions */
    Statement   = 'statement',
    /** something like an addition, ... */
    Expression  = 'expression'
}

export interface CfgVertex {
    id:        NodeId
    type:      CfgVertexType,
    name:      string
    /** in case of a function definition */
    children?: NodeId[]
}

interface CfgFlowDependencyEdge extends MergeableRecord {
    label: 'FD'
}
interface CfgControlDependencyEdge extends MergeableRecord {
    label:  'CD'
    /** the id which caused the control dependency */
    caused: NodeId,
    when:   typeof RTrue | typeof RFalse
}

export type CfgEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge

/**
 * This class represents the control flow graph of an R program.
 * The control flow may be hierarchical when confronted with function definitions (see {@link CfgVertex} and {@link CFG#rootVertexIds|rootVertexIds()}).
 */
export class ControlFlowGraph {
	private rootVertices:      Set<NodeId> = new Set<NodeId>();
	private vertexInformation: Map<NodeId, CfgVertex> = new Map<NodeId, CfgVertex>();
	private edgeInformation:   Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();

	addVertex(vertex: CfgVertex, rootVertex = true): this {
		if(this.vertexInformation.has(vertex.id)) {
			throw new Error(`Node with id ${vertex.id} already exists`);
		}
		this.vertexInformation.set(vertex.id, vertex);
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

	rootVertexIds(): ReadonlySet<NodeId> {
		return this.rootVertices;
	}

	vertices(): ReadonlyMap<NodeId, CfgVertex> {
		return this.vertexInformation;
	}

	edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>> {
		return this.edgeInformation;
	}

	getVertex(id: NodeId): CfgVertex | undefined {
		return this.vertexInformation.get(id);
	}

	hasVertex(id: NodeId): boolean {
		return this.vertexInformation.has(id);
	}

	merge(other: ControlFlowGraph, forceNested = false): this {
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

export interface ControlFlowInformation extends MergeableRecord {
    returns:     NodeId[],
    breaks:      NodeId[],
    nexts:       NodeId[],
    /** intended to construct a hammock graph, with 0 exit points representing a block that should not be part of the CFG (like a comment) */
    entryPoints: NodeId[],
    /** See {@link ControlFlowInformation#entryPoints|entryPoints} */
    exitPoints:  NodeId[],
    graph:       ControlFlowGraph
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