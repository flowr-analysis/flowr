
// TODO: modify | alias | etc.
import { IdType } from './id'

export type DataflowGraphEdgeType =
    | /* the edge determines that source reads target */ 'read'
    | /* the edge determines that source is defined by target */ 'defined-by'
    | /* the edge determines that both nodes reference the same variable in a lexical/scoping sense, source and target are interchangeable */ 'same'

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

/**
 * a node in the graph is identified by its unique id (usually assigned by {@link #decorateWithIds})
 * and a name (like the name of the variable reference)
 */
export interface DataflowGraphNode {
  id:   IdType
  name: string
}

/**
 * holds the dataflow information found within the given AST
 * there is a node for every variable encountered, obeying scoping rules
 * TODO: additional information for edges
 */
export interface DataflowGraph {
  nodes: DataflowGraphNode[]
  edges: Map<IdType, DataflowGraphEdge[]>
}


/** insert a new edge in the given dataflow-graph */
// TODO: check if from and to exists, TODO: check for duplicates
export function addEdge(graph: DataflowGraph, from: IdType, to: IdType, type: DataflowGraphEdgeType, attribute: DataflowGraphEdgeAttribute): void {
  const targets = graph.edges.get(from)
  const edge = {
    target: to,
    type,
    attribute
  }
  if (targets === undefined) {
    graph.edges.set(from, [edge])
  } else {
    // TODO: deal with same in the other direction, is a duplicate
    if(!targets.includes(edge)) {
      targets.push(edge)
    }
  }
}

export function mergeDataflowGraphs(...graphs: (DataflowGraph | undefined)[]): DataflowGraph {
  // TODO: join edges
  // TODO: check for duplicate nodes
  // TODO: maybe switch to sets?
  const nodes = graphs.flatMap(g => g?.nodes ?? [])
  const edges = new Map(graphs.flatMap(g => [...g?.edges.entries()?? []] ))

  return { nodes, edges }
}

