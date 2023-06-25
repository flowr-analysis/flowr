// TODO: modify | alias | etc.
import { assertUnreachable, guard } from '../util/assert'
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

/** used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<NodeId, RNodeWithParent<OtherInfo>>

export type DataflowGraphEdgeType =
    | /** the edge determines that source reads target */ 'read'
    | /** the edge determines that source is defined by target */ 'defined-by'
    | /** the edge determines that both nodes reference the same variable in a lexical/scoping sense, source and target are interchangeable (reads for at construction unbound variables) */ 'same-read-read'
    | /** similar to `same-read-read` but for def-def constructs without a read in-between */ 'same-def-def'
    | /** formal used as argument to a function call */ 'argument'
    | /** the edge determines that the source calls the target */ 'calls'

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

export type NamedArgument = [string, IdentifierReference | '<value>']
export type PositionalArgument = IdentifierReference | '<value>'
export type FunctionArgument = NamedArgument | PositionalArgument

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
    } else if (!equalFunctionArgumentsReferences(aArg as PositionalArgument, bArg as PositionalArgument)) {
      return false
    }
  }
  return true

}

// TODO: migrate with arguments used during construction
export interface DataflowGraphNodeInfo extends MergeableRecord {
  name:              string
  definedAtPosition: false | DataflowScopeName
  environment:       REnvironmentInformation
  functionCall:      false | FunctionArgument[]
  /** When is usually `always`, yet global/local assignments in ifs, loops, or function definitions do not have to happen. They are marked with 'maybe'. */
  when:              DataflowGraphEdgeAttribute
  edges:             DataflowGraphEdge[]
  /** functions will emit a subgraph for their content which is then used as a template on each call of the function */
  subflow?:          DataflowFunctionFlowInformation
  /** function definitions carry exit points */
  exitPoints?:       NodeId[]
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
   * @param includeDefinedFunctions - if true this will iterate over function definitions as well and not just the toplevel
   * @returns the ids of all toplevel nodes in the graph, together with their node info
   */
  public* nodes(includeDefinedFunctions = false): IterableIterator<[NodeId, DataflowGraphNodeInfo]> {
    const nodes = [...this.graph.entries()]
    for(const [id, node] of nodes) {
      yield [id, node]
      if(includeDefinedFunctions && node.subflow !== undefined) {
        nodes.push(...node.subflow.graph.entries())
      }
    }
  }

  public hasNode(id: NodeId, includeDefinedFunctions = false): boolean {
    if(!includeDefinedFunctions) {
      return this.graph.has(id)
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
   * Get the {@link DataflowGraphNodeInfo} attached to a node with the given id in the graph
   *
   * @param id                      - the id of the node to get
   * @param includeDefinedFunctions - if true this will search function definitions as well and not just the toplevel
   * @returns the node info for the given id (if it exists)
   */
  public get(id: NodeId, includeDefinedFunctions = false): DataflowGraphNodeInfo | undefined {
    if(!includeDefinedFunctions) {
      return this.graph.get(id)
    } else {
      for(const [nodeId, info] of this.nodes(true)) {
        if(nodeId === id) {
          return info
        }
      }
    }
    return undefined
  }

  public entries(): IterableIterator<[NodeId, DataflowGraphNodeInfo]> {
    return this.graph.entries()
  }

  /**
   * Adds a new node to the graph
   *
   * @see DataflowGraphNodeUse
   * @see DataflowGraphNodeFunctionCall
   * @see DataflowGraphNodeVariableDefinition
   * @see DataflowGraphNodeFunctionDefinition
   */
  public addNode(node: DataflowGraphNodeUse | DataflowGraphNodeVariableDefinition | DataflowGraphNodeFunctionDefinition | DataflowGraphNodeFunctionCall): this {
    const oldNode = this.graph.get(node.id)
    if(oldNode !== undefined) {
      guard(oldNode.name === node.name, 'node names must match for the same id if added')
      return this
    }
    // dataflowLogger.trace(`[${node.tag}] adding node ${JSON.stringify(node)}`)
    // deep clone environment
    const environment = node.environment === undefined ? DEFAULT_ENVIRONMENT : cloneEnvironments(node.environment)
    const when = node.when ?? 'always'
    const tag = node.tag
    switch(tag) {
      case 'use':
        this.graph.set(node.id, { name: node.name, environment, definedAtPosition: false, when, edges: [], subflow: undefined, functionCall: false, exitPoints: undefined })
        break
      case 'variable-definition':
        this.graph.set(node.id, { name: node.name, environment, definedAtPosition: node.scope, when, edges: [], subflow: undefined, functionCall: false, exitPoints: undefined })
        break
      case 'function-definition':
        this.graph.set(node.id, { name: node.name, environment, definedAtPosition: node.scope, when, edges: [], subflow: node.subflow, functionCall: false, exitPoints: node.exitPoints })
        break
      case 'function-call':
        this.graph.set(node.id, { name: node.name, environment, definedAtPosition: false, when, edges: [], subflow: undefined, functionCall: node.args, exitPoints: undefined })
        break
      default:
        assertUnreachable(tag)
    }
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
    // dataflowLogger.trace(`trying to add edge from ${JSON.stringify(from)} to ${JSON.stringify(to)} with type ${type} and attribute ${JSON.stringify(attribute)} to graph`)

    let fromId = typeof from === 'object' ? from.nodeId : from
    let toId = typeof to === 'object' ? to.nodeId : to

    if(fromId === toId) {
      log.trace(`ignoring self-edge from ${fromId} to ${toId}`)
      return this
    }

    // sort (on id so that sorting is the same, independent of the attribute)
    if(type === 'same-read-read' || type === 'same-def-def') {
      if(toId < fromId) {
        { [from, to] = [to, from] }
        { [fromId, toId] = [toId, fromId] }
      }
    }
    if(promote && attribute === undefined) {
      attribute = (from as ReferenceForEdge).used === 'maybe' ? 'maybe' : (to as ReferenceForEdge).used
    }

    const fromInfo = this.graph.get(fromId)
    const toInfo = this.graph.get(toId)

    guard(fromInfo !== undefined, () => `there must be a node info object for the edge source! but is not for ${fromId} -> ${toId}`)

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
    // we ignore the attribute as it is only promoted to maybe
    const find = fromInfo.edges.find(e => e.target === toId && e.type === type)
    if(find === undefined) {
      // dataflowLogger.trace(`adding edge from ${fromId} to ${toId} with type ${type} and attribute ${attribute} to graph`)
      fromInfo.edges.push(edge)
    } else {
      if(find.attribute === 'maybe' || attribute === 'maybe') {
        find.attribute = 'maybe'
      }
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
      if(otherInfo === undefined || info.name !== otherInfo.name) {
        dataflowLogger.warn(`node ${id} does not match (${JSON.stringify(info)} vs ${JSON.stringify(otherInfo)})`)
        return false
      }

      if(info.definedAtPosition !== otherInfo.definedAtPosition) {
        dataflowLogger.warn(`node ${id} does not match on definedAtPosition (${JSON.stringify(info.definedAtPosition)} vs ${JSON.stringify(otherInfo.definedAtPosition)})`)
        return false
      }

      if(info.when !== otherInfo.when) {
        dataflowLogger.warn(`node ${id} does not match on when (${JSON.stringify(info.when)} vs ${JSON.stringify(otherInfo.when)})`)
        return false
      }


      if(info.edges.length !== otherInfo.edges.length) {
        dataflowLogger.warn(`node ${id} does not match on amount of edges (${JSON.stringify(info.edges)} vs ${JSON.stringify(otherInfo.edges)})`)
        return false
      }

      if(!environmentsEqual(info.environment, otherInfo.environment)) {
        dataflowLogger.warn(`node ${id} does not match on environments (${JSON.stringify(info.environment)} vs ${JSON.stringify(otherInfo.environment)})`)
        return false
      }

      if(!equalFunctionArguments(info.functionCall, otherInfo.functionCall)) {
        dataflowLogger.warn(`node ${id} does not match on function arguments (${JSON.stringify(info.functionCall)} vs ${JSON.stringify(otherInfo.functionCall)})`)
        return false
      }

      if(!equalExitPoints(info.exitPoints, otherInfo.exitPoints)) {
        dataflowLogger.warn(`node ${id} does not match on exit points (${JSON.stringify(info.exitPoints)} vs ${JSON.stringify(otherInfo.exitPoints)})`)
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
  guard(equalFunctionArguments(current.functionCall, next.functionCall), 'nodes to be joined for the same id must have the same function call information')
  guard(equalExitPoints(current.exitPoints, next.exitPoints), 'nodes to be joined must have same exist poinits')
  return {
    name:              current.name,
    definedAtPosition: current.definedAtPosition,
    when:              current.when,
    environment:       current.environment,
    functionCall:      current.functionCall,
    // TODO: join edges
    edges:             [...current.edges, ...next.edges],
    exitPoints:        current.exitPoints,
  }
}
