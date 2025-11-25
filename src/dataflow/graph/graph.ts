import { guard } from '../../util/assert';
import type { DataflowGraphEdge, EdgeType } from './edge';
import type { DataflowInformation } from '../info';
import { equalFunctionArguments } from './diff-dataflow-graph';
import {
	type DataflowGraphVertexArgument,
	type DataflowGraphVertexFunctionCall,
	type DataflowGraphVertexFunctionDefinition,
	type DataflowGraphVertexInfo,
	type DataflowGraphVertices,
	VertexType
} from './vertex';
import { uniqueArrayMerge } from '../../util/collections/arrays';
import { EmptyArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import type { Identifier, IdentifierDefinition, IdentifierReference } from '../environments/identifier';
import { type NodeId, normalizeIdToNumberIfPossible } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type IEnvironment, type REnvironmentInformation } from '../environments/environment';
import type { AstIdMap } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { cloneEnvironmentInformation } from '../environments/clone';
import { jsonReplacer } from '../../util/json';
import { dataflowLogger } from '../logger';
import type { LinkTo } from '../../queries/catalog/call-context-query/call-context-query-format';
import type { Writable } from 'ts-essentials';
import type { BuiltInMemory } from '../environments/built-in';

/**
 * Describes the information we store per function body.
 * The {@link DataflowFunctionFlowInformation#exitPoints} are stored within the enclosing {@link DataflowGraphVertexFunctionDefinition} vertex.
 */
export type DataflowFunctionFlowInformation = Omit<DataflowInformation, 'graph' | 'exitPoints'>  & { graph: Set<NodeId> }

/**
 * A reference with a name, e.g. `a` and `b` in the following function call:
 *
 * ```r
 * foo(a = 3, b = 2)
 * ```
 * @see #isNamedArgument
 * @see PositionalFunctionArgument
 */
export interface NamedFunctionArgument extends IdentifierReference {
	readonly name: string
}

/**
 * A reference which does not have a name, like the references to the arguments `3` and `2` in the following:
 *
 * ```r
 * foo(3, 2)
 * ```
 * @see #isPositionalArgument
 * @see NamedFunctionArgument
 */
export interface PositionalFunctionArgument extends Omit<IdentifierReference, 'name'> {
	readonly name?: undefined
}

/** Summarizes either named (`foo(a = 3, b = 2)`), unnamed (`foo(3, 2)`), or empty (`foo(,)`) arguments within a function. */
export type FunctionArgument = NamedFunctionArgument | PositionalFunctionArgument | typeof EmptyArgument

/**
 * Check if the given argument is a {@link PositionalFunctionArgument}.
 */
export function isPositionalArgument(arg: FunctionArgument): arg is PositionalFunctionArgument {
	return arg !== EmptyArgument && arg.name === undefined;
}

/**
 * Check if the given argument is a {@link NamedFunctionArgument}.
 */
export function isNamedArgument(arg: FunctionArgument): arg is NamedFunctionArgument {
	return arg !== EmptyArgument && arg.name !== undefined;
}

/**
 * Returns the reference of a non-empty argument.
 */
export function getReferenceOfArgument(arg: FunctionArgument): NodeId | undefined {
	if(arg !== EmptyArgument) {
		return arg?.nodeId;
	}
	return undefined;
}

/**
 * A reference that is enough to indicate start and end points of an edge within the dataflow graph.
 */
type ReferenceForEdge = Pick<IdentifierReference, 'nodeId' | 'controlDependencies'>  | IdentifierDefinition


/**
 * Maps the edges target to the edge information
 */
export type OutgoingEdges<Edge extends DataflowGraphEdge = DataflowGraphEdge> = Map<NodeId, Edge>
/**
 * Similar to {@link OutgoingEdges}, but inverted regarding the edge direction.
 * In other words, it maps the source to the edge information.
 */
export type IngoingEdges<Edge extends DataflowGraphEdge = DataflowGraphEdge> = Map<NodeId, Edge>

/**
 * The structure of the serialized {@link DataflowGraph}.
 */
export interface DataflowGraphJson {
	readonly rootVertices:      NodeId[],
	readonly vertexInformation: [NodeId, DataflowGraphVertexInfo][],
	readonly edgeInformation:   [NodeId, [NodeId, DataflowGraphEdge][]][]
}

/**
 * An unknown side effect describes something that we cannot handle correctly (in all cases).
 * For example, `load` will be marked as an unknown side effect as we have no idea of how it will affect the program.
 * Linked side effects are used whenever we know that a call may be affected by another one in a way that we cannot
 * grasp from the dataflow perspective (e.g., an indirect dependency based on the currently active graphic device).
 */
export type UnknownSideEffect = NodeId | { id: NodeId, linkTo: LinkTo<RegExp> }

/**
 * The dataflow graph holds the dataflow information found within the given AST.
 * We differentiate the directed edges in {@link EdgeType} and the vertices indicated by {@link DataflowGraphVertexArgument}
 *
 * The vertices of the graph are organized in a hierarchical fashion, with a function-definition node containing the node ids of its subgraph.
 * However, all *edges* are hoisted at the top level in the form of an (attributed) adjacency list.
 * After the dataflow analysis, all sources and targets of the edges *must* be part of the vertices.
 * However, this does not have to hold during the construction as edges may point from or to vertices which are yet to be constructed.
 *
 * All methods return the modified graph to allow for chaining.
 * @see {@link DataflowGraph#addEdge|`addEdge`} - to add an edge to the graph
 * @see {@link DataflowGraph#addVertex|`addVertex`} - to add a vertex to the graph
 * @see {@link DataflowGraph#fromJson|`fromJson`} - to construct a dataflow graph object from a deserialized JSON object.
 * @see {@link emptyGraph|`emptyGraph`} - to create an empty graph (useful in tests)
 */
export class DataflowGraph<
	Vertex extends DataflowGraphVertexInfo = DataflowGraphVertexInfo,
	Edge   extends DataflowGraphEdge       = DataflowGraphEdge
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

	/**
	 * Get the {@link DataflowGraphVertexInfo} attached to a node as well as all outgoing edges.
	 * @param id                      - The id of the node to get
	 * @param includeDefinedFunctions - If true this will search function definitions as well and not just the toplevel
	 * @returns the node info for the given id (if it exists)
	 * @see #getVertex
	 */
	public get(id: NodeId, includeDefinedFunctions = true): [Vertex, OutgoingEdges] | undefined {
		// if we do not want to include function definitions, only retrieve the value if the id is part of the root vertices
		const vertex: Vertex | undefined = this.getVertex(id, includeDefinedFunctions);

		return vertex === undefined ? undefined : [vertex, this.outgoingEdges(id) ?? new Map()];
	}

	/**
	 * Get the {@link DataflowGraphVertexInfo} attached to a vertex.
	 * @param id                      - The id of the node to get
	 * @param includeDefinedFunctions - If true this will search function definitions as well and not just the toplevel
	 * @returns the node info for the given id (if it exists)
	 * @see #get
	 */
	public getVertex(id: NodeId, includeDefinedFunctions = true): Vertex | undefined {
		return includeDefinedFunctions || this.rootVertices.has(id) ? this.vertexInformation.get(id) : undefined;
	}

	public outgoingEdges(id: NodeId): OutgoingEdges | undefined {
		return this.edgeInformation.get(id);
	}

	public ingoingEdges(id: NodeId): IngoingEdges | undefined {
		const edges = new Map<NodeId, Edge>();
		for(const [source, outgoing] of this.edgeInformation.entries()) {
			if(outgoing.has(id)) {
				edges.set(source, outgoing.get(id) as Edge);
			}
		}
		return edges;
	}

	/**
	 * Given a node in the normalized AST this either:
	 * returns the id if the node directly exists in the DFG
	 * returns the ids of all vertices in the DFG that are linked to this
	 * returns undefined if the node is not part of the DFG and not linked to any node
	 */
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

	/**
	 * Retrieves the set of vertices which have side effects that we do not know anything about.
	 */
	public get unknownSideEffects(): Set<UnknownSideEffect> {
		return this._unknownSideEffects;
	}

	/** Allows setting the id-map explicitly (which should only be used when, e.g., you plan to compare two dataflow graphs on the same AST-basis) */
	public setIdMap(idMap: AstIdMap): void {
		this._idMap = idMap;
	}


	/**
	 * @param includeDefinedFunctions - If true this will iterate over function definitions as well and not just the toplevel
	 * @returns the ids of all toplevel vertices in the graph together with their vertex information
	 * @see #edges
	 */
	public* vertices(includeDefinedFunctions: boolean): MapIterator<[NodeId, Vertex]> {
		if(includeDefinedFunctions) {
			yield* this.vertexInformation.entries();
		} else {
			for(const id of this.rootVertices) {
				yield [id, this.vertexInformation.get(id) as Vertex];
			}
		}
	}

	/**
	 * @returns the ids of all edges in the graph together with their edge information
	 * @see #vertices
	 */
	public* edges(): MapIterator<[NodeId, OutgoingEdges]> {
		yield* this.edgeInformation.entries();
	}

	/**
	 * Returns true if the graph contains a node with the given id.
	 * @param id                      - The id to check for
	 * @param includeDefinedFunctions - If true this will check function definitions as well and not just the toplevel
	 */
	public hasVertex(id: NodeId, includeDefinedFunctions = true): boolean {
		return includeDefinedFunctions ? this.vertexInformation.has(id) : this.rootVertices.has(id);
	}

	/**
	 * Returns true if the root level of the graph contains a node with the given id.
	 */
	public isRoot(id: NodeId): boolean {
		return this.rootVertices.has(id);
	}

	public rootIds(): ReadonlySet<NodeId> {
		return this.rootVertices;
	}

	/**
	 * Adds a new vertex to the graph, for ease of use, some arguments are optional and filled automatically.
	 * @param vertex - The vertex to add
	 * @param fallbackEnv - A clean environment to use if no environment is given in the vertex
	 * @param asRoot - If false, this will only add the vertex but do not add it to the {@link rootIds|root vertices} of the graph.
	 *                 This is probably only of use, when you construct dataflow graphs for tests.
	 * @param overwrite - If true, this will overwrite the vertex if it already exists in the graph (based on the id).
	 * @see DataflowGraphVertexInfo
	 * @see DataflowGraphVertexArgument
	 */
	public addVertex(vertex: DataflowGraphVertexArgument & Omit<Vertex, keyof DataflowGraphVertexArgument>, fallbackEnv: REnvironmentInformation, asRoot = true, overwrite = false): this {
		const oldVertex = this.vertexInformation.get(vertex.id);
		if(oldVertex !== undefined && !overwrite) {
			return this;
		}

		const fallback = vertex.tag === VertexType.VariableDefinition || vertex.tag === VertexType.Use || vertex.tag === VertexType.Value || (vertex.tag === VertexType.FunctionCall && vertex.onlyBuiltin) ? undefined : fallbackEnv;
		// keep a clone of the original environment
		const environment = vertex.environment ? cloneEnvironmentInformation(vertex.environment) : fallback;

		this.vertexInformation.set(vertex.id, {
			...vertex,
			environment
		} as unknown as Vertex);

		if(asRoot) {
			this.rootVertices.add(vertex.id);
		}
		return this;
	}

	/** {@inheritDoc} */
	public addEdge(from: NodeId, to: NodeId, type: EdgeType | number): this
	/** {@inheritDoc} */
	public addEdge(from: ReferenceForEdge, to: ReferenceForEdge, type: EdgeType | number): this
	/** {@inheritDoc} */
	public addEdge(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge, type: EdgeType | number): this
	public addEdge(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge, type: EdgeType | number): this {
		const [fromId, toId] = extractEdgeIds(from, to);

		if(fromId === toId) {
			return this;
		}

		/* we now that we pass all required arguments */
		const edge = { types: type } as unknown as Edge;

		const existingFrom = this.edgeInformation.get(fromId);
		const edgeInFrom = existingFrom?.get(toId);

		if(edgeInFrom === undefined) {
			if(existingFrom === undefined) {
				this.edgeInformation.set(fromId, new Map([[toId, edge]]));
			} else {
				existingFrom.set(toId, edge);
			}
		} else {
			// adding the type
			edgeInFrom.types |= type;
		}
		return this;
	}

	/**
	 * Merges the other graph into *this* one (in-place). The return value is only for convenience.
	 * @param otherGraph        - The graph to merge into this one
	 * @param mergeRootVertices - If false, this will only merge the vertices and edges but exclude the root vertices this is probably only of use
	 *                            in the context of function definitions
	 */
	public mergeWith(otherGraph: DataflowGraph<Vertex, Edge> | undefined, mergeRootVertices = true): this {
		if(otherGraph === undefined) {
			return this;
		}

		// merge root ids
		if(mergeRootVertices) {
			for(const root of otherGraph.rootVertices) {
				this.rootVertices.add(root);
			}
		}

		for(const unknown of otherGraph.unknownSideEffects) {
			this._unknownSideEffects.add(unknown);
		}

		for(const [id, info] of otherGraph.vertexInformation) {
			const currentInfo = this.vertexInformation.get(id);
			this.vertexInformation.set(id, currentInfo === undefined ? info : mergeNodeInfos(currentInfo, info));
		}

		this.mergeEdges(otherGraph);
		return this;
	}

	private mergeEdges(otherGraph: DataflowGraph<Vertex, Edge>) {
		for(const [id, edges] of otherGraph.edgeInformation.entries()) {
			for(const [target, edge] of edges) {
				const existing = this.edgeInformation.get(id);
				if(existing === undefined) {
					this.edgeInformation.set(id, new Map([[target, edge]]));
				} else {
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

	/**
	 * Marks a vertex in the graph to be a definition
	 * @param reference - The reference to the vertex to mark as definition
	 */
	public setDefinitionOfVertex(reference: IdentifierReference): void {
		const vertex = this.getVertex(reference.nodeId, true);
		guard(vertex !== undefined, () => `node must be defined for ${JSON.stringify(reference)} to set reference`);
		if(vertex.tag === VertexType.FunctionDefinition || vertex.tag === VertexType.VariableDefinition) {
			vertex.cds = reference.controlDependencies;
		} else {
			this.vertexInformation.set(reference.nodeId, { ...vertex, tag: VertexType.VariableDefinition });
		}
	}

	/**
	 * Marks a vertex in the graph to be a function call with the new information
	 * @param info - The information about the new function call node
	 */
	public updateToFunctionCall(info: DataflowGraphVertexFunctionCall): void {
		const vertex = this.getVertex(info.id, true);
		guard(vertex !== undefined && (vertex.tag === VertexType.Use || vertex.tag === VertexType.Value), () => `node must be a use or value node for ${JSON.stringify(info.id)} to update it to a function call but is ${vertex?.tag}`);
		this.vertexInformation.set(info.id, { ...vertex, ...info, tag: VertexType.FunctionCall });
	}

	/** If you do not pass the `to` node, this will just mark the node as maybe */
	public addControlDependency(from: NodeId, to?: NodeId, when?: boolean): this {
		to = to ? normalizeIdToNumberIfPossible(to) : undefined;
		const vertex = this.getVertex(from, true);
		guard(vertex !== undefined, () => `node must be defined for ${from} to add control dependency`);
		vertex.cds ??= [];
		if(to) {
			let hasControlDependency = false;
			for(const { id, when: cond } of vertex.cds) {
				if(id === to && when !== cond) {
					hasControlDependency = true;
					break;
				}
			}
			if(!hasControlDependency) {
				vertex.cds.push({ id: to, when });
			}
		}
		return this;
	}

	/** Marks the given node as having unknown side effects */
	public markIdForUnknownSideEffects(id: NodeId, target?: LinkTo<RegExp | string>): this {
		if(target) {
			this._unknownSideEffects.add({
				id:     normalizeIdToNumberIfPossible(id),
				linkTo: typeof target.callName === 'string' ? { ...target, callName: new RegExp(target.callName) } : target as LinkTo<RegExp>
			});
			return this;
		}
		this._unknownSideEffects.add(normalizeIdToNumberIfPossible(id));
		return this;
	}

	/**
	 * Constructs a dataflow graph instance from the given JSON data and returns the result.
	 * This can be useful for data sent by the flowR server when analyzing it further.
	 * @param data - The JSON data to construct the graph from
	 */
	public static fromJson(data: DataflowGraphJson): DataflowGraph {
		const graph = new DataflowGraph(undefined);
		graph.rootVertices = new Set<NodeId>(data.rootVertices);
		graph.vertexInformation = new Map<NodeId, DataflowGraphVertexInfo>(data.vertexInformation);
		for(const [, vertex] of graph.vertexInformation) {
			if(vertex.environment) {
				(vertex.environment as Writable<REnvironmentInformation>) = renvFromJson(vertex.environment as unknown as REnvironmentInformationJson);
			}
		}
		graph.edgeInformation = new Map<NodeId, OutgoingEdges>(data.edgeInformation.map(([id, edges]) => [id, new Map<NodeId, DataflowGraphEdge>(edges)]));
		return graph;
	}
}

function mergeNodeInfos<Vertex extends DataflowGraphVertexInfo>(current: Vertex, next: Vertex): Vertex {
	if(current.tag !== next.tag) {
		dataflowLogger.warn(() => `nodes to be joined for the same id should have the same tag, but ${JSON.stringify(current, jsonReplacer)} vs. ${JSON.stringify(next, jsonReplacer)} -- we are currently not handling cases in which vertices may be either! Keeping current.`);
		return current;
	}

	if(current.tag === VertexType.VariableDefinition) {
		guard(current.scope === next.scope, 'nodes to be joined for the same id must have the same scope');
	} else if(current.tag === VertexType.FunctionCall) {
		guard(equalFunctionArguments(current.id, current.args, (next as DataflowGraphVertexFunctionCall).args), 'nodes to be joined for the same id must have the same function call information');
	} else if(current.tag === VertexType.FunctionDefinition) {
		guard(current.scope === next.scope, 'nodes to be joined for the same id must have the same scope');
		current.exitPoints = uniqueArrayMerge(current.exitPoints, (next as DataflowGraphVertexFunctionDefinition).exitPoints);
	}

	return current;
}

/**
 * Returns the ids of the dataflow vertices referenced by a {@link ReferenceForEdge}.
 */
function extractEdgeIds(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge): [fromId: NodeId, toId: NodeId] {
	const fromId = typeof from === 'object' ? from.nodeId : from;
	const toId = typeof to === 'object' ? to.nodeId : to;
	return [fromId, toId];
}

export interface IEnvironmentJson {
    readonly id: number;
    parent:      IEnvironmentJson;
    memory:      Record<Identifier, IdentifierDefinition[]>;
    builtInEnv:  true | undefined;
}

interface REnvironmentInformationJson {
	readonly current: IEnvironmentJson;
	readonly level:   number;
}

function envFromJson(json: IEnvironmentJson): IEnvironment {
	const parent = json.parent ? envFromJson(json.parent) : undefined;
	const memory: BuiltInMemory = new Map();
	for(const [key, value] of Object.entries(json.memory)) {
		memory.set(key as Identifier, value);
	}
	const obj: Writable<IEnvironment> = {
		id:     json.id,
		parent: parent as IEnvironment,
		memory
	};
	if(json.builtInEnv) {
		obj.builtInEnv = true;
	}
	return obj as IEnvironment;
}

function renvFromJson(json: REnvironmentInformationJson): REnvironmentInformation {
	const current = envFromJson(json.current);
	return {
		current,
		level: json.level
	};
}
