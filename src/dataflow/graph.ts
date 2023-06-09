// TODO: modify | alias | etc.
import { guard } from '../util/assert'
import { NodeId, RNodeWithParent } from '../r-bridge'
import { IdentifierReference } from './environments'
import { BiMap } from '../util/bimap'
import { MergeableRecord } from '../util/objects'
import { log } from '../util/log'

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
export const LocalScope = '<local>'

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


export interface DataflowGraphNodeInfo extends MergeableRecord {
  name:              string
  definedAtPosition: false | DataflowScopeName
  /** When is usually `always`, yet global/local assignments in ifs, loops, or function definitions do not have to happen. They are marked with 'maybe'. */
  when:              DataflowGraphEdgeAttribute
  edges:             DataflowGraphEdge[]
}

type ReferenceForEdge = Pick<IdentifierReference, 'nodeId' | 'used'>

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
   * Adds a new node to the graph
   *
   * @param id - the id of the node
   * @param name - the name of the node
   * @param definedAtPosition - if false, the node is marked as `used`, otherwise, if you give the scope, it will be marked as `defined` within the given scope
   * @param when - is the node active in all program paths or only in potentially in some
   */
  public addNode(id: NodeId, name: string, definedAtPosition: false | DataflowScopeName = false, when: DataflowGraphEdgeAttribute = 'always'): this {
    const oldNode = this.graph.get(id)
    if(oldNode !== undefined) {
      guard(oldNode.name === name, 'node names must match for the same id if added')
      return this
    }
    this.graph.set(id, {
      name,
      definedAtPosition,
      when,
      edges: []
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
    const fromId = typeof from === 'object' ? from.nodeId : from
    const toId = typeof to === 'object' ? to.nodeId : to

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
      return false
    }
    for(const [id, info] of this.graph) {
      const otherInfo = other.graph.get(id)
      if(otherInfo === undefined || info.name !== otherInfo.name || info.definedAtPosition !== otherInfo.definedAtPosition || info.when !== otherInfo.when || info.edges.length !== otherInfo.edges.length) {
        return false
      }
      // TODO: assuming that all edges are unique (which should be ensured by constructed)
      for(const edge of info.edges) {
        // TODO: improve finding edges
        if(otherInfo.edges.find(e => e.target === edge.target && e.type === edge.type && e.attribute === edge.attribute) === undefined) {
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
  return {
    name:              current.name,
    definedAtPosition: current.definedAtPosition,
    when:              current.when,
    // TODO: join edges
    edges:             [...current.edges, ...next.edges]
  }
}
