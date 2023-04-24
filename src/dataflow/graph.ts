
// TODO: modify | alias | etc.
import { IdType } from './id'
import * as Lang from '../r-bridge/lang:4.x/ast/model'
import { DataflowMap } from './extractor'
import { NoInfo } from '../r-bridge/lang:4.x/ast/model'
import { guard } from "../util/assert"

export type DataflowGraphEdgeType =
    | /** the edge determines that source reads target */ 'read'
    | /** the edge determines that source is defined by target */ 'defined-by'
    | /** the edge determines that both nodes reference the same variable in a lexical/scoping sense, source and target are interchangeable (reads for at construction unbound variables) */ 'same-read-read'
    | /** similar to {@link 'same-read-read'} but for def-def constructs without a read in-between */ 'same-def-def'

// context -- is it always read/defined-by // TODO: loops
export type DataflowGraphEdgeAttribute = 'always' | 'maybe'


// TODO: on fold clarify with in and out-local, out-global! (out-function?)

export const GLOBAL_SCOPE = '.GlobalEnv'
export const LOCAL_SCOPE = '<local>'

/**
 * used to represent usual R scopes
 */
export type DataflowScopeName =
  | /** default R global environment */            typeof GLOBAL_SCOPE
  | /** unspecified automatic local environment */ typeof LOCAL_SCOPE
  | /** named environments */                      string


/**
 * An edge consist of the target node (i.e., the variable or processing node),
 * a type (if it is read or used in the context), and an attribute (if this edge exists for every program execution or
 * if it is only one possible execution path).
 *
 * These edges are specialised by {@link DataflowGraphReadEdge} and {@link DataflowGraphDefinedByEdge}
 */
export interface DataflowGraphEdge {
  target:    IdType
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


export interface DataflowGraphNodeInfo {
  name:              string
  definedAtPosition: false | DataflowScopeName
  edges:             DataflowGraphEdge[]
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
  private graph = new Map<IdType, DataflowGraphNodeInfo>()

  /**
   * @return the ids of all nodes in the graph
   */
  public nodes(): IterableIterator<IdType> {
    return this.graph.keys()
  }

  /**
   * @return the node info for the given id (if it exists)
   */
  public get(id: IdType): DataflowGraphNodeInfo | undefined {
    return this.graph.get(id)
  }

  public entries(): IterableIterator<[IdType, DataflowGraphNodeInfo]> {
    return this.graph.entries()
  }

  public addNode(id: IdType, name: string, definedAtPosition: false | DataflowScopeName = false): DataflowGraph {
    const oldNode = this.graph.get(id)
    if(oldNode !== undefined) {
      guard(oldNode.name === name, 'node names must match for the same id if added')
      return this
    }
    this.graph.set(id, {
      name,
      definedAtPosition,
      edges: []
    })
    return this
  }


  public addEdges(from: IdType, to: IdType[], type: DataflowGraphEdgeType, attribute: DataflowGraphEdgeAttribute): DataflowGraph {
    // TODO: make this far more performant!
    for(const toId of to) {
      this.addEdge(from, toId, type, attribute)
    }
    return this
  }

  /**
   * Will insert a new edge into the graph,
   * if the direction of the edge is of no importance (`same-read-read` or `same-def-def`), source
   * and target will be sorted so that `from` has the lower, and `to` the higher id (default ordering).
   *
   * TODO: ensure that target has a def scope and source does not?
   */
  public addEdge(from: IdType, to: IdType, type: DataflowGraphEdgeType, attribute: DataflowGraphEdgeAttribute): DataflowGraph {
    // sort
    if(type === 'same-read-read' || type === 'same-def-def') {
      [from, to] = to > from ? [from, to] : [to, from]
    }
    const info = this.graph.get(from)
    guard(info !== undefined, 'there must be a node info object for the edge source!')
    const edge = {
      target: to,
      type,
      attribute
    }
    // TODO: make this more performant
    if(info.edges.find(e => e.target === to && e.type === type && e.attribute === attribute) === undefined) {
      info.edges.push(edge)
    }
    return this
  }


  /** insert a new edge in the given dataflow-graph */
  // TODO: check if from and to exists, TODO: check for duplicates
  public mergeWith(...otherGraphs: (DataflowGraph | undefined)[]): DataflowGraph {
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
      if(otherInfo === undefined || info.name !== otherInfo.name || info.definedAtPosition !== otherInfo.definedAtPosition || info.edges.length !== otherInfo.edges.length) {
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
    // TODO: join edges
    edges:             [...current.edges, ...next.edges]
  }
}

function formatRange(range: Lang.Range | undefined): string {
  if (range === undefined) {
    return '??'
  }

  return `${range.start.line}.${range.start.column}-${range.end.line}.${range.end.column}`
}

// TODO: subgraphs?
export function graphToMermaid(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined): string {
  const lines = ['flowchart LR']
  for (const [id, info] of graph.entries()) {
    const def = info.definedAtPosition !== false
    lines.push(`    ${id}${def ? "[" : "([" }"\`${info.name}\n      *${formatRange(dataflowIdMap?.get(id)?.location)}*\`"${def ? "]" : "])" }`)
    for (const edge of info.edges) {
      const sameEdge = edge.type === 'same-def-def' || edge.type === 'same-read-read'
      lines.push(`    ${id} ${sameEdge ? '-.-' : '-->'}|"${edge.type} (${edge.attribute})"| ${edge.target}`)
    }
  }
  return lines.join('\n')
}

export function graphToMermaidUrl(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined): string {
  const obj = {
    code:    graphToMermaid(graph, dataflowIdMap),
    mermaid: {
      "theme": "default"
    },
    updateEditor:  false,
    autoSync:      true,
    updateDiagram: false
  }
  return `https://mermaid.live/edit#base64:${Buffer.from(JSON.stringify(obj)).toString('base64')}`
}
