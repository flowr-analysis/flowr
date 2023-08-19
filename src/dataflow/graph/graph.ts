// TODO: modify | alias | etc.
import { guard } from '../../util/assert'
import { NodeId, RNodeWithParent } from '../../r-bridge'
import {
	cloneEnvironments,
	GlobalScope,
	IdentifierDefinition,
	IdentifierReference,
	initializeCleanEnvironments, LocalScope,
} from '../environments'
import { BiMap } from '../../util/bimap'
import { log } from '../../util/log'
import { DataflowGraphEdge, EdgeType, DataflowGraphEdgeAttribute } from './edge'
import { DataflowInformation } from '../internal/info'
import { equalEdges, equalExitPoints, equalFunctionArguments, equalNodes } from './equal'
import {
	DataflowGraphNodeArgument,
	DataflowGraphNodeFunctionCall,
	DataflowGraphNodeFunctionDefinition,
	DataflowGraphNodeInfo
} from './vertex'

/** Used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<NodeId, RNodeWithParent<OtherInfo>>



// TODO: on fold clarify with in and out-local, out-global! (out-function?)

/**
 * Used to represent usual R scopes
 */
export type DataflowScopeName =
  | /** default R global environment */            typeof GlobalScope
  | /** unspecified automatic local environment */ typeof LocalScope
  | /** named environments */                      string



// TODO: export type DataflowGraphNodeType = 'variable' | 'processing' | 'assignment' | 'if-then-else' | 'loop' | 'function'

export type DataflowFunctionFlowInformation = Omit<DataflowInformation<unknown>, 'ast'>

export type NamedFunctionArgument = [string, IdentifierReference | '<value>']
export type PositionalFunctionArgument = IdentifierReference | '<value>'
export type FunctionArgument = NamedFunctionArgument | PositionalFunctionArgument | 'empty'

type ReferenceForEdge = Pick<IdentifierReference, 'nodeId' | 'used'>  | IdentifierDefinition


const DEFAULT_ENVIRONMENT = initializeCleanEnvironments()


/**
 * The dataflow graph holds the dataflow information found within the given AST.
 * We differentiate the directed edges in {@link EdgeType} and the vertices indicated by {@link DataflowGraphNodeArgument}
 *
 * The vertices of the graph are organized in a hierarchical fashion, with a function-definition node containing the nodes of its subgraph.
 * However, all *edges* are hoisted at the top level in the form of an adjacency list.
 * After the dataflow analysis, all sources and targets of the edges *must* be part of the vertices.
 * However, this does not have to hold during the construction as edges may point from or to vertices which are yet to be constructed.
 *
 * All methods return the modified graph to allow for chaining.
 */
export class DataflowGraph {
	private graphNodes = new Map<NodeId, DataflowGraphNodeInfo>()
	// TODO: improve access, theoretically we want a multi - default map, right now we do not allow multiple edges
	private edges = new Map<NodeId, Map<NodeId, DataflowGraphEdge>>()
	// TODO: this should be removed with flattened graph
	private nodeIdAccessCache = new Map<NodeId, [DataflowGraphNodeInfo, [NodeId, DataflowGraphEdge][]] | null>()

	private invalidateCache() {
		this.nodeIdAccessCache.clear()
	}

	/**
   * @param includeDefinedFunctions - If true this will iterate over function definitions as well and not just the toplevel
   * @returns the ids of all toplevel nodes in the graph, together with their node info and the graph that contains them (in case of subgraphs)
   */
	public* nodes(includeDefinedFunctions = false): IterableIterator<[NodeId, DataflowGraphNodeInfo, DataflowGraph]> {
		const nodes: [NodeId, DataflowGraphNodeInfo, DataflowGraph][] = [...this.graphNodes.entries()].map(([id, node]) => [id, node, this])
		for(const [id, node, graph] of nodes) {
			yield [id, node, graph]
			if(includeDefinedFunctions && node.tag === 'function-definition') {
				const entries = [...node.subflow.graph.entries()]
				nodes.push(...entries.map(([id, n]) => [id, n, node.subflow.graph] as [NodeId, DataflowGraphNodeInfo, DataflowGraph]))
			}
		}
	}

	public hasNode(id: NodeId, includeDefinedFunctions = false): boolean {
		if(!includeDefinedFunctions) {
			return this.graphNodes.has(id)
		} else {
			for(const [nodeId, _] of this.nodes(true)) {
				if(nodeId === id) {
					return true
				}
			}
		}
		return false
	}

	/**
   * Get the {@link DataflowGraphNodeInfo} attached to a node as well as all outgoing edges.
   * Uses a cache
   *
   * @param id                      - the id of the node to get
   * @param includeDefinedFunctions - if true this will search function definitions as well and not just the toplevel
   * @returns the node info for the given id (if it exists)
   */
	public get(id: NodeId, includeDefinedFunctions = true): [DataflowGraphNodeInfo, [NodeId, DataflowGraphEdge][]] | undefined {
		if (!includeDefinedFunctions) {
			const got = this.graphNodes.get(id)
			return got === undefined ? undefined : [got, [...this.edges.get(id) ?? []]]
		} else {
			const cache = this.nodeIdAccessCache.get(id)
			if (cache !== undefined) {
				return cache ?? undefined
			}
			const got = this.rawGetInAllGraphs(id)
			this.nodeIdAccessCache.set(id, got ?? null)
			return got
		}
	}

	private rawGetInAllGraphs(id: NodeId): [DataflowGraphNodeInfo, [NodeId, DataflowGraphEdge][]] | undefined {
		let info = undefined
		const edges = new Map<NodeId, DataflowGraphEdge>()
		for (const [nodeId, probableInfo, graph] of this.nodes(true)) {
			// TODO: we need to flatten the graph to have all edges in one place
			const newEdges = graph.edges.get(id)
			if (newEdges !== undefined) {
				for (const [id, edge] of newEdges) {
					edges.set(id, edge)
				}
			}
			if (nodeId === id) {
				info = probableInfo
			}
		}
		return info === undefined ? undefined : [info, [...edges]]
	}

	public entries(): IterableIterator<[NodeId, Required<DataflowGraphNodeInfo>]> {
		return this.graphNodes.entries()
	}

	/**
   * Adds a new node to the graph, for ease of use, some arguments are optional and filled automatically.
   *
   * @see DataflowGraphNodeInfo
   * @see DataflowGraphNodeArgument
   */
	public addNode(node: DataflowGraphNodeArgument): this {
		const oldNode = this.graphNodes.get(node.id)
		if(oldNode !== undefined) {
			guard(oldNode.name === node.name, 'node names must match for the same id if added')
			return this
		}
		// dataflowLogger.trace(`[${node.tag}] adding node ${JSON.stringify(node)}`)
		// deep clone environment
		const environment = node.environment === undefined ? DEFAULT_ENVIRONMENT : cloneEnvironments(node.environment)
		const when = node.when ?? 'always'
		this.graphNodes.set(node.id, { ...node, when, environment })
		this.invalidateCache()
		return this
	}

	/** Basically only exists for creations in tests, within the dataflow-extraction, this 3-argument variant will determine `attribute` automatically */
	public addEdge(from: NodeId, to: NodeId, type: EdgeType, attribute: DataflowGraphEdgeAttribute): this
	/** {@inheritDoc} */
	public addEdge(from: ReferenceForEdge, to: ReferenceForEdge, type: EdgeType): this
	/** {@inheritDoc} */
	public addEdge(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge, type: EdgeType, attribute?: DataflowGraphEdgeAttribute, promote?: boolean): this
	/**
   * Will insert a new edge into the graph,
   * if the direction of the edge is of no importance (`same-read-read` or `same-def-def`), source
   * and target will be sorted so that `from` has the lower, and `to` the higher id (default ordering).
   * <p>
   * If you omit the last argument but set promote, this will make the edge `maybe` if at least one of the {@link IdentifierReference | references} or {@link DataflowGraphNodeInfo | nodes} has a used flag of `maybe`.
   * Promote will probably only be used internally and not by tests etc.
   * TODO: ensure that target has a def scope and source does not?
   */
	public addEdge(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge, type: EdgeType, attribute?: DataflowGraphEdgeAttribute, promote= false): this {
		// dataflowLogger.trace(`trying to add edge from ${JSON.stringify(from)} to ${JSON.stringify(to)} with type ${type} and attribute ${JSON.stringify(attribute)} to graph`)

		const fromId = typeof from === 'object' ? from.nodeId : from
		const toId = typeof to === 'object' ? to.nodeId : to

		if(fromId === toId) {
			log.trace(`ignoring self-edge from ${fromId} to ${toId} (${type}, ${attribute ?? '?'}, ${promote ? 'y' : 'n'})`)
			return this
		}

		if(promote) {
			attribute ??= (from as ReferenceForEdge).used === 'maybe' ? 'maybe' : (to as ReferenceForEdge).used

			// reduce the load on attribute checks
			if(attribute !== 'maybe') {
				const fromInfo = this.get(fromId, true)
				if (fromInfo?.[0].when === 'maybe') {
					log.trace(`automatically promoting edge from ${fromId} to ${toId} as maybe because at least one of the nodes is maybe`)
					attribute = 'maybe'
				} else {
					const toInfo = this.get(toId, true)
					if (toInfo?.[0].when === 'maybe') {
						log.trace(`automatically promoting edge from ${fromId} to ${toId} as maybe because at least one of the nodes is maybe`)
						attribute = 'maybe'
					}
				}
			}
		}

		guard(attribute !== undefined, 'attribute must be set')
		const edge: DataflowGraphEdge = { types: new Set([type]), attribute }

		// TODO: make this more performant
		// we ignore the attribute as it is only promoted to maybe

		const existingFrom = this.edges.get(fromId)
		const edgeInFrom = existingFrom?.get(toId)

		if(edgeInFrom === undefined) {
			this.invalidateCache()
			if(existingFrom === undefined) {
				this.edges.set(fromId, new Map([[toId, edge]]))
			} else {
				existingFrom.set(toId, edge)
			}
			// sort (on id so that sorting is the same, independent of the attribute)
			const bidirectional = type === 'same-read-read' || type === 'same-def-def' || type === 'relates'

			if(bidirectional) {
				const existingTo = this.edges.get(toId)
				if(existingTo === undefined) {
					this.edges.set(toId, new Map([[fromId, edge]]))
				} else {
					existingTo.set(fromId, edge)
				}
			} else if (type === 'defines-on-call') {
				const otherEdge: DataflowGraphEdge = { ...edge,
					types: new Set([EdgeType.DefinedByOnCall])
				}
				const existingTo = this.edges.get(toId)
				if(existingTo === undefined) {
					this.edges.set(toId, new Map([[fromId, otherEdge]]))
				} else {
					existingTo.set(fromId, otherEdge)
				}
			}
		} else {
			if(attribute === 'maybe') {
				// as the data is shared, we can just set it for one direction
				edgeInFrom.attribute = 'maybe'
			}

			if(!edgeInFrom.types.has(type)) {
				// adding the type
				edgeInFrom.types.add(type)
			}
		}
		return this
	}


	/** Merges the other graph into *this* one (in-place). The return value is only for convenience. */
	public mergeWith(...otherGraphs: (DataflowGraph | undefined)[]): this {
		for(const otherGraph of otherGraphs) {
			if(otherGraph === undefined) {
				continue
			}
			for(const [id, info] of otherGraph.graphNodes) {
				const currentInfo = this.graphNodes.get(id)
				if (currentInfo === undefined) {
					this.graphNodes.set(id, info)
				} else {
					this.graphNodes.set(id, mergeNodeInfos(currentInfo, info))
				}
			}

			// TODO: make more performant
			for(const [id, edges] of otherGraph.edges.entries()) {
				for(const [target, edge] of edges) {
					const existing = this.edges.get(id)
					if(existing === undefined) {
						this.edges.set(id, new Map([[target, edge]]))
					} else {
						const get = existing.get(target)
						if(get === undefined) {
							existing.set(target, edge)
						} else {
							get.types = new Set([...get.types, ...edge.types])
							if(edge.attribute === 'maybe') {
								get.attribute = 'maybe'
							}
						}
					}
				}
			}
		}
		this.invalidateCache()
		return this
	}

	// TODO: diff function to get more information?
	public equals(other: DataflowGraph): boolean {
		if(!equalNodes(this.graphNodes, other.graphNodes)) {
			return false
		}
		// TODO: we need to remove nesting to avoid this uglyness
		for(const [id] of this.graphNodes) {
			const edges = this.get(id)
			const otherEdges = other.get(id)
			guard(edges !== undefined && otherEdges !== undefined, () => `edges must be defined for ${id} to compare graphs`)
			if(!equalEdges(id, edges[1], otherEdges[1])) {
				return false
			}
		}
		return true
	}

	public setDefinitionOfNode(reference: IdentifierReference): void {
		const got = this.get(reference.nodeId)
		guard(got !== undefined, () => `node must be defined for ${JSON.stringify(reference)} to set definition scope to ${reference.scope}`)
		const [node] = got
		if(node.tag === 'function-definition' || node.tag === 'variable-definition') {
			guard(node.scope === reference.scope, () => `node ${JSON.stringify(node)} must not be previously defined at position or have same scope for ${JSON.stringify(reference)}`)
			guard(node.when === reference.used || node.when === 'maybe' || reference.used === 'maybe', () => `node ${JSON.stringify(node)} must not be previously defined at position or have same scope for ${JSON.stringify(reference)}`)
			node.scope = reference.scope
			node.when = reference.used === 'maybe' ? 'maybe' : node.when
		} else {
			this.graphNodes.set(reference.nodeId, {
				...node,
				tag:   'variable-definition',
				scope: reference.scope,
			})
		}
	}
}

function mergeNodeInfos(current: DataflowGraphNodeInfo, next: DataflowGraphNodeInfo): DataflowGraphNodeInfo {
	guard(current.tag === next.tag, () => `nodes to be joined for the same id must have the same tag, but ${JSON.stringify(current)} vs ${JSON.stringify(next)}`)
	guard(current.name === next.name, () => `nodes to be joined for the same id must have the same name, but ${JSON.stringify(current)} vs ${JSON.stringify(next)}`)
	guard(current.environment === next.environment, 'nodes to be joined for the same id must have the same environment')
	if(current.tag === 'variable-definition') {
		guard(current.scope === next.scope, 'nodes to be joined for the same id must have the same scope')
	} else if(current.tag === 'function-call') {
		guard(equalFunctionArguments(current.args, (next as DataflowGraphNodeFunctionCall).args), 'nodes to be joined for the same id must have the same function call information')
	} else if(current.tag === 'function-definition') {
		guard(current.scope === next.scope, 'nodes to be joined for the same id must have the same scope')
		guard(equalExitPoints(current.exitPoints, (next as DataflowGraphNodeFunctionDefinition).exitPoints), 'nodes to be joined must have same exist points')
	}

	return {
		...current // make a copy
	}
}
