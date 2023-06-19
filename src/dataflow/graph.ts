// TODO: modify | alias | etc.
import { guard } from '../util/assert'
import { NodeId, RNodeWithParent } from '../r-bridge'
import {
  environmentsEqual,
  IdentifierReference, initializeCleanEnvironments,
  REnvironmentInformation
} from './environments'
import { BiMap } from '../util/bimap'
import { MergeableRecord } from '../util/objects'
import { log } from '../util/log'
import { dataflowLogger } from './index'
import { DataflowInformation } from './internal/info'

/** used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<NodeId, RNodeWithParent<OtherInfo>>

export type DataflowGraphEdgeType =
    | /** the edge determines that source reads target */ 'read'
    | /** the edge determines that source is defined by target */ 'defined-by'
    | /** the edge determines that both nodes reference the same variable in a lexical/scoping sense, source and target are interchangeable (reads for at construction unbound variables) */ 'same-read-read'
    | /** similar to `same-read-read` but for def-def constructs without a read in-between */ 'same-def-def'

// context -- is it always read/defined-by // TODO: loops
export type DataflowGraphEdgeAttribute = 'always' | 'maybe'


// TODO: on fold clarify with in and out-local, out-global! (out-function?)

export const GlobalScope = '.GlobalEnv'
export const LocalScope = 'local'

/**
 * used to represent usual R scopes
 */
export type DataflowScopeName =
  | /** default R global environment */            typeof GlobalScope
  | /** unspecified automatic local environment */ typeof LocalScope
  | /** named environments */                      string


/**
 * An edge consist of the target node (i.e., the variable or processing node),
 * a type (if it is read or used in the context), and an attribute (if this edge exists for every program execution or
 * if it is only one possible execution path).
 *
 * These edges are specialised by {@link DataflowGraphReadEdge} and {@link DataflowGraphDefinedByEdge}
 */
export interface DataflowGraphEdge {
  target:    NodeId
  type:      DataflowGraphEdgeType
  attribute: DataflowGraphEdgeAttribute
}

export interface DataflowGraphReadEdge extends DataflowGraphEdge {
  type: 'read'
}

export interface DataflowGraphDefinedByEdge extends DataflowGraphEdge {
  type:  'defined-by'
  scope: DataflowScopeName
}


// TODO: export type DataflowGraphNodeType = 'variable' | 'processing' | 'assignment' | 'if-then-else' | 'loop' | 'function'

export type DataflowFunctionFlowInformation = Omit<DataflowInformation<unknown>, 'ast'>

export interface DataflowGraphNodeInfo extends MergeableRecord {
  name:              string
  definedAtPosition: false | DataflowScopeName
  environment:       REnvironmentInformation
  /** When is usually `always`, yet global/local assignments in ifs, loops, or function definitions do not have to happen. They are marked with 'maybe'. */
  when:              DataflowGraphEdgeAttribute
  edges:             DataflowGraphEdge[]
  /** functions will emit a subgraph for their content which is then used as a template on each call of the function */
  subflow?:          DataflowFunctionFlowInformation
}

type ReferenceForEdge = Pick<IdentifierReference, 'nodeId' | 'used'>

/**
 * Arguments required to construct a node in the dataflow graph.
 *
 * @see DataflowGraphNodeUse
 * @see DataflowGraphNodeVariableDefinition
 */
interface NodeArguments extends MergeableRecord{
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
   * If you do not provide an explicit environment, this will use a new clean one (with {@link initializeCleanEnvironments}).
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
export type DataflowGraphNodeUse = NodeArguments

/**
 * Arguments required to construct a node which represents the definition of a variable in the dataflow graph.
 */
export interface DataflowGraphNodeVariableDefinition extends NodeArguments {
  /**
   * The scope in which the node is defined  (can be global or local to the current environment).
   */
  scope: DataflowScopeName
}

export interface DataflowGraphNodeFunctionDefinition extends DataflowGraphNodeVariableDefinition {
  /**
   * The static subflow of the function definition, constructed within {@link processFunctionDefinition}
   */
  flow: DataflowFunctionFlowInformation
}


/**
 * Holds the dataflow information found within the given AST
 * there is a node for every variable encountered, obeying scoping rules
 * the node info holds edge information, node-names etc.
 * <p>
 * the given map holds a key entry for each node with the corresponding node info attached
 * <p>
 * allows to chain calls for easier usage
 */
export class DataflowGraph {
  private graph = new Map<NodeId, DataflowGraphNodeInfo>()

  /**
   * @returns the ids of all nodes in the graph
   */
  public nodes(): IterableIterator<NodeId> {
    return this.graph.keys()
  }

  /**
   * @returns the node info for the given id (if it exists)
   */
  public get(id: NodeId): DataflowGraphNodeInfo | undefined {
    return this.graph.get(id)
  }

  public entries(): IterableIterator<[NodeId, DataflowGraphNodeInfo]> {
    return this.graph.entries()
  }

  /**
   * Add a node which represents the usage of a variable to the graph
   *
   * @param id          - The id of the node which is used (the id assigned by the {@link ParentInformation} decoration)
   * @param name        - The name of the node (usually the variable name which is read)
   * @param when        - Is this node part of every local execution trace or only in some
   * @param environment - The contextual environment in which the node is used
   *
   * @see addDefinitionNode
   */
  public addUseNode(id: NodeId, name: string, when: DataflowGraphEdgeAttribute = 'always', environment: REnvironmentInformation = initializeCleanEnvironments()): this {
    return this.addNode(id, name, environment, false, when)
  }

  /**
   * Add a node which represents a variable definition to the graph
   *
   * @param id          - The id of the node which is defined (the id assigned by the {@link ParentInformation} decoration)
   * @param name        - The name of the node (usually the variable name which is defined)
   * @param scope       - The scope in which the node is defined (can be global or local to the current environment)
   * @param when        - Is this node part of every local execution trace or only in some
   * @param environment - The contextual environment in which the node is defined
   *
   * @see addUseNode
   */
  public addDefinitionNode(id: NodeId, name: string, scope: DataflowScopeName, when: DataflowGraphEdgeAttribute = 'always', environment: REnvironmentInformation = initializeCleanEnvironments()): this {
    return this.addNode(id, name, environment, scope, when)
  }

  public addFunctionDefinitionNode(id: NodeId, name: string, scope: DataflowScopeName, when: DataflowGraphEdgeAttribute = 'always', environment: REnvironmentInformation = initializeCleanEnvironments(), flow?: DataflowFunctionFlowInformation): this {
    return this.addNode(id, name, environment, scope, when, flow)
  }

  /**
   * Adds a new node to the graph
   *
   * @param id - the id of the node
   * @param name - the name of the node
   * @param environment - the environment in which the node is defined/used
   * @param definedAtPosition - if false, the node is marked as `used`, otherwise, if you give the scope, it will be marked as `defined` within the given scope
   * @param when - is the node active in all program paths or only in potentially in some
   * @param flow - if the node is (for example) a function, it can have a subgraph which is used as a template for each call
   */
  private addNode(id: NodeId, name: string, environment: REnvironmentInformation, definedAtPosition: false | DataflowScopeName = false, when: DataflowGraphEdgeAttribute = 'always', flow?: DataflowFunctionFlowInformation): this {
    const oldNode = this.graph.get(id)
    if(oldNode !== undefined) {
      guard(oldNode.name === name, 'node names must match for the same id if added')
      return this
    }
    dataflowLogger.trace(`adding node ${id} with name ${name}, when ${when}, def ${JSON.stringify(definedAtPosition)}, and environment ${JSON.stringify(environment)} to graph (subgraph: ${JSON.stringify(flow)})`)
    this.graph.set(id, {
      name,
      environment,
      definedAtPosition,
      when,
      edges:   [],
      subflow: flow
    })
    return this
  }

  /** Basically only exists for creations in tests, within the dataflow-extraction, the 3-argument variant will determine `attribute` automatically */
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
    dataflowLogger.trace(`trying to add edge from ${JSON.stringify(from)} to ${JSON.stringify(to)} with type ${type} and attribute ${JSON.stringify(attribute)} to graph`)

    const fromId = typeof from === 'object' ? from.nodeId : from
    const toId = typeof to === 'object' ? to.nodeId : to

    if(fromId === toId) {
      log.trace(`ignoring self-edge from ${fromId} to ${toId}`)
      return this
    }

    // sort (on id so that sorting is the same, independent of the attribute)
    if(type === 'same-read-read' || type === 'same-def-def') {
      [from, to] = toId > fromId ? [from, to] : [to, from]
    }
    if(promote && attribute === undefined) {
      attribute = (from as ReferenceForEdge).used === 'maybe' ? 'maybe' : (to as ReferenceForEdge).used
    }

    const fromInfo = this.graph.get(fromId)
    const toInfo = this.graph.get(toId)

    guard(fromInfo !== undefined, 'there must be a node info object for the edge source!')

    if(promote && (fromInfo.when === 'maybe' || toInfo?.when === 'maybe')) {
      log.trace(`automatically promoting edge from ${fromId} to ${toId} as maybe because at least one of the nodes is maybe`)
      attribute = 'maybe'
    }

    guard(attribute !== undefined, 'attribute must be set')
    const edge = {
      target: toId,
      type,
      attribute
    }
    // TODO: make this more performant
    if(fromInfo.edges.find(e => e.target === toId && e.type === type && e.attribute === attribute) === undefined) {
      dataflowLogger.trace(`adding edge from ${fromId} to ${toId} with type ${type} and attribute ${attribute} to graph`)
      fromInfo.edges.push(edge)
    }
    return this
  }


  /** insert a new edge in the given dataflow-graph */
  // TODO: check if from and to exists, TODO: check for duplicates
  // TODO: rework with new references?
  public mergeWith(...otherGraphs: (DataflowGraph | undefined)[]): this {
    // TODO: join edges
    // TODO: maybe switch to sets?
    const newGraph = this.graph
    for(const graph of otherGraphs) {
      if(graph === undefined) {
        continue
      }
      for(const [id, info] of graph.graph) {
        const currentInfo = newGraph.get(id)
        if (currentInfo === undefined) {
          newGraph.set(id, info)
        } else {
          newGraph.set(id, mergeNodeInfos(currentInfo, info))
        }
      }
    }

    this.graph = newGraph
    return this
  }

  // TODO: diff function to get more information?
  public equals(other: DataflowGraph): boolean {
    if(this.graph.size !== other.graph.size) {
      dataflowLogger.warn(`graph size does not match: ${this.graph.size} vs ${other.graph.size}`)
      return false
    }
    for(const [id, info] of this.graph) {
      const otherInfo = other.graph.get(id)
      if(otherInfo === undefined || info.name !== otherInfo.name || info.definedAtPosition !== otherInfo.definedAtPosition || info.when !== otherInfo.when || info.edges.length !== otherInfo.edges.length || !environmentsEqual(info.environment, otherInfo.environment)) {
        dataflowLogger.warn(`node ${id} does not match (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
        return false
      }
      if(info.subflow !== undefined || otherInfo.subflow !== undefined) {
        if(info.subflow === undefined || otherInfo.subflow === undefined) {
          dataflowLogger.warn(`node ${id} does not match on subflow with undefined (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
          return false
        }
        // TODO: improve : info.subflow.out !== otherInfo.subflow.out || info.subflow.in !== otherInfo.subflow.in || info.subflow.activeNodes !== otherInfo.subflow.activeNodes ||
        if(info.subflow.scope !== otherInfo.subflow.scope || !environmentsEqual(info.subflow.environments, otherInfo.subflow.environments)) {
          dataflowLogger.warn(`node ${id} does not match on subflow (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
          return false
        }
        if(!info.subflow.graph.equals(otherInfo.subflow.graph)) {
          dataflowLogger.warn(`node ${id} does not match on subflow graph (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
          return false
        }

      }
      // TODO: assuming that all edges are unique (which should be ensured by constructed)
      for(const edge of info.edges) {
        // TODO: improve finding edges
        if(otherInfo.edges.find(e => e.target === edge.target && e.type === edge.type && e.attribute === edge.attribute) === undefined) {
          dataflowLogger.warn(`edge ${id} -> ${edge.target} does not match any of (${JSON.stringify(otherInfo.edges)})`)
          return false
        }
      }
    }
    return true
  }

}

function mergeNodeInfos(current: DataflowGraphNodeInfo, next: DataflowGraphNodeInfo): DataflowGraphNodeInfo {
  guard(current.name === next.name, 'nodes to be joined for the same id must have the same name')
  guard(current.definedAtPosition === next.definedAtPosition, 'nodes to be joined for the same id must have the same definedAtPosition')
  guard(current.environment === next.environment, 'nodes to be joined for the same id must have the same environment')
  return {
    name:              current.name,
    definedAtPosition: current.definedAtPosition,
    when:              current.when,
    environment:       current.environment,
    // TODO: join edges
    edges:             [...current.edges, ...next.edges]
  }
}
