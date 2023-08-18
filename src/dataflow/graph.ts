// TODO: modify | alias | etc.
import { guard } from '../util/assert'
import { NodeId, RNodeWithParent } from '../r-bridge'
import {
	cloneEnvironments,
	environmentsEqual, equalIdentifierReferences, IdentifierDefinition,
	IdentifierReference, initializeCleanEnvironments,
	REnvironmentInformation
} from './environments'
import { BiMap } from '../util/bimap'
import { MergeableRecord } from '../util/objects'
import { log } from '../util/log'
import { dataflowLogger } from './index'
import { DataflowInformation } from './internal/info'
import { displayEnvReplacer } from '../util/json'

/** Used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<NodeId, RNodeWithParent<OtherInfo>>

export type DataflowGraphEdgeType =
    | /** The edge determines that source reads target */ 'reads'
    | /** The edge determines that source is defined by target */ 'defined-by'
    | /** The edge determines that source (probably argument) defines the target (probably parameter), currently automatically created by `addEdge` */ 'defines-on-call'
    | /** Inverse of `defines-on-call` currently only needed to get better results when slicing complex function calls, TODO: remove this in the future when the slicer knows the calling context of the function and can trace links accordingly */ 'defined-by-on-call'
    | /** The edge determines that both nodes reference the same variable in a lexical/scoping sense, source and target are interchangeable (reads for at construction unbound variables) */ 'same-read-read'
    | /** Similar to `same-read-read` but for def-def constructs without a read in-between */ 'same-def-def'
    | /** Formal used as argument to a function call */ 'argument'
    | /** The edge determines that the source is a side effect that happens when the target is called */ 'side-effect-on-call'
    | /** The edge determines that the source calls the target */ 'calls'
    | /** The source and edge relate to each other bidirectionally */ 'relates'
    | /** The source returns target on call */ 'returns'

// context -- is it always read/defined-by // TODO: loops
export type DataflowGraphEdgeAttribute = 'always' | 'maybe'


// TODO: on fold clarify with in and out-local, out-global! (out-function?)

export const GlobalScope = '.GlobalEnv'
export const LocalScope = 'local'

/**
 * Used to represent usual R scopes
 */
export type DataflowScopeName =
  | /** default R global environment */            typeof GlobalScope
  | /** unspecified automatic local environment */ typeof LocalScope
  | /** named environments */                      string


/**
 * An edge consist of the target node (i.e., the variable or processing node),
 * a type (if it is read or used in the context), and an attribute (if this edge exists for every program execution or
 * if it is only one possible execution path).
 */
export interface DataflowGraphEdge {
  // currently multiple edges are represented by multiple types
  types:     Set<DataflowGraphEdgeType>
  attribute: DataflowGraphEdgeAttribute
}


// TODO: export type DataflowGraphNodeType = 'variable' | 'processing' | 'assignment' | 'if-then-else' | 'loop' | 'function'

export type DataflowFunctionFlowInformation = Omit<DataflowInformation<unknown>, 'ast'>

export type NamedFunctionArgument = [string, IdentifierReference | '<value>']
export type PositionalFunctionArgument = IdentifierReference | '<value>'
export type FunctionArgument = NamedFunctionArgument | PositionalFunctionArgument | 'empty'

function equalFunctionArgumentsReferences(a: IdentifierReference | '<value>', b: IdentifierReference | '<value>'): boolean {
	if (a === '<value>' || b === '<value>') {
		return a === b
	}
	return equalIdentifierReferences(a, b)
}

function equalExitPoints(a: NodeId[] | undefined, b: NodeId[] | undefined): boolean {
	if (a === undefined || b === undefined) {
		return a === b
	}
	if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; ++i) {
		if (a[i] !== b[i]) {
			return false
		}
	}
	return true
}

export function equalFunctionArguments(a: false | FunctionArgument[], b: false | FunctionArgument[]): boolean {
	if(a === false || b === false) {
		return a === b
	}
	else if (a.length !== b.length) {
		return false
	}
	for (let i = 0; i < a.length; ++i) {
		const aArg = a[i]
		const bArg = b[i]
		if (Array.isArray(aArg) && Array.isArray(bArg)) {
			// must have same name
			if (aArg[0] !== bArg[0]) {
				return false
			}
			if (!equalFunctionArgumentsReferences(aArg[1], bArg[1])) {
				return false
			}
		} else if (!equalFunctionArgumentsReferences(aArg as PositionalFunctionArgument, bArg as PositionalFunctionArgument)) {
			return false
		}
	}
	return true

}


type ReferenceForEdge = Pick<IdentifierReference, 'nodeId' | 'used'>  | IdentifierDefinition

/**
 * Arguments required to construct a node in the dataflow graph.
 *
 * @see DataflowGraphNodeUse
 * @see DataflowGraphNodeVariableDefinition
 * @see DataflowGraphNodeFunctionDefinition
 */
interface DataflowGraphNodeBase extends MergeableRecord {
  /**
   * Used to identify and separate different types of nodes.
   */
  readonly tag: string
  /**
   * The id of the node (the id assigned by the {@link ParentInformation} decoration)
   */
  id:           NodeId
  /**
   * The name of the node, usually the variable name
   */
  name:         string
  /**
   * The environment in which the node is defined.
   * If you do not provide an explicit environment, this will use the same clean one (with {@link initializeCleanEnvironments}).
   */
  environment?: REnvironmentInformation
  /**
   * Is this node part of every local execution trace or only in some.
   * If you do not provide an explicit value, this will default to `always`.
   */
  when?:        DataflowGraphEdgeAttribute
}

/**
 * Arguments required to construct a node which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphExitPoint extends DataflowGraphNodeBase {
  readonly tag: 'exit-point'
}

/**
 * Arguments required to construct a node which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeUse extends DataflowGraphNodeBase {
  readonly tag: 'use'
}

/**
 * Arguments required to construct a node which represents the usage of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeFunctionCall extends DataflowGraphNodeBase {
  readonly tag: 'function-call'
  args:         FunctionArgument[]
}

/**
 * Arguments required to construct a node which represents the definition of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeVariableDefinition extends DataflowGraphNodeBase {
  readonly tag: 'variable-definition'
  /**
   * The scope in which the node is defined  (can be global or local to the current environment).
   */
  scope:        DataflowScopeName
}

export interface DataflowGraphNodeFunctionDefinition extends DataflowGraphNodeBase {
  readonly tag: 'function-definition'
  /**
   * The scope in which the node is defined  (can be global or local to the current environment).
   */
  scope:        DataflowScopeName
  /**
   * The static subflow of the function definition, constructed within {@link processFunctionDefinition}.
   * If the node is (for example) a function, it can have a subgraph which is used as a template for each call.
   */
  subflow:      DataflowFunctionFlowInformation
  /**
   * All exist points of the function definitions.
   * In other words: last expressions/return calls
   */
  exitPoints:   NodeId[]
}

const DEFAULT_ENVIRONMENT = initializeCleanEnvironments()

export type DataflowGraphNodeArgument = DataflowGraphNodeUse | DataflowGraphExitPoint | DataflowGraphNodeVariableDefinition | DataflowGraphNodeFunctionDefinition | DataflowGraphNodeFunctionCall
export type DataflowGraphNodeInfo = Required<DataflowGraphNodeArgument>

/**
 * Holds the dataflow information found within the given AST
 * there is a node for every variable encountered, obeying scoping rules.
 * Edges are extra which may mean that edges for currently non-existing nodes exist (e.g., those bound later during graph construction)
 * <p>
 * The given map holds a key entry for each node with the corresponding node info attached
 * <p>
 * Allows to chain calls for easier usage
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
	public addEdge(from: NodeId, to: NodeId, type: DataflowGraphEdgeType, attribute: DataflowGraphEdgeAttribute): this
	/** {@inheritDoc} */
	public addEdge(from: ReferenceForEdge, to: ReferenceForEdge, type: DataflowGraphEdgeType): this
	/** {@inheritDoc} */
	public addEdge(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge, type: DataflowGraphEdgeType, attribute?: DataflowGraphEdgeAttribute, promote?: boolean): this
	/**
   * Will insert a new edge into the graph,
   * if the direction of the edge is of no importance (`same-read-read` or `same-def-def`), source
   * and target will be sorted so that `from` has the lower, and `to` the higher id (default ordering).
   * <p>
   * If you omit the last argument but set promote, this will make the edge `maybe` if at least one of the {@link IdentifierReference | references} or {@link DataflowGraphNodeInfo | nodes} has a used flag of `maybe`.
   * Promote will probably only be used internally and not by tests etc.
   * TODO: ensure that target has a def scope and source does not?
   */
	public addEdge(from: NodeId | ReferenceForEdge, to: NodeId | ReferenceForEdge, type: DataflowGraphEdgeType, attribute?: DataflowGraphEdgeAttribute, promote= false): this {
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
					types: new Set(['defined-by-on-call'])
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



function equalEdges(id: NodeId, our: [NodeId, DataflowGraphEdge][], other: [NodeId, DataflowGraphEdge][]): boolean {
	if(our.length !== other.length) {
		dataflowLogger.warn(`total edge size for ${id} does not match: ${our.length} vs ${other.length} (${JSON.stringify(our, displayEnvReplacer)}, ${JSON.stringify(other, displayEnvReplacer)})`)
		return false
	}
	// order independent compare
	for(const [target, edge] of our) {
		const otherEdge = other.find(([otherTarget, _]) => otherTarget === target)
		if(otherEdge === undefined || edge.types.size !== otherEdge[1].types.size || [...edge.types].some(e => !otherEdge[1].types.has(e)) || edge.attribute !== otherEdge[1].attribute) {
			dataflowLogger.warn(`edge with ${id}->${target} does not match (${JSON.stringify(edge, displayEnvReplacer)} vs ${JSON.stringify(otherEdge, displayEnvReplacer)})`)
			return false
		}
	}
	// TODO: ignore scope?
	return true
}

function equalNodes(our: Map<NodeId, DataflowGraphNodeInfo>, other: Map<NodeId, DataflowGraphNodeInfo>): boolean {
	if(our.size !== other.size) {
		dataflowLogger.warn(`graph size does not match: ${our.size} vs ${other.size}`)
		return false
	}
	for(const [id, info] of our) {
		const otherInfo = other.get(id)
		if(otherInfo === undefined || info.tag !== otherInfo.tag || info.name !== otherInfo.name) {
			dataflowLogger.warn(`node ${id} does not match (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
			return false
		}

		if(info.tag === 'variable-definition' || info.tag === 'function-definition') {
			guard(info.tag === otherInfo.tag, () => `node ${id} does not match on tag (${info.tag} vs ${otherInfo.tag})`)
			if (info.scope !== otherInfo.scope) {
				dataflowLogger.warn(`node ${id} does not match on scope (${JSON.stringify(info.scope)} vs ${JSON.stringify(otherInfo.scope)})`)
				return false
			}
		}

		if(info.when !== otherInfo.when) {
			dataflowLogger.warn(`node ${id} does not match on when (${JSON.stringify(info.when)} vs ${JSON.stringify(otherInfo.when)})`)
			return false
		}

		if(!environmentsEqual(info.environment, otherInfo.environment)) {
			dataflowLogger.warn(`node ${id} does not match on environments (${JSON.stringify(info.environment)} vs ${JSON.stringify(otherInfo.environment)})`)
			return false
		}

		if(info.tag === 'function-call') {
			guard(otherInfo.tag === 'function-call', 'otherInfo must be a function call as well')
			if(!equalFunctionArguments(info.args, otherInfo.args)) {
				dataflowLogger.warn(`node ${id} does not match on function arguments (${JSON.stringify(info.args)} vs ${JSON.stringify(otherInfo.args)})`)
				return false
			}
		}

		if(info.tag === 'function-definition') {
			guard(otherInfo.tag === 'function-definition', 'otherInfo must be a function definition as well')

			if (!equalExitPoints(info.exitPoints, otherInfo.exitPoints)) {
				dataflowLogger.warn(`node ${id} does not match on exit points (${JSON.stringify(info.exitPoints)} vs ${JSON.stringify(otherInfo.exitPoints)})`)
				return false
			}

			// TODO: improve : info.subflow.out !== otherInfo.subflow.out || info.subflow.in !== otherInfo.subflow.in || info.subflow.unknownReferences !== otherInfo.subflow.unknownReferences ||
			if (info.subflow.scope !== otherInfo.subflow.scope || !environmentsEqual(info.subflow.environments, otherInfo.subflow.environments)) {
				dataflowLogger.warn(`node ${id} does not match on subflow (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
				return false
			}
			if (!info.subflow.graph.equals(otherInfo.subflow.graph)) {
				dataflowLogger.warn(`node ${id} does not match on subflow graph (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
				return false
			}
		}
	}
	return true
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
