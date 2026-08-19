/**
 * An append-only builder for a {@link ControlFlowGraph}, used while folding the AST.
 * @module
 */
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CfgEdge } from './control-flow-graph';
import { CfgVertex, ControlFlowGraph } from './control-flow-graph';

const enum BuilderOperationType {
	Vertex = 0,
	Edge   = 1,
	Merge  = 2
}

type BuilderOperation =
	| { readonly kind: BuilderOperationType.Vertex, readonly vertex: CfgVertex, readonly root: boolean }
	| { readonly kind: BuilderOperationType.Edge, readonly from: NodeId, readonly to: NodeId, readonly edge: CfgEdge }
	| { readonly kind: BuilderOperationType.Merge, readonly other: CfgBuilder, readonly nested: boolean };

/**
 * Records the vertices and edges of a control flow graph instead of building it, as the bottom-up fold would
 * copy an eager graph once per nesting level. {@link CfgBuilder#mergeWith|mergeWith()} only references the other
 * builder, {@link CfgBuilder#materialize|materialize()} replays everything once in recording order &mdash; the
 * order an eager merge produced, which the vertex order of a function definition's children relies on.
 */
export class CfgBuilder {
	private readonly operations: BuilderOperation[] = [];

	addVertex(vertex: CfgVertex, rootVertex = true): this {
		this.operations.push({ kind: BuilderOperationType.Vertex, vertex, root: rootVertex });
		return this;
	}

	addEdge(from: NodeId, to: NodeId, edge: CfgEdge): this {
		this.operations.push({ kind: BuilderOperationType.Edge, from, to, edge });
		return this;
	}

	/**
	 * Record that the other builder is part of this one, it must not be modified afterwards.
	 * @param other       - the builder to include
	 * @param forceNested - should its vertices count as nested (e.g., within a function definition)
	 */
	mergeWith(other: CfgBuilder, forceNested = false): this {
		this.operations.push({ kind: BuilderOperationType.Merge, other, nested: forceNested });
		return this;
	}

	/** The last vertex recorded for the given id, searching the merged builders only if we hold none. */
	getVertex(id: NodeId): CfgVertex | undefined {
		for(let i = this.operations.length - 1; i >= 0; i--) {
			const operation = this.operations[i];
			if(operation.kind === BuilderOperationType.Vertex) {
				if(CfgVertex.getId(operation.vertex) === id) {
					return operation.vertex;
				}
			} else if(operation.kind === BuilderOperationType.Merge) {
				const found = operation.other.getVertex(id);
				if(found !== undefined) {
					return found;
				}
			}
		}
		return undefined;
	}

	/** The ids of all vertices that are not nested, in insertion order. */
	rootIds(collected: Set<NodeId> = new Set<NodeId>()): ReadonlySet<NodeId> {
		for(const operation of this.operations) {
			if(operation.kind === BuilderOperationType.Vertex) {
				if(operation.root) {
					collected.add(CfgVertex.getId(operation.vertex));
				}
			} else if(operation.kind === BuilderOperationType.Merge && !operation.nested) {
				operation.other.rootIds(collected);
			}
		}
		return collected;
	}

	/** Replays all recorded operations into a {@link ControlFlowGraph}. */
	materialize(graph: ControlFlowGraph = new ControlFlowGraph(), nested = false): ControlFlowGraph {
		for(const operation of this.operations) {
			if(operation.kind === BuilderOperationType.Vertex) {
				graph.addVertex(operation.vertex, operation.root && !nested);
			} else if(operation.kind === BuilderOperationType.Edge) {
				graph.addEdge(operation.from, operation.to, operation.edge);
			} else {
				operation.other.materialize(graph, nested || operation.nested);
			}
		}
		return graph;
	}
}
