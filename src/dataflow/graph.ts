
// TODO: modify | alias | etc.
import { IdType } from './id'

export type DataflowGraphEdgeType = 'read' | 'defined-by'
// context -- is it always read/defined-by // TODO: loops
export type DataflowGraphEdgeAttribute = 'always' | 'maybe'



export type DataflowScopeName =
  | /** default R global environment */            '.GlobalEnv'
  | /** unspecified automatic local environment */ '<local>'
  | /** named environments */                      string

export const GLOBAL_SCOPE: DataflowScopeName = '.GlobalEnv'
export const LOCAL_SCOPE: DataflowScopeName = '<local>'

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

export function mergeDataflowGraphs(a : DataflowGraph, b: DataflowGraph): DataflowGraph {
  // TODO: join edges
  // TODO: check for duplicate nodes
  // TODO: maybe switch to sets?
  const nodes = [...a.nodes, ...b.nodes]
  const edges = new Map([...a.edges, ...b.edges])

  return { nodes, edges }
}

