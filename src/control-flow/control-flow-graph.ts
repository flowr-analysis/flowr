import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { normalizeIdToNumberIfPossible } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { MergeableRecord } from '../util/objects';
import { RFalse, RTrue } from '../r-bridge/lang-4.x/convert-values';
import { assertUnreachable, guard } from '../util/assert';

/**
 * The type of a vertex in the {@link ControlFlowGraph}.
 * Please use the helper object (e.g. {@link CfgVertex#getType|getType()}) to work with vertices instead of directly accessing the properties.
 */
export enum CfgVertexType {
	/**
	 * The explicit exit-nodes to ensure the hammock property.
	 * @see {@link CfgVertex.makeEndMarker|CfgVertex.makeEndMarker()} - for a helper function to create end marker vertices
	 */
	Marker   = 0,
	/**
	 * something like an if, assignment, ... even though in the classical sense of R they are still expressions
	 * @see {@link CfgVertex.makeStm|CfgVertex.makeStm()} - for a helper function to create statement vertices
	 */
	Statement   = 1,
	/**
	 * something like an addition, ...
	 * @see {@link CfgVertex.makeExpr|CfgVertex.makeExpr()} - for a helper function to create expression vertices
	 */
	Expression  = 2,
	/**
	 * a (as far as R allows this) 'basic' block
	 * @see {@link CfgVertex.makeBlock|CfgVertex.makeBlock()} - for a helper function to create basic block vertices
	 */
	Block       = 3
}

export const enum CfgEdgeType {
	/** a flow dependency */
	Fd = 0,
	/** a control dependency */
	Cd = 1
}

/**
 * A vertex in the {@link ControlFlowGraph} that may have markers attached to it (e.g., for function calls).
 * - `type`: the type of the vertex, either a statement or an expression
 * - `id`: the id of the vertex, which should directly relate to the AST node
 * - `children`: child nodes attached to this one
 * - `callTargets`: if the vertex calls a function, this links all targets of this call
 */
type CfgBaseVertexWithMarker = [type: CfgVertexType, id: NodeId, mid?: NodeId[], end?: NodeId[], children?: NodeId[], callTargets?: Set<NodeId>];

/**
 * @see {@link CfgBaseVertexWithMarker}
 */
export type CfgStatementVertex = [CfgVertexType.Statement, ...a: unknown[]] & CfgBaseVertexWithMarker;
/**
 * @see {@link CfgBaseVertexWithMarker}
 */
export type CfgExpressionVertex = [CfgVertexType.Expression, ...a: unknown[]] & CfgBaseVertexWithMarker;
/**
 * The root id is only stored if it is not derivable from the canonical id
 * @see {@link CfgBaseVertexWithMarker}
 */
export type CfgMarkerVertex = NodeId | [CfgVertexType.Marker, ...a: unknown[]] & [type: CfgVertexType, id: NodeId, rootId?: NodeId];
/**
 * A basic block vertex in the {@link ControlFlowGraph}.
 * Contains the vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs.
 */
export type CfgBasicBlockVertex = [CfgVertexType.Block, ...a: unknown[]] & [type: CfgVertexType, id: NodeId, elems: readonly Exclude<CfgVertex, CfgBasicBlockVertex>[]];

/**
 * A vertex in the {@link ControlFlowGraph}.
 * Please use the helper object (e.g. {@link CfgVertex#getType|getType()}) to work with vertices instead of directly accessing the properties.
 */
export type CfgVertex = CfgStatementVertex | CfgExpressionVertex | CfgBasicBlockVertex | CfgMarkerVertex;

/**
 * Helper object for {@link CfgVertex} - a vertex in the {@link ControlFlowGraph} that may have markers attached to it (e.g., for function calls).
 */
export const CfgVertex = {
	/**
	 * Create a new expression vertex with the given id, children, call targets, and markers.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param children    - child nodes attached to this one
	 * @param callTargets - if the vertex calls a function, this links all targets of this call
	 * @param mid         - the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers
	 * @param end         - the ids of the end-markers attached to this vertex, which should directly relate to the AST nodes of the end markers
	 * @see {@link CfgVertex#isExpression|isExpression()} - for a way to check whether a vertex is an expression vertex
	 */
	makeExpression(this: void, id: NodeId, { children, mid, end, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId>, mid?: NodeId[], end?: NodeId[] } = {}): CfgExpressionVertex {
		if(children === undefined && callTargets === undefined) {
			if(mid === undefined && end === undefined) {
				return [CfgVertexType.Expression, id];
			} else {
				return [CfgVertexType.Expression, id, mid, end];
			}
		}
		return [CfgVertexType.Expression, id, mid, end, children, callTargets];
	},
	/**
	 * A convenience function to create a new expression vertex with a canonical end marker ({@link CfgVertex#toExitId|toExitId()}) based on the given id and the given id as root id for the end marker.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param children    - child nodes attached to this one
	 * @param callTargets - if the vertex calls a function, this links all targets of this call
	 * @param mid         - the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers
	 * @see {@link CfgVertex#makeExpression|makeExpression()} - for a way to create expression vertices with a custom end marker
	 * @see {@link CfgVertex#makeExitMarker|makeExitMarker()} - for a helper function to create end marker vertices with a canonical id#
	 * @see {@link CfgVertex#toExitId|toExitId()} - for a way to convert the given id to a canonical end marker id
	 */
	makeExpressionWithEnd(this: void, id: NodeId, { children, mid, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId>, mid?: NodeId[] } = {}): CfgExpressionVertex {
		return CfgVertex.makeExpression(id, { children, mid, end: [CfgVertex.toExitId(id)], callTargets });
	},
	/**
	 * A convenience function to create a new statement vertex with a canonical end marker ({@link CfgVertex#toExitId|toExitId()}) based on the given id and the given id as root id for the end marker.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param children    - child nodes attached to this one
	 * @param callTargets - if the vertex calls a function, this links all targets of this call
	 * @param mid         - the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers
	 * @see {@link CfgVertex#makeExpression|makeExpression()} - for a way to create expression vertices with a custom end marker
	 * @see {@link CfgVertex#makeExitMarker|makeExitMarker()} - for a helper function to create end marker vertices with a canonical id#
	 * @see {@link CfgVertex#toExitId|toExitId()} - for a way to convert the given id to a canonical end marker id
	 */
	makeStatementWithEnd(this: void, id: NodeId, { children, mid, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId>, mid?: NodeId[] } = {}): CfgStatementVertex {
		return CfgVertex.makeStatement(id, { children, mid, end: [CfgVertex.toExitId(id)], callTargets });
	},
	/**
	 * Create a new statement vertex with the given id, children, call targets, and markers.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param children    - child nodes attached to this one
	 * @param callTargets - if the vertex calls a function, this links all targets of this call
	 * @param mid         - the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers
	 * @param end         - the ids of the end-markers attached to this vertex, which should directly relate to the AST nodes of the end markers
	 * @see {@link CfgVertex#isStatement|isStatement()} - for a way to check whether a vertex is a statement vertex
	 */
	makeStatement(this: void, id: NodeId, { children, mid, end, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId>, mid?: NodeId[], end?: NodeId[] } = {}): CfgStatementVertex {
		if(children === undefined && callTargets === undefined) {
			if(mid === undefined && end === undefined) {
				return [CfgVertexType.Statement, id];
			} else {
				return [CfgVertexType.Statement, id, mid, end];
			}
		}
		return [CfgVertexType.Statement, id, mid, end, children, callTargets];
	},
	/**
	 * A convenience function to create a new vertex which is either a statement or an expression.
	 */
	makeExprOrStm(this: void, id: NodeId, type: CfgVertexType.Expression | CfgVertexType.Statement, { children, mid, end, callTargets }: { children?: NodeId[], callTargets?: Set<NodeId>, mid?: NodeId[], end?: NodeId[] } = {}): CfgExpressionVertex | CfgStatementVertex {
		if(children === undefined && callTargets === undefined) {
			if(mid === undefined && end === undefined) {
				return [type, id] as CfgExpressionVertex | CfgStatementVertex;
			} else {
				return [type, id, mid, end] as CfgExpressionVertex | CfgStatementVertex;
			}
		}
		return [type, id, mid, end, children, callTargets] as CfgExpressionVertex | CfgStatementVertex;
	},
	/**
	 * Create a new marker vertex with the given id, root id, children, and call targets.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param rootId      - the id of the AST node this end marker corresponds to
	 * @see {@link CfgVertex#isMarker|isMarker()} - for a way to check whether a vertex is an end marker vertex
	 * @see {@link CfgVertex#getRootId|getRootId()} - for a way to get the root id of an end marker vertex
	 * @see {@link CfgVertex#makeExitMarker|makeExitMarker()} - for a helper function to create end marker vertices with a canonical id
	 */
	makeMarker(this: void, id: NodeId, rootId: NodeId): CfgMarkerVertex {
		if(CfgVertex.fromExitId(id) === rootId) {
			return id;
		} else {
			return [CfgVertexType.Marker, id, rootId];
		}
	},
	/**
	 * A convenience function to create a new marker vertex with a canonical id ({@link CfgVertex#toExitId|toExitId()}) based on the given id and the given id as root id.
	 * @see {@link CfgVertex#makeMarker|makeMarker()} - for a way to create end marker vertices with a custom id
	 */
	makeExitMarker(this: void, id: NodeId): CfgMarkerVertex {
		return CfgVertex.makeMarker(CfgVertex.toExitId(id), id);
	},
	/**
	 * Create a new basic block vertex with the given id, elements, children, and call targets.
	 * @param id          - the id of the vertex, which should directly relate to the AST node
	 * @param elems       - the vertices that are part of this block, only connected by FDs, vertices should never occur in multiple bbs
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
		return Array.isArray(vertex) && vertex[0] === CfgVertexType.Expression;
	},
	/**
	 * Check whether the given vertex is a statement vertex.
	 * @see {@link CfgVertex#makeStatement|makeStatement()} - for a way to create statement vertices
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex instead of checking against a given type
	 */
	isStatement(this: void, vertex: CfgVertex | undefined): vertex is CfgStatementVertex {
		return Array.isArray(vertex) && vertex[0] === CfgVertexType.Statement;
	},
	/**
	 * Check whether the given vertex is an end marker vertex.
	 * @see {@link CfgVertex#makeMarker|makeMarker()} - for a way to create end marker vertices
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex instead of checking against a given type
	 */
	isMarker(this: void, vertex: CfgVertex | undefined): vertex is CfgMarkerVertex {
		return vertex !== undefined && (!Array.isArray(vertex) || vertex[0] === CfgVertexType.Marker);
	},
	/**
	 * Check whether the given vertex is a basic block vertex.
	 * @see {@link CfgVertex#makeBlock|makeBlock()} - for a way to create basic block vertices
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex instead of checking against a given type
	 */
	isBlock(this: void, vertex: CfgVertex | undefined): vertex is CfgBasicBlockVertex {
		return Array.isArray(vertex) && vertex[0] === CfgVertexType.Block;
	},
	/**
	 * Get the type of the given vertex.
	 * @example
	 * ```ts
	 * const vertex: CfgVertex = CfgVertex.makeExpr('node-1')
	 * console.log(CfgVertex.getType(vertex)); // Output: CfgVertexType.Expression
	 * ```
	 * @see {@link CfgVertex#isExpression|isExpression()}, {@link CfgVertex#isStatement|isStatement()}, {@link CfgVertex#isMarker|isMarker()}, {@link CfgVertex#isBlock|isBlock()} - for ways to check the type of a vertex against a specific type instead of getting the type and checking it against a specific type
	 * @see {@link CfgVertex#getId|getId()} - for a way to get the id of a vertex
	 * @see {@link CfgVertex#typeToString|typeToString()} - for a way to convert the type of a vertex to a string for easier debugging and visualization
	 */
	getType(this: void, vertex: CfgVertex): CfgVertexType {
		return Array.isArray(vertex) ? vertex[0] : CfgVertexType.Marker;
	},
	/**
	 * Convert the given vertex type to a string for easier debugging and visualization.
	 * @see {@link CfgVertexType} - for the possible vertex types
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex and convert it to a string
	 */
	typeToString(this: void, type: CfgVertexType): string {
		switch(type) {
			case CfgVertexType.Marker:
				return 'marker';
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
	 * Get the id of the given vertex, which should directly relate to the AST node.
	 * @example
	 * ```ts
	 * const vertex: CfgVertex = CfgVertex.makeExpr('node-1')
	 * console.log(CfgVertex.getId(vertex)); // Output: 'node-1'
	 * ```
	 * @see {@link CfgVertex#getType|getType()} - for a way to get the type of a vertex
	 * @see {@link CfgVertex#getRootId|getRootId()} - for a way to get the root id of a vertex
	 */
	getId<T extends CfgVertex | undefined>(this: void, vertex: T): T extends undefined ? NodeId | undefined : NodeId {
		return vertex === undefined ? undefined as never : (Array.isArray(vertex) ? vertex[1] : vertex as never);
	},
	/**
	 * Check whether two vertices are equal, i.e., they have the same type, id, and if they are basic block vertices, they also have the same elements in the same order.
	 */
	equal(this: void, a: CfgVertex, b: CfgVertex): boolean {
		if(!Array.isArray(a) || !Array.isArray(b)) {
			return a === b;
		} else if(a === b) {
			return true;
		} else if(a[0] !== b[0] || a[1] !== b[1]) {
			return false;
		} else if(a[0] === CfgVertexType.Block && b[0] === CfgVertexType.Block) {
			return a[2].length === b[2].length && a[2].every((e, i) => CfgVertex.equal(e, b[2][i]));
		} else if(a[0] === CfgVertexType.Marker && b[0] === CfgVertexType.Marker) {
			return a[2] === b[2];
		}
		return true;
	},
	/**
	 * Get the root id of a vertex, i.e., the id of the AST node it corresponds to.
	 * For normal vertices, this is the same as the id of the vertex itself, for end marker vertices, this is the root id stored in the vertex.
	 * @see {@link CfgVertex#unpackRoot|unpackRoot()} - for a way to unpack the root id of a marker vertex
	 */
	getRootId(this: void, vertex: CfgVertex): NodeId {
		return CfgVertex.isMarker(vertex) ? CfgVertex.unpackRootId(vertex) : vertex[1];
	},
	/**
	 * Unpack the root id of a marker vertex, i.e., get the root id stored in the vertex or derive it from the canonical id if it is not explicitly stored.
	 * @see {@link CfgVertex#getRootId|getRootId()} - for a way to get the root id of a vertex, which uses this function for marker vertices
	 */
	unpackRootId(this: void, vertex: CfgMarkerVertex): NodeId {
		return Array.isArray(vertex) ? vertex[2] ?? CfgVertex.fromExitId(vertex[1]) : CfgVertex.fromExitId(vertex);
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
	 * Get the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers.
	 * @see {@link CfgVertex#getMid|getMid()} - for a way to get the ids of the mid-markers attached to this vertex
	 * @see {@link CfgVertex#setEnd|setEnd()} - for a way to set the ids of the end-markers attached to this vertex
	 */
	getEnd(this: void, vertex: CfgVertex | undefined): NodeId[] | undefined {
		if(vertex === undefined) {
			return undefined;
		}
		const type = CfgVertex.getType(vertex);
		if(type === CfgVertexType.Statement || type === CfgVertexType.Expression) {
			return (vertex as CfgStatementVertex | CfgExpressionVertex)[3];
		}
		return undefined;
	},
	/**
	 * **Sets in-place**
	 * Set the ids of the end-markers attached to this vertex, which should directly relate to the AST nodes of the end markers.
	 * @see {@link CfgVertex#getEnd|getEnd()} - for a way to get the ids of the end-markers attached to this vertex
	 */
	setEnd(this: void, vertex: CfgStatementVertex | CfgExpressionVertex, endMarkers: NodeId[] | undefined): void {
		vertex[3] = endMarkers;
	},
	/**
	 * Get the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers.
	 */
	getMid(this: void, vertex: CfgVertex): NodeId[] | undefined {
		if(vertex === undefined) {
			return undefined;
		}
		const type = CfgVertex.getType(vertex);
		if(type === CfgVertexType.Statement || type === CfgVertexType.Expression) {
			return (vertex as CfgStatementVertex | CfgExpressionVertex)[2];
		}
		return undefined;
	},
	/**
	 * **Sets in-place**
	 * Set the ids of the mid-markers attached to this vertex, which should directly relate to the AST nodes of the mid markers.
	 * @see {@link CfgVertex#getMid|getMid()} - for a way to get the ids of the mid-markers attached to this vertex
	 * @see {@link CfgVertex#setEnd|setEnd()} - for a way to set the ids of the end-markers attached to this vertex
	 */
	setMid(this: void, vertex: CfgStatementVertex | CfgExpressionVertex, midMarkers: NodeId[] | undefined): void {
		vertex[2] = midMarkers;
	},
	/**
	 * Converts the given id to a, canonical, basic block lift (i.e., it adds 'bb-' as a prefix).
	 */
	toBasicBlockId<Id extends NodeId>(this: void, id: Id): `bb-${Id}` {
		return `bb-${id}`;
	},
	/**
	 * Converts the given id to a canonical, end marker lift (i.e., it adds '-end' as a suffix).
	 * @see {@link CfgVertex#fromExitId|fromExitId()} - for a way to convert the given id from a canonical end marker lift to the original id (i.e., it removes '-end' as a suffix if it is present)
	 */
	toExitId<Id extends NodeId>(this: void, id: Id): `${Id}-e` {
		return `${id}-e`;
	},
	/**
	 * Converts the given id from a canonical end marker lift to the original id (i.e., it removes '-end' as a suffix if it is present).
	 * @see {@link CfgVertex#toExitId|toExitId()} - for a way to convert the given id to a canonical end marker lift (i.e., it adds '-end' as a suffix)
	 */
	fromExitId(this: void, exitId: NodeId): NodeId {
		if(typeof exitId === 'string' && exitId.endsWith('-e')) {
			return normalizeIdToNumberIfPossible(exitId.slice(0, -2));
		} else {
			return exitId;
		}
	},
	/**
	 * Get the call targets of a statement or expression vertex, which links all targets of this call.
	 */
	getCallTargets(this: void, vertex: CfgVertex | undefined): Set<NodeId> | undefined {
		if(vertex === undefined) {
			return undefined;
		}
		const type = CfgVertex.getType(vertex);
		if(type === CfgVertexType.Statement || type === CfgVertexType.Expression) {
			return (vertex as CfgStatementVertex | CfgExpressionVertex)[5];
		}
		return undefined;
	},
	/**
	 * **Sets in-place**
	 * Set the call targets of a statement or expression vertex, which links all targets of this call.
	 * @see {@link CfgVertex#getCallTargets|getCallTargets()} - for a way to get the call targets of a statement or expression vertex
	 * @see {@link CfgVertex#mapCallTargets|mapCallTargets()} - for a way to map the call targets of a statement or expression vertex to new call targets
	 */
	setCallTargets(this: void, vertex: CfgStatementVertex | CfgExpressionVertex, callTargets: Set<NodeId>): void {
		vertex[5] = callTargets;
	},
	/**
	 * Map the call targets of a statement or expression vertex, which links all targets of this call, to new call targets using the given mapping function.
	 * @see {@link CfgVertex#getCallTargets|getCallTargets()} - for a way to get the call targets of a statement or expression vertex
	 * @see {@link CfgVertex#setCallTargets|setCallTargets()} - for a way to set the call targets of a statement or expression vertex to new call targets
	 */
	mapCallTargets(this: void, vertex:  CfgStatementVertex | CfgExpressionVertex, mapFn: (targets: Set<NodeId> | undefined) => Set<NodeId>): void {
		const currentTargets = CfgVertex.getCallTargets(vertex);
		const newTargets = mapFn(currentTargets);
		CfgVertex.setCallTargets(vertex, newTargets);
	},
	/**
	 * Get the children of a statement or expression vertex, i.e., the child nodes attached to this one.
	 */
	getChildren(this: void, vertex: CfgVertex | undefined): NodeId[] | undefined {
		if(vertex === undefined) {
			return undefined;
		}
		const type = CfgVertex.getType(vertex);
		if(type === CfgVertexType.Statement || type === CfgVertexType.Expression) {
			return (vertex as CfgStatementVertex | CfgExpressionVertex)[4];
		}
		return undefined;
	}
} as const;


type CfgFlowDependencyEdge = CfgEdgeType.Fd;
type CfgControlDependencyEdge = [c: NodeId, w: typeof RTrue | typeof RFalse];

/**
 * An edge in the {@link ControlFlowGraph}.
 * @see {@link CfgEdge} - for helper functions to work with edges.
 */
export type CfgEdge = CfgFlowDependencyEdge | CfgControlDependencyEdge;

/**
 * Helper object for {@link CfgEdge} - an edge in the {@link ControlFlowGraph}.
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
	readonly vertices:           (includeBasicBlockElements: boolean) => ReadonlyMap<NodeId, CfgVertex>
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
}

/**
 * This class represents the control flow graph of an R program.
 * The control flow may be hierarchical when confronted with function definitions (see {@link CfgVertex} and {@link CFG#rootVertexIds|rootVertexIds()}).
 *
 * There are two very simple visitors to traverse a CFG:
 * - {@link visitCfgInOrder} visits the graph in the order of the vertices
 * - {@link visitCfgInReverseOrder} visits the graph in reverse order
 *
 * If you want to prohibit modification, please refer to the {@link ReadOnlyControlFlowGraph} interface.
 */
export class ControlFlowGraph<Vertex extends CfgVertex = CfgVertex> implements ReadOnlyControlFlowGraph {
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
		const vid = CfgVertex.getId(vertex);
		guard(!this.vtxInfos.has(vid), `Node with id ${vid} already exists`);

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

	vertices(includeBasicBlockElements = true): ReadonlyMap<NodeId, CfgVertex> {
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
		return this.edgeInfos;
	}

	/**
	 * Retrieve a vertex by its id.
	 */
	getVertex(id: NodeId, includeBlocks = true): CfgVertex | undefined {
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