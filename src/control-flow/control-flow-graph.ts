import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { DataflowGraph } from '../dataflow/graph/graph';
import { NoEdges } from '../dataflow/graph/graph';
import type { DFControlFlowEdge } from '../dataflow/graph/edge';
import { ControlFlowEdgeTypes, DfEdge, EdgeType } from '../dataflow/graph/edge';
import type { ControlDependency, DataflowInformation } from '../dataflow/info';
import { ControlDependency as ControlDependencyHelper, ExitPointType  } from '../dataflow/info';
import type { DataflowGraphVertexFunctionDefinition } from '../dataflow/graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../dataflow/graph/vertex';
import { graph2quads, type QuadSerializationConfiguration } from '../util/quads';
import { ControlFlow } from '../dataflow/internal/control-flow';
import type { MergeableRecord } from '../util/objects';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { assertUnreachable, guard } from '../util/assert';
import type { AstIdMap } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RNode } from '../r-bridge/lang-4.x/ast/model/model';

/**
 * The type of a vertex in the {@link ControlFlowGraph}.
 * Please use the helper object (e.g. {@link CfgVertex#getType|getType()}) to work with vertices instead of directly accessing the properties.
 */
export enum CfgVertexType {
	/**
	 * something like an if, assignment, ... even though in the classical sense of R they are still expressions
	 * @see {@link CfgVertex.makeStatement|CfgVertex.makeStatement()} - for a helper function to create statement vertices
	 */
	Statement   = 1,
	/**
	 * something like an addition, ...
	 * @see {@link CfgVertex.makeExpression|CfgVertex.makeExpression()} - for a helper function to create expression vertices
	 */
	Expression  = 2,
	/**
	 * a (as far as R allows this) 'basic' block
	 * @see {@link CfgVertex.makeBlock|CfgVertex.makeBlock()} - for a helper function to create basic block vertices
	 */
	Block       = 3
}

export const enum CfgEdgeType {
	/** the target simply runs after the source */
	Flow = 0,
	/** the target runs after the source, but only under a {@link ControlDependency} */
	Control = 1
}

/**
 * A vertex in the {@link ControlFlowGraph}.
 * - `type`: the type of the vertex, either a statement or an expression
 * - `id`: the id of the vertex, which directly relates to the AST node and to the vertex of the same id in the {@link DataflowGraph}
 * - `children`: child nodes attached to this one
 * - `callTargets`: if the vertex calls a function, this links all targets of this call
 *
 * The control flow is modeled in post-order: a construct's own vertex is where its operands join again,
 * which is why there are no separate marker vertices to close an `if` or a loop.
 */
type CfgBaseVertex = [type: CfgVertexType, id: NodeId, children?: NodeId[], callTargets?: Set<NodeId>];

/**
 * @see {@link CfgBaseVertex}
 */
export type CfgStatementVertex = [CfgVertexType.Statement, ...a: unknown[]] & CfgBaseVertex;
/**
 * @see {@link CfgBaseVertex}
 */
export type CfgExpressionVertex = [CfgVertexType.Expression, ...a: unknown[]] & CfgBaseVertex;
/**
 * A basic block vertex in the {@link ControlFlowGraph}.
 * Contains the vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs.
 */
export type CfgBasicBlockVertex = [CfgVertexType.Block, ...a: unknown[]] & [type: CfgVertexType, id: NodeId, elems: readonly Exclude<CfgVertex, CfgBasicBlockVertex>[]];

/**
 * A vertex in the {@link ControlFlowGraph}.
 * Please use the helper object (e.g. {@link CfgVertex#getType|getType()}) to work with vertices instead of directly accessing the properties.
 */
export type CfgVertex = CfgStatementVertex | CfgExpressionVertex | CfgBasicBlockVertex;

/**
 * Helper object for {@link CfgVertex} - a vertex in the {@link ControlFlowGraph}.
 */
export const CfgVertex = {
	name: 'CfgVertex',
	/**
	 * Create a new expression vertex with the given id, children, and call targets.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param children    - child nodes attached to this one
	 * @param callTargets - if the vertex calls a function, this links all targets of this call
	 * @see {@link CfgVertex#isExpression|isExpression()} - for a way to check whether a vertex is an expression vertex
	 */
	makeExpression(this: void, id: NodeId, { children, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId> } = {}): CfgExpressionVertex {
		if(children === undefined && callTargets === undefined) {
			return [CfgVertexType.Expression, id];
		}
		return [CfgVertexType.Expression, id, children, callTargets];
	},
	/**
	 * Create a new statement vertex with the given id, children, and call targets.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param children    - child nodes attached to this one
	 * @param callTargets - if the vertex calls a function, this links all targets of this call
	 * @see {@link CfgVertex#isStatement|isStatement()} - for a way to check whether a vertex is a statement vertex
	 */
	makeStatement(this: void, id: NodeId, { children, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId> } = {}): CfgStatementVertex {
		if(children === undefined && callTargets === undefined) {
			return [CfgVertexType.Statement, id];
		}
		return [CfgVertexType.Statement, id, children, callTargets];
	},
	/**
	 * A convenience function to create a new vertex which is either a statement or an expression.
	 */
	makeExprOrStm(this: void, id: NodeId, type: CfgVertexType.Expression | CfgVertexType.Statement, { children, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId> } = {}): CfgExpressionVertex | CfgStatementVertex {
		if(children === undefined && callTargets === undefined) {
			return [type, id] as CfgExpressionVertex | CfgStatementVertex;
		}
		return [type, id, children, callTargets] as CfgExpressionVertex | CfgStatementVertex;
	},
	/**
	 * Create a new basic block vertex with the given id and elements.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param elems       - the vertices that are part of this block in the order they run, only connected by FDs; a vertex should never occur in multiple blocks
	 * @see {@link CfgVertex#isBlock|isBlock()} - for a way to check whether a vertex is a basic block vertex
	 */
	makeBlock(this: void, id: NodeId, elems: readonly Exclude<CfgVertex, CfgBasicBlockVertex>[]): CfgBasicBlockVertex {
		return [CfgVertexType.Block, id, elems];
	},
	/**
	 * Check whether the given vertex is an expression vertex.
	 * @see {@link CfgVertex#makeExpression|makeExpression()} - for a way to create expression vertices
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex instead of checking against a given type
	 */
	isExpression(this: void, vertex: CfgVertex | undefined): vertex is CfgExpressionVertex {
		return vertex !== undefined && vertex[0] === CfgVertexType.Expression;
	},
	/**
	 * Check whether the given vertex is a statement vertex.
	 * @see {@link CfgVertex#makeStatement|makeStatement()} - for a way to create statement vertices
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex instead of checking against a given type
	 */
	isStatement(this: void, vertex: CfgVertex | undefined): vertex is CfgStatementVertex {
		return vertex !== undefined && vertex[0] === CfgVertexType.Statement;
	},
	/**
	 * Check whether the given vertex is a basic block vertex.
	 * @see {@link CfgVertex#makeBlock|makeBlock()} - for a way to create basic block vertices
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex instead of checking against a given type
	 */
	isBlock(this: void, vertex: CfgVertex | undefined): vertex is CfgBasicBlockVertex {
		return vertex !== undefined && vertex[0] === CfgVertexType.Block;
	},
	/**
	 * Get the type of the given vertex.
	 * @example
	 * ```ts
	 * const vertex: CfgVertex = CfgVertex.makeExpression('node-1')
	 * console.log(CfgVertex.getType(vertex)); // Output: CfgVertexType.Expression
	 * ```
	 * @see {@link CfgVertex#isExpression|isExpression()}, {@link CfgVertex#isStatement|isStatement()}, {@link CfgVertex#isBlock|isBlock()} - for ways to check the type of a vertex against a specific type
	 * @see {@link CfgVertex#getId|getId()} - for a way to get the id of a vertex
	 * @see {@link CfgVertex#typeToString|typeToString()} - for a way to convert the type of a vertex to a string for easier debugging and visualization
	 */
	getType(this: void, vertex: CfgVertex): CfgVertexType {
		return vertex[0];
	},
	/**
	 * Convert the given vertex type to a string for easier debugging and visualization.
	 * @see {@link CfgVertexType} - for the possible vertex types
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex and convert it to a string
	 */
	typeToString(this: void, type: CfgVertexType): string {
		switch(type) {
			case CfgVertexType.Statement:
				return 'statement';
			case CfgVertexType.Expression:
				return 'expression';
			case CfgVertexType.Block:
				return 'block';
			default:
				assertUnreachable(type);
		}
	},
	/**
	 * Get the id of the given vertex, which directly relates to the AST node.
	 * @example
	 * ```ts
	 * const vertex: CfgVertex = CfgVertex.makeExpression('node-1')
	 * console.log(CfgVertex.getId(vertex)); // Output: 'node-1'
	 * ```
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex
	 */
	getId<T extends CfgVertex | undefined>(this: void, vertex: T): T extends undefined ? NodeId | undefined : NodeId {
		return (vertex === undefined ? undefined : vertex[1]) as T extends undefined ? NodeId | undefined : NodeId;
	},
	/**
	 * Check whether two vertices are equal, i.e., they have the same type, id, and if they are basic block vertices, they also have the same elements in the same order.
	 */
	equal(this: void, a: CfgVertex, b: CfgVertex): boolean {
		if(a === b) {
			return true;
		} else if(a[0] !== b[0] || a[1] !== b[1]) {
			return false;
		} else if(a[0] === CfgVertexType.Block && b[0] === CfgVertexType.Block) {
			return a[2].length === b[2].length && a[2].every((e, i) => CfgVertex.equal(e, b[2][i]));
		}
		return true;
	},
	/**
	 * Get the elements of a basic block vertex, i.e., the vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs.
	 * @see {@link CfgVertex#isBlock|isBlock()} - for a way to check whether a vertex is a basic block vertex before trying to get the elements
	 * @see {@link CfgVertex#setBasicBlockElements|setBasicBlockElements()} - for a way to set the elements of a basic block vertex
	 */
	getBasicBlockElements(this: void, vertex: CfgBasicBlockVertex): readonly Exclude<CfgVertex, CfgBasicBlockVertex>[] {
		return vertex[2];
	},
	/**
	 * **Sets in-place**
	 * Set the elements of a basic block vertex, i.e., the vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs.
	 * @see {@link CfgVertex#isBlock|isBlock()} - for a way to check whether a vertex is a basic block vertex before trying to set the elements
	 * @see {@link CfgVertex#getBasicBlockElements|getBasicBlockElements()} - for a way to get the elements of a basic block vertex
	 */
	setBasicBlockElements(this: void, vertex: CfgBasicBlockVertex, elems: readonly Exclude<CfgVertex, CfgBasicBlockVertex>[]): void {
		vertex[2] = elems;
	},
	/**
	 * Converts the given id to a, canonical, basic block lift (i.e., it adds 'bb-' as a prefix).
	 */
	toBasicBlockId<Id extends NodeId>(this: void, id: Id): `bb-${Id}` {
		return `bb-${id}`;
	},
	/**
	 * The functions a call may dispatch to, taken from the `calls` edges the dataflow analysis resolved.
	 */
	getCallTargets(this: void, vertex: CfgVertex | undefined): Set<NodeId> | undefined {
		if(vertex === undefined || vertex[0] === CfgVertexType.Block) {
			return undefined;
		}
		return (vertex)[3];
	},
	/**
	 * Get the children of a statement or expression vertex, i.e., the child nodes attached to this one.
	 */
	getChildren(this: void, vertex: CfgVertex | undefined): NodeId[] | undefined {
		if(vertex === undefined || vertex[0] === CfgVertexType.Block) {
			return undefined;
		}
		return (vertex)[2];
	}
} as const;



type CfgFlowEdge = CfgEdgeType.Flow;
/** a control edge *is* the {@link ControlDependency} it stands for, so nothing about the branch is lost */
type CfgControlEdge = ControlDependency;

/**
 * An edge in the {@link ControlFlowGraph}.
 * @see {@link CfgEdge} - for helper functions to work with edges.
 */
export type CfgEdge = CfgFlowEdge | CfgControlEdge;

/**
 * Helper object for {@link CfgEdge} - an edge in the {@link ControlFlowGraph}.
 */
export const CfgEdge = {
	name: 'CfgEdge',
	/**
	 * Check whether the given edge is a flow dependency edge.
	 */
	isFlowDependency(this: void, edge: CfgEdge | undefined): edge is CfgFlowEdge {
		return edge === CfgEdgeType.Flow;
	},
	/**
	 * Check whether the given edge is a control dependency edge.
	 */
	isControlDependency(this: void, edge: CfgEdge | undefined): edge is CfgControlEdge {
		return typeof edge === 'object';
	},
	/**
	 * Create a flow dependency edge.
	 */
	makeFd(this: void): CfgFlowEdge {
		return CfgEdgeType.Flow;
	},
	/**
	 * Create a control dependency edge from the given control dependency, which is what the edge is.
	 * @param cd - the decision the edge follows, i.e. the vertex that causes it and the outcome it takes
	 * @see {@link CfgEdge#makeCdTrue|makeCdTrue()} - to build one for a true condition from the causing id alone
	 * @see {@link CfgEdge#makeCdFalse|makeCdFalse()} - to build one for a negated condition (e.g., else-branch)
	 */
	makeCd(this: void, cd: CfgControlEdge): CfgControlEdge {
		return cd;
	},
	/**
	 * Create a control dependency edge with the given cause and a true condition.
	 * @param controlId - the id of the vertex that causes the control dependency
	 * @see {@link CfgEdge#makeCd|makeCd()} - for a version of this function that allows to specify the condition as well
	 */
	makeCdTrue(this: void, controlId: NodeId): CfgControlEdge {
		return { id: controlId, when: true };
	},
	/**
	 * Create a control dependency edge with the given cause and a negated condition (e.g., else-branch).
	 * @param controlId - the id of the vertex that causes the control dependency
	 * @see {@link CfgEdge#makeCd|makeCd()} - for a version of this function that allows to specify the condition as well
	 */
	makeCdFalse(this: void, controlId: NodeId): CfgControlEdge {
		return { id: controlId, when: false };
	},
	/**
	 * Get the cause of a control dependency edge, i.e., the id of the vertex that causes the control dependency.
	 * If the edge is not a control dependency edge, this returns undefined.
	 *
	 * This is the pendant of {@link CfgEdge#isControlDependency|isControlDependency()} on a {@link CfgEdge}.
	 * @see {@link CfgEdge#unpackCause|unpackCause()} - for a version of this function that assumes the edge is a control dependency edge and hence does not return undefined
	 */
	getCause(this: void, edge: CfgEdge): NodeId | undefined {
		if(CfgEdge.isControlDependency(edge)) {
			return edge.id;
		} else {
			return undefined;
		}
	},
	/**
	 * Get the cause of a control dependency edge, i.e., the id of the vertex that causes the control dependency.
	 */
	unpackCause(this: void, edge: CfgControlEdge): NodeId {
		return edge.id;
	},
	/**
	 * Get whether the control dependency edge is satisfied with a true condition or is it negated (e.g., else-branch).
	 * If the edge is not a control dependency edge, this returns undefined.
	 *
	 * This is the pendant of {@link CfgEdge#isControlDependency|isControlDependency()} on a {@link CfgEdge}.
	 * @see {@link CfgEdge#unpackWhen|unpackWhen()} - for a version of this function that assumes the edge is a control dependency edge and hence does not return undefined
	 */
	getWhen(this: void, edge: CfgEdge): typeof RTrue | typeof RFalse | undefined {
		if(CfgEdge.isControlDependency(edge)) {
			return edge.when ? RTrue : RFalse;
		} else {
			return undefined;
		}
	},
	/**
	 * Get whether the control dependency edge is satisfied with a true condition or is it negated (e.g., else-branch).
	 */
	unpackWhen(this: void, edge: CfgControlEdge): typeof RTrue | typeof RFalse {
		return edge.when ? RTrue : RFalse;
	},
	/**
	 * Check whether two edges are equal.
	 */
	equals(this: void, a: CfgEdge, b: CfgEdge): boolean {
		if(CfgEdge.isFlowDependency(a) && CfgEdge.isFlowDependency(b)) {
			return true;
		} else if(CfgEdge.isControlDependency(a) && CfgEdge.isControlDependency(b)) {
			return ControlDependencyHelper.same(a, b) && a.byIteration === b.byIteration;
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
		return CfgEdge.isFlowDependency(edge) ? CfgEdgeType.Flow : CfgEdgeType.Control;
	},
	/**
	 * Provide a string representation of the given edge, e.g., for debugging or visualization purposes.
	 * @see {@link CfgEdge#toString|toString()} - for a version of this function that also includes the details of the edge (e.g., cause and condition for control dependency edges)
	 */
	typeToString(this: void, edge: CfgEdge): string {
		return CfgEdge.isFlowDependency(edge) ? 'flows to' : 'branches to';
	},
	/**
	 * Provide a string representation of the given edge, including its details (e.g., cause and condition for control dependency edges), e.g., for debugging or visualization purposes.
	 * @see {@link CfgEdge#typeToString|typeToString()} - for a version of this function that only includes the type of the edge
	 */
	toString(this: void, edge: CfgEdge): string {
		return CfgEdge.isFlowDependency(edge) ? 'flows to' : `branch on ${edge.id} if ${edge.when ? 'T' : 'F'}`;
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
	 * @see {@link ReadOnlyControlFlowGraph#rootIds|rootIds()} - for a way to get the root vertices of the graph.
	 * @see {@link ReadOnlyControlFlowGraph#getVertex|getVertex()} - for a way to get a specific vertex by its id.
	 * @see {@link ReadOnlyControlFlowGraph#edges|edges()} - for a way to get all edges in the graph.
	 */
	readonly vertices:           (includeBasicBlockElements: boolean) => ReadonlyMap<NodeId, CfgVertex>
	/**
	 * Get all edges in the graph, independent of their sources and targets.
	 * Edges are in flow order: an edge from `a` to `b` means that `b` is evaluated after `a`.
	 * If you are only interested in the edges of a specific node, please use {@link ReadOnlyControlFlowGraph#outgoingEdges|outgoingEdges()} or {@link ReadOnlyControlFlowGraph#ingoingEdges|ingoingEdges()}.
	 *
	 * This is the pendant of {@link DataflowGraph#edges|edges()} on a {@link DataflowGraph}.
	 */
	readonly edges:              () => ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>>
	/**
	 * The edges leaving the given vertex, i.e. what may be evaluated after it.
	 * @see {@link ReadOnlyControlFlowGraph#ingoingEdges|ingoingEdges()} - for what may be evaluated before it
	 * @see {@link ReadOnlyControlFlowGraph#successors|successors()} - if you only need the ids
	 */
	readonly outgoingEdges:      (id: NodeId) => ReadonlyMap<NodeId, CfgEdge> | undefined
	/**
	 * The edges leading into the given vertex, i.e. what may be evaluated before it.
	 * @see {@link ReadOnlyControlFlowGraph#outgoingEdges|outgoingEdges()} - for what may be evaluated after it
	 * @see {@link ReadOnlyControlFlowGraph#predecessors|predecessors()} - if you only need the ids
	 */
	readonly ingoingEdges:       (id: NodeId) => ReadonlyMap<NodeId, CfgEdge> | undefined
	/**
	 * Retrieve a vertex by its id.
	 * @param id - the id of the vertex to retrieve
	 * @param includeBlocks - if true, the elements of basic block elements are included in the result, otherwise this will only the basic blocks themselves
	 *
	 * This is the pendant of {@link DataflowGraph#getVertex|getVertex()} on a {@link DataflowGraph}.
	 */
	readonly getVertex:          (id: NodeId, includeBlocks?: boolean) => CfgVertex | undefined
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
	/**
	 * The vertices control flow may reach directly from `id`, i.e. what may be evaluated next.
	 *
	 * Prefer this over walking the edges by hand: a graph that is a view on another structure
	 * (see {@link ControlFlowGraph}) may answer it without projecting itself at all.
	 * @see {@link ReadOnlyControlFlowGraph#predecessors|predecessors()} - for the other direction
	 */
	readonly successors:         (id: NodeId) => Iterable<NodeId>
	/**
	 * The vertices control flow may come from to reach `id`, i.e. what may have been evaluated before.
	 * @see {@link ReadOnlyControlFlowGraph#successors|successors()} - for the other direction
	 */
	readonly predecessors:       (id: NodeId) => Iterable<NodeId>
	/**
	 * The dataflow graph this control flow graph is a view of, `undefined` once it holds a copy of its own.
	 * It knows the ast as well, so a traversal needs nothing but the control flow to reach either.
	 */
	readonly dataflow:           () => DataflowGraph | undefined
	/**
	 * The vertices nested within the given one, which for a function definition is the body it holds.
	 * Nothing flows into such a region, so this is the only way a traversal can step into it.
	 */
	readonly childrenOf:         (id: NodeId) => readonly NodeId[] | undefined
	/**
	 * The constructs whose outcome this vertex decides, e.g. the `if` a condition belongs to.
	 *
	 * Since a construct is reached only once its parts have run, standing on the condition is the moment
	 * to ask what that condition is for.
	 * @example
	 * ```r
	 * if(u) a else b # decides(u) names the if, so `u` is known to be its condition
	 * ```
	 * @see {@link ReadOnlyControlFlowGraph#entryOf|entryOf()} - for the way back, from the construct to its condition
	 */
	readonly decides:            (id: NodeId) => readonly NodeId[]
	/**
	 * The vertex a construct is over at, i.e. where its branches join and control flow continues past it.
	 *
	 * The control flow is modeled in post-order: everything a construct is made of is evaluated before the
	 * construct itself, so an `if` is over on the `if` vertex, a loop on its loop vertex, and `2 * 3` on the
	 * `*` vertex. There is no separate marker to look for &mdash; reaching the vertex *is* the construct ending.
	 * @see {@link ReadOnlyControlFlowGraph#entryOf|entryOf()} - for where it begins instead
	 */
	readonly exitOf:             (id: NodeId) => NodeId
	/**
	 * The vertex control flow enters the construct rooted at `id` at, i.e. the first thing it evaluates.
	 * For `if(u) a else b` that is the condition, for `2 * 3` the left operand, and for a leaf the leaf itself.
	 *
	 * `undefined` if the construct is not part of the control flow at all.
	 * @param id    - the construct to look at
	 * @param idMap - the AST the graph belongs to; a graph that knows its own (a view on a dataflow graph) may omit it
	 * @see {@link ReadOnlyControlFlowGraph#exitOf|exitOf()} - for where it is over
	 */
	readonly entryOf:            (id: NodeId, idMap?: AstIdMap) => NodeId | undefined
}

/** Shared empty result so navigating a vertex without neighbors allocates nothing. */
export const NoNeighbors: readonly NodeId[] = [];

/**
 * This class represents the control flow graph of an R program.
 * The control flow may be hierarchical when confronted with function definitions (see {@link CfgVertex} and {@link ControlFlowGraph#rootIds|rootIds()}).
 *
 * Edges are in flow order: an edge from `a` to `b` means that `b` is evaluated after `a`.
 * Reading them backwards (what leads into a vertex) goes through a reverse index built on the first such read.
 *
 * There are two very simple visitors to traverse a CFG:
 * - {@link visitCfgInOrder} visits it in the order the program runs
 * - {@link visitCfgInReverseOrder} visits it in the opposite order
 *
 * If you want to prohibit modification, please refer to the {@link ReadOnlyControlFlowGraph} interface.
 */
export class ControlFlowGraph<Vertex extends CfgVertex = CfgVertex> implements ReadOnlyControlFlowGraph {
	/**
	 * The dataflow graph this control flow graph is a view on, if it is one.
	 * Reads are answered from it directly; the state below is only filled in when the graph is modified
	 * (see {@link ControlFlowGraph#materialize|materialize()}).
	 */
	private readonly dfg?:         DataflowGraph;
	/** whether the state below has been filled in from {@link ControlFlowGraph#dfg|dfg} already */
	private projected =            false;
	/** the root ids of a view, which stay the same as long as it is one */
	private rootCache?:            Set<NodeId>;
	protected readonly roots:      Set<NodeId> = new Set<NodeId>();
	/** Nesting-Independent vertex information, mapping the id to the vertex */
	protected readonly vtxInfos:   Map<NodeId, Vertex> = new Map<NodeId, Vertex>();
	/** the basic block children map contains a mapping of ids to all vertices that are nested in basic blocks, mapping them to the Id of the block they appear in */
	protected readonly bbChildren: Map<NodeId, NodeId> = new Map<NodeId, NodeId>();
	/** basic block agnostic edges, in flow order: `edgeInfos[a][b]` means that `b` is evaluated after `a` */
	protected readonly edgeInfos:  Map<NodeId, Map<NodeId, CfgEdge>> = new Map<NodeId, Map<NodeId, CfgEdge>>();
	/** reverse edges for bidirectional mapping, derived from `edgeInfos` on the first ingoing lookup */
	protected revEdgeInfos:        Map<NodeId, Map<NodeId, CfgEdge>> | undefined;
	/** used as an optimization to avoid unnecessary lookups */
	protected _mayBB = false;

	/**
	 * A control flow graph either owns its vertices and edges, or is a view on the {@link DataflowGraph} that
	 * carries them: the dataflow extraction records the control flow while it walks the program, so every
	 * vertex of that graph is a vertex here and its {@link EdgeType.FlowEdge|flow} and
	 * {@link EdgeType.ControlEdge|control} dependency edges are the edges here.
	 * @param dfg - the dataflow graph to view, or nothing to build a graph of your own
	 */
	constructor(dfg?: DataflowGraph) {
		/* without the AST there is no way to tell a vertex of the program from one the analysis synthesized */
		guard(dfg === undefined || dfg.idMap !== undefined, 'a control flow graph can only view a dataflow graph that knows its AST');
		this.dfg = dfg;
	}

	/**
	 * Fill the state of this graph from the dataflow graph it views.
	 * Reading a view does not need this &mdash; the reads below are answered from the dataflow graph &mdash; but
	 * modifying one does, and so does asking for every vertex or edge at once.
	 */
	protected materialize(): void {
		if(this.dfg === undefined || this.projected) {
			return;
		}
		/* set first so that anything the projection itself asks of this graph does not re-enter it */
		this.projected = true;
		for(const [id] of this.dfg.vertices(true)) {
			if(!isControlFlowVertex(this.dfg, id)) {
				continue;
			}
			this.vtxInfos.set(id, makeCfgVertex(this.dfg, id) as Vertex);
			if(this.dfg.isRoot(id)) {
				this.roots.add(id);
			}
		}
		/* both graphs record the control flow in the order it runs, so the edges carry straight over */
		for(const [from, targets] of this.dfg.edges()) {
			for(const [to, edge] of targets) {
				const cfgEdge = toCfgEdge(edge);
				if(cfgEdge === undefined) {
					continue;
				}
				const after = this.edgeInfos.get(from);
				if(after === undefined) {
					this.edgeInfos.set(from, new Map([[to, cfgEdge]]));
				} else {
					after.set(to, cfgEdge);
				}
			}
		}
	}

	/**
	 * Serializing a graph hands out its vertices and edges, never the dataflow graph a view reads them from,
	 * so a view and a graph of its own serialize alike.
	 */
	toJSON(): unknown {
		this.materialize();
		return {
			roots:              this.roots,
			vtxInfos:           this.vtxInfos,
			bbChildren:         this.bbChildren,
			edgeInfos:          this.edgeInfos,
			mayHaveBasicBlocks: this._mayBB
		};
	}

	/** Whether this graph still answers from the dataflow graph it views instead of a copy of it. */
	private get isView(): boolean {
		return this.dfg !== undefined && !this.projected;
	}


	/**
	 * Add a new vertex to the control flow graph.
	 * @see {@link ControlFlowGraph#addEdge|addEdge()} - to add an edge
	 */
	addVertex(vertex: Vertex, rootVertex = true): this {
		this.materialize();
		const vid = CfgVertex.getId(vertex);

		if(CfgVertex.isBlock(vertex)) {
			this._mayBB = true;
			const elems = CfgVertex.getBasicBlockElements(vertex);
			if(elems.some(e => {
				const eid = CfgVertex.getId(e);
				return this.bbChildren.has(eid) || this.roots.has(eid);
			})) {
				throw new Error(`Vertex ${vid} contains vertices that are already part of the graph`);
			}
			for(const elem of elems) {
				this.bbChildren.set(CfgVertex.getId(elem), vid);
			}
		}

		this.vtxInfos.set(vid, vertex);

		if(rootVertex) {
			this.roots.add(vid);
		}
		return this;
	}

	/**
	 * Add a new edge to the control flow graph, in flow order: `to` is evaluated after `from`.
	 * @see {@link ControlFlowGraph#addVertex|addVertex()} - to add vertices
	 * @see {@link ControlFlowGraph#addEdges|addEdges()} - to add multiple edges at once
	 */
	addEdge(from: NodeId, to: NodeId, edge: CfgEdge): this {
		this.materialize();
		const edgesFrom = this.edgeInfos.get(from);
		if(!edgesFrom) {
			this.edgeInfos.set(from, new Map<NodeId, CfgEdge>([[to, edge]]));
		} else {
			edgesFrom.set(to, edge);
		}

		if(this.revEdgeInfos) {
			const edgesTo = this.revEdgeInfos.get(to);
			if(!edgesTo) {
				this.revEdgeInfos.set(to, new Map<NodeId, CfgEdge>([[from, edge]]));
			} else {
				edgesTo.set(from, edge);
			}
		}
		return this;
	}

	private reverse(): Map<NodeId, Map<NodeId, CfgEdge>> {
		if(this.revEdgeInfos === undefined) {
			this.revEdgeInfos = new Map<NodeId, Map<NodeId, CfgEdge>>();
			for(const [from, edges] of this.edgeInfos) {
				for(const [to, edge] of edges) {
					const edgesTo = this.revEdgeInfos.get(to);
					if(!edgesTo) {
						this.revEdgeInfos.set(to, new Map<NodeId, CfgEdge>([[from, edge]]));
					} else {
						edgesTo.set(from, edge);
					}
				}
			}
		}
		return this.revEdgeInfos;
	}

	/**
	 * Add multiple edges from a given source vertex to the control flow graph.
	 */
	addEdges(from: NodeId, to: Map<NodeId, CfgEdge>): this {
		this.materialize();
		for(const [toNode, edge] of to) {
			this.addEdge(from, toNode, edge);
		}
		return this;
	}

	outgoingEdges(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		if(this.isView) {
			return controlFlowEdges((this.dfg as DataflowGraph).outgoingEdges(node));
		}
		return this.edgeInfos.get(node);
	}

	ingoingEdges(node: NodeId): ReadonlyMap<NodeId, CfgEdge> | undefined {
		if(this.isView) {
			return controlFlowEdges((this.dfg as DataflowGraph).ingoingEdges(node));
		}
		return this.reverse().get(node);
	}

	rootIds(): ReadonlySet<NodeId> {
		if(this.isView) {
			const dfg = this.dfg as DataflowGraph;
			if(this.rootCache === undefined) {
				this.rootCache = new Set<NodeId>();
				for(const id of dfg.rootIds()) {
					if(isControlFlowVertex(dfg, id)) {
						this.rootCache.add(id);
					}
				}
			}
			return this.rootCache;
		}
		return this.roots;
	}

	vertices(includeBasicBlockElements = true): ReadonlyMap<NodeId, CfgVertex> {
		this.materialize();
		if(includeBasicBlockElements) {
			const all = new Map<NodeId, CfgVertex>(this.vtxInfos);
			for(const [id, block] of this.bbChildren.entries()) {
				const blockVertex = all.get(block);
				if(blockVertex === undefined || !CfgVertex.isBlock(blockVertex)) {
					continue;
				}
				const elems = CfgVertex.getBasicBlockElements(blockVertex);
				const elem = elems.find(e => CfgVertex.getId(e) === id);
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
		if(this.isView) {
			return undefined;
		}
		const block = this.bbChildren.get(elemId);
		if(block === undefined) {
			return undefined;
		}
		const blockVertex = this.vtxInfos.get(block);
		if(blockVertex === undefined || !CfgVertex.isBlock(blockVertex)) {
			return undefined;
		}
		return blockVertex;
	}

	edges(): ReadonlyMap<NodeId, ReadonlyMap<NodeId, CfgEdge>> {
		this.materialize();
		return this.edgeInfos;
	}

	/**
	 * Retrieve a vertex by its id.
	 */
	getVertex(id: NodeId, includeBlocks = true): CfgVertex | undefined {
		if(this.isView) {
			const dfg = this.dfg as DataflowGraph;
			return isControlFlowVertex(dfg, id) ? makeCfgVertex(dfg, id) : undefined;
		}
		const res = this.vtxInfos.get(id);
		if(res || !includeBlocks) {
			return res;
		}
		const block = this.bbChildren.get(id);
		if(block === undefined) {
			return undefined;
		}
		const blockVertex = this.vtxInfos.get(block);
		if(blockVertex === undefined || !CfgVertex.isBlock(blockVertex)) {
			return undefined;
		}
		const elems = CfgVertex.getBasicBlockElements(blockVertex);
		return elems.find(e => CfgVertex.getId(e) === id);
	}

	hasVertex(id: NodeId, includeBlocks = true): boolean {
		if(this.isView) {
			return isControlFlowVertex(this.dfg as DataflowGraph, id);
		}
		return this.vtxInfos.has(id) || (this._mayBB && includeBlocks && this.bbChildren.has(id));
	}

	mayHaveBasicBlocks(): boolean {
		/* a view has none; only the pass that introduces them creates any, and modifying projects first */
		return !this.isView && this._mayBB;
	}

	dataflow(): DataflowGraph | undefined {
		return this.isView ? this.dfg : undefined;
	}

	childrenOf(id: NodeId): readonly NodeId[] | undefined {
		if(this.isView) {
			const vertex = (this.dfg as DataflowGraph).getVertex(id);
			return FunctionDefinitionVertex.is(vertex) ? bodyOf(vertex) : undefined;
		}
		return CfgVertex.getChildren(this.getVertex(id));
	}

	decides(id: NodeId): readonly NodeId[] {
		let result: NodeId[] | undefined = undefined;
		for(const [, edge] of this.outgoingEdges(id) ?? NoEdges) {
			if(CfgEdge.isControlDependency(edge) && !result?.includes(edge.id)) {
				(result ??= []).push(edge.id);
			}
		}
		return result ?? NoNeighbors;
	}

	exitOf(id: NodeId): NodeId {
		/* everything the construct is made of runs before it, so the construct is over on its own vertex */
		return id;
	}

	entryOf(id: NodeId, idMap: AstIdMap | undefined = this.dfg?.idMap): NodeId | undefined {
		const node = idMap?.get(id);
		if(node === undefined) {
			return this.hasVertex(id) ? id : undefined;
		}
		/* the construct starts at the one vertex within it that nothing inside it leads to */
		const within = RNode.collectAllIds(node);
		let entry: NodeId | undefined = undefined;
		for(const candidate of within) {
			if(!this.hasVertex(candidate)) {
				continue;
			}
			let reachedFromWithin = false;
			for(const previous of this.predecessors(candidate)) {
				if(within.has(previous)) {
					reachedFromWithin = true;
					break;
				}
			}
			if(!reachedFromWithin) {
				entry = candidate;
				break;
			}
		}
		return entry;
	}

	successors(id: NodeId): Iterable<NodeId> {
		if(this.isView) {
			return controlFlowNeighbors((this.dfg as DataflowGraph).outgoingEdges(id));
		}
		return this.edgeInfos.get(id)?.keys() ?? NoNeighbors;
	}

	predecessors(id: NodeId): Iterable<NodeId> {
		if(this.isView) {
			return controlFlowNeighbors((this.dfg as DataflowGraph).ingoingEdges(id));
		}
		return this.reverse().get(id)?.keys() ?? NoNeighbors;
	}

	/**
	 * This removes the vertex and all edges to and from it.
	 * @param id - the id of the vertex to remove
	 * @see {@link ControlFlowGraph#addVertex|addVertex()} - to add a vertex
	 * @see {@link ControlFlowGraph#removeEdge|removeEdge()} - to remove a specific edge
	 */
	removeVertex(id: NodeId): this {
		this.materialize();
		const rev = this.reverse();
		for(const to of this.edgeInfos.get(id)?.keys() ?? []) {
			rev.get(to)?.delete(id);
		}
		for(const from of rev.get(id)?.keys() ?? []) {
			this.edgeInfos.get(from)?.delete(id);
		}
		this.vtxInfos.delete(id);
		this.edgeInfos.delete(id);
		rev.delete(id);
		this.bbChildren.delete(id);
		// remove all bbChildren with id as target
		for(const [a, b] of this.bbChildren.entries()) {
			if(b === id) {
				this.bbChildren.delete(a);
			}
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
		this.materialize();
		const edgesFrom = this.edgeInfos.get(from);
		if(edgesFrom) {
			edgesFrom.delete(to);
			if(edgesFrom.size === 0) {
				this.edgeInfos.delete(from);
			}
		}
		const edgesTo = this.revEdgeInfos?.get(to);
		if(edgesTo) {
			edgesTo.delete(from);
			if(edgesTo.size === 0) {
				this.revEdgeInfos?.delete(to);
			}
		}
		return this;
	}


	/** merges b into a */
	mergeTwoBasicBlocks(
		a: NodeId,
		b: NodeId
	): this {
		this.materialize();
		const aVertex = this.getVertex(a);
		const bVertex = this.getVertex(b);
		if(!aVertex || !bVertex || !CfgVertex.isBlock(aVertex) || !CfgVertex.isBlock(bVertex)) {
			return this;
		}

		const bElems = CfgVertex.getBasicBlockElements(bVertex);

		CfgVertex.setBasicBlockElements(aVertex, [...CfgVertex.getBasicBlockElements(aVertex), ...bElems]);
		// update cache
		for(const elem of bElems) {
			this.bbChildren.set(CfgVertex.getId(elem), a);
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
	 * **This Operation is in-place and modifies the current graph.**
	 * Merge another control flow graph into this one.
	 * @param other - the other control flow graph to merge into this one
	 * @param forceNested - should the other graph be assumed to be fully nested (e.g., within a function definition).
	 *
	 * This is the pendant of {@link DataflowGraph#mergeWith|mergeWith()} on a {@link DataflowGraph}.
	 */
	mergeWith(other: ControlFlowGraph<Vertex>, forceNested = false): this {
		this.materialize();
		/* the other graph may be a projection that has not been asked for anything yet */
		other.materialize();
		this._mayBB ||= other._mayBB;

		const roots = other.roots;
		if(this._mayBB) {
			for(const [id, node] of other.vtxInfos) {
				this.addVertex(node, !forceNested && roots.has(id));
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
export interface ControlFlowInformation<Vertex extends CfgVertex = CfgVertex> extends MergeableRecord {
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

/**
 * Whether the given id is part of the control flow.
 * A vertex the analysis synthesized (e.g. the call a higher-order function makes to a closure handed to it)
 * stands for no point in the program, so the control flow does not pass through it; what it stands for is
 * reachable through the `calls` edges instead.
 */
function isControlFlowVertex(dfg: DataflowGraph, id: NodeId): boolean {
	return dfg.hasVertex(id) && dfg.idMap?.get(id) !== undefined;
}

/** The control flow part of the given edges, or `undefined` if none of them carries any. */
function controlFlowEdges(edges: ReadonlyMap<NodeId, DfEdge> | undefined): ReadonlyMap<NodeId, CfgEdge> | undefined {
	let result: Map<NodeId, CfgEdge> | undefined = undefined;
	for(const [id, edge] of edges ?? NoEdges) {
		const cfgEdge = toCfgEdge(edge);
		if(cfgEdge !== undefined) {
			result ??= new Map();
			result.set(id, cfgEdge);
		}
	}
	return result;
}

/** The ids among the given edges that the control flow actually connects. */
function controlFlowNeighbors(edges: ReadonlyMap<NodeId, DfEdge> | undefined): readonly NodeId[] {
	if(edges === undefined) {
		return NoNeighbors;
	}
	const result: NodeId[] = [];
	for(const [id, edge] of edges) {
		if(DfEdge.includesType(edge, ControlFlowEdgeTypes)) {
			result.push(id);
		}
	}
	return result;
}

/** Where a function body begins, which is the only way into that region. */
function bodyOf(vertex: DataflowGraphVertexFunctionDefinition): NodeId[] {
	return [vertex.subflow.cfgEntry ?? vertex.subflow.entryPoint];
}

/** The control flow part of a dataflow edge, or `undefined` if it carries none. */
function toCfgEdge(edge: DfEdge): CfgEdge | undefined {
	if(DfEdge.includesType(edge, EdgeType.ControlEdge)) {
		return CfgEdge.makeCd((edge as DFControlFlowEdge).cd);
	} else if(DfEdge.includesType(edge, EdgeType.FlowEdge)) {
		return CfgEdge.makeFd();
	}
	return undefined;
}

function makeCfgVertex(dfg: DataflowGraph, id: NodeId): CfgVertex {
	const type = ControlFlow.isStatement(dfg, id) ? CfgVertexType.Statement : CfgVertexType.Expression;
	const vertex = dfg.getVertex(id);
	if(FunctionDefinitionVertex.is(vertex)) {
		/*
		 * The body is a region of its own: evaluating the definition produces the closure and does not run it,
		 * so nothing flows from here into the body. Naming the body as children is what lets a traversal step
		 * into the function when it wants to, without inventing an edge that does not exist.
		 */
		return CfgVertex.makeExprOrStm(id, type, { children: bodyOf(vertex) });
	}
	const callTargets = collectCallTargets(dfg, id);
	return CfgVertex.makeExprOrStm(id, type, callTargets ? { callTargets } : {});
}


/**
 * The functions a call may dispatch to, taken from the `calls` edges the dataflow analysis resolved.
 * Keeping the interprocedural links on those edges is what lets the control flow stay intra-procedural
 * while still naming what a call reaches.
 */
function collectCallTargets(dfg: DataflowGraph, id: NodeId): Set<NodeId> | undefined {
	const vertex = dfg.getVertex(id);
	if(!FunctionCallVertex.is(vertex)) {
		return undefined;
	}
	let targets: Set<NodeId> | undefined = undefined;
	for(const [target, edge] of dfg.outgoingEdges(id) ?? NoEdges) {
		/* a built-in has no definition in the source, so there is nothing for the control flow to point at */
		if(DfEdge.includesType(edge, EdgeType.Calls) && !NodeId.isBuiltIn(target)) {
			targets ??= new Set<NodeId>();
			targets.add(target);
		}
	}
	return targets;
}

/**
 * The control flow of the program the given dataflow analysis describes.
 * @see {@link ControlFlowGraph} - for the projection this is built on
 */

/**
 *
 */
export function extractCfg(dataflow: DataflowInformation): ControlFlowInformation {
	const returns: NodeId[] = [];
	const breaks: NodeId[] = [];
	const nexts: NodeId[] = [];
	const exitPoints: NodeId[] = [];
	for(const exit of dataflow.exitPoints) {
		switch(exit.type) {
			case ExitPointType.Return:
				returns.push(exit.nodeId);
				break;
			case ExitPointType.Break:
				breaks.push(exit.nodeId);
				break;
			case ExitPointType.Next:
				nexts.push(exit.nodeId);
				break;
			default:
				exitPoints.push(exit.nodeId);
				break;
		}
	}
	if(dataflow.cfgExit !== undefined) {
		exitPoints.length = 0;
		exitPoints.push(dataflow.cfgExit);
	} else {
		/* this is the whole program, so a jump still unclaimed here is one no function or loop encloses: it leaves
		   the program, whether with a value as a top-level `return` does or with an error as `break` does */
		exitPoints.push(...returns, ...breaks, ...nexts);
	}
	const graph = new ControlFlowGraph(dataflow.graph);
	const entry = ControlFlow.entryOf(dataflow);
	return {
		graph,
		/* a program without a single statement (only comments, say) has nothing to enter or leave */
		entryPoints: graph.hasVertex(entry) ? [entry] : [],
		exitPoints:  [...new Set(exitPoints)].filter(e => graph.hasVertex(e)),
		returns,
		breaks,
		nexts
	};
}

/**
 * Convert a cfg to RDF quads.
 * @see {@link df2quads}
 * @see {@link serialize2quads}
 * @see {@link graph2quads}
 */
export function cfg2quads(cfg: ControlFlowInformation, config: QuadSerializationConfiguration): string {
	return graph2quads({
		rootIds:  [...cfg.graph.rootIds()],
		vertices: [...cfg.graph.vertices().entries()]
			.map(([id, v]) => ({
				id,
				children: CfgVertex.getChildren(v)
			})),
		edges: [...cfg.graph.edges()].flatMap(([fromId, targets]) =>
			[...targets].map(([toId, info]) => ({
				from: fromId,
				to:   toId,
				type: CfgEdge.getType(info),
				when: CfgEdge.getWhen(info)
			}))
		),
		entryPoints: cfg.entryPoints,
		exitPoints:  cfg.exitPoints,
		breaks:      cfg.breaks,
		nexts:       cfg.nexts,
		returns:     cfg.returns
	},
	config
	);
}
