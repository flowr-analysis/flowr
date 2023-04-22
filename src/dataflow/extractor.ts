import { log } from '../util/log'
import { BiMap } from '../util/bimap'
import { type Id, type IdType } from './id'
import { foldAst } from '../r-bridge/lang:4.x/ast/fold'
import { RNa, RNull } from '../r-bridge/lang:4.x/values'
import type * as Lang from '../r-bridge/lang:4.x/ast/model'
import { type ParentInformation, type RNodeWithParent } from './parents'
import { guard } from '../util/assert'

const dataflowLogger = log.getSubLogger({ name: 'ast' })

/**
 * The basic dataflow algorithm will work like this:
 * Every node produces a dataflow graph, higher operations will be merge the graphs together
 */

/** used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<IdType, RNodeWithParent<OtherInfo>>

// TODO: modify | alias | etc.
export type DataflowGraphEdgeType = 'read' | 'defined-by'
// context -- is it always read/defined-by // TODO: loops
export type DataflowGraphEdgeAttribute = 'always' | 'maybe'

export interface DataflowGraphEdge {
  target:    IdType
  type:      DataflowGraphEdgeType
  attribute: DataflowGraphEdgeAttribute
}

/**
 * holds the dataflow information found within the given AST
 * there is a node for every variable encountered, obeying scoping rules
 * TODO: additional information for edges
 */
export interface DataflowGraph {
  nodes: Array<{
    id:   IdType
    name: string
  }>
  edges: Map<IdType, DataflowGraphEdge[]>
}

export type ScopeName = /** default R global environment */ '.GlobalEnv' | /** unspecified automatic local environment */ '<local>' | /** named environments */ string
export const GLOBAL_SCOPE: ScopeName = '.GlobalEnv'
export const LOCAL_SCOPE: ScopeName = '<local>'

interface FoldReadWriteTarget {
  attribute: DataflowGraphEdgeAttribute
  id:        IdType
}

interface FoldInfo {
  /** variable names that have been used without clear indication of their origin (i.e. if they will be read or written to) */
  activeNodes: IdType[]
  /** variables that have been read in the current block */
  read:        IdType[] // TODO: read from env?
  /** variables that have been written to the given scope */
  writeTo:     Map<ScopeName, FoldReadWriteTarget[]>
}

function emptyFoldInfo(): FoldInfo {
  return { activeNodes: [], read: [], writeTo: new Map() }
}

function processUninterestingLeaf<OtherInfo>(leaf: RNodeWithParent<OtherInfo>): FoldInfo {
  return emptyFoldInfo()
}

// TODO: is out parameter info the best choice? or should i remain with a closure? i want to reduce nesting
function processSymbol<OtherInfo>(info: DataflowInformation<OtherInfo>): (symbol: Lang.RSymbol<OtherInfo & Id & ParentInformation>) => FoldInfo {
  // TODO: are there other built-ins?
  return symbol => {
    if (symbol.content === RNull || symbol.content === RNa) {
      return emptyFoldInfo()
    }
    // TODO: can be replaced by id set if we have a mapping with ids
    info.dataflowIdMap.set(symbol.id, symbol)
    info.dataflowGraph.nodes.push({ id: symbol.id, name: symbol.content })
    return { activeNodes: [symbol.id], read: [], writeTo: new Map() }
  }
}

function processBinaryOp<OtherInfo>(op: RNodeWithParent<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  // TODO: produce special edges
  // TODO: fix merge of map etc.
  return { activeNodes: [...lhs.activeNodes, ...rhs.activeNodes], read: [...lhs.read, ...rhs.read], writeTo: new Map([...lhs.writeTo, ...rhs.writeTo]) }
}

// TODO: edge types
function addEdge(graph: DataflowGraph, from: IdType, to: IdType, type: DataflowGraphEdgeType, attribute: DataflowGraphEdgeAttribute): void {
  const targets = graph.edges.get(from)
  const edge = { target: to, type, attribute }
  if (targets === undefined) {
    graph.edges.set(from, [edge])
  } else {
    targets.push(edge)
  }
}

// TODO: nested assignments like x <- y <- z <- 1
function processAssignment<OtherInfo>(info: DataflowInformation<OtherInfo>): (op: RNodeWithParent<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo) => FoldInfo {
  return (op, lhs, rhs) => {
    let read: IdType[]
    let write: IdType[]
    // TODO: function scope for '=' in functions
    let global = false

    switch (op.lexeme) {
      case '<-':
        read = rhs.activeNodes
        write = lhs.activeNodes
        break
      case '<<-':
        read = rhs.activeNodes
        write = lhs.activeNodes
        global = true
        break
      case '=':
        read = rhs.activeNodes
        write = lhs.activeNodes
        // TODO: call-local
        break
      case '->':
        read = lhs.activeNodes
        write = rhs.activeNodes
        break
      case '->>':
        read = lhs.activeNodes
        write = rhs.activeNodes
        global = true
        break
      default:
        throw new Error(`Unknown assignment operator ${JSON.stringify(op)}`)
    }
    // TODO: identify global, local etc.
    for (const writeId of write) {
      for (const readId of read) {
        // TODO: update in if etc? => move grpahs to top and merge them here
        addEdge(info.dataflowGraph, writeId, readId, 'defined-by', 'always')
      }
    }
    // TODO URGENT: keep write to
    const targets: FoldReadWriteTarget[] = write.map(id => ({ attribute: 'always', id }))
    return { activeNodes: [], read, writeTo: new Map([[global ? GLOBAL_SCOPE : LOCAL_SCOPE, targets]]) }
  }
}

// TODO: potential dataflow with both branches!
function processIfThenElse<OtherInfo>(ifThen: RNodeWithParent<OtherInfo>, cond: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo {
  return { activeNodes: [...cond.activeNodes, ...then.activeNodes, ...(otherwise?.activeNodes ?? [])], read: [...cond.read, ...then.read, ...(otherwise?.read ?? [])], writeTo: new Map([...cond.writeTo, ...then.writeTo, ...(otherwise?.writeTo ?? [])]) }
}

// TODO: instead of maybe use nested if-then path possibilities for abstract interpretation?
type WritePointerTargets = { type: 'always', id: IdType } | { type: 'maybe', ids: IdType[] }
type WritePointers = Map<IdType, WritePointerTargets>

// TODO: test
function updateAllWriteTargets<OtherInfo>(currentChild: FoldInfo, info: DataflowInformation<OtherInfo>, writePointers: WritePointers): void {
  for (const [, writeTargets] of currentChild.writeTo) {
    for (const writeTarget of writeTargets) {
      const mustHaveTarget = info.dataflowIdMap.get(writeTarget.id)
      guard(mustHaveTarget !== undefined, `Could not find target for ${JSON.stringify(writeTarget)}`)
      const writeName = mustHaveTarget.lexeme
      guard(writeName !== undefined, `${writeTarget.id} does not have an attached writeName`)
      // TODO: hide in merge - monoid!

      const previousValue = writePointers.get(writeName)
      if (writeTarget.attribute === 'always' && previousValue?.type !== 'maybe') { // add it as an always
        writePointers.set(writeName, { type: 'always', id: writeTarget.id })
      } else {
        let newTargets
        if (previousValue?.type === 'always') {
          newTargets = [previousValue.id, writeTarget.id]
        } else {
          newTargets = [...(previousValue?.ids ?? []), writeTarget.id]
        }
        writePointers.set(writeName, { type: 'maybe', ids: newTargets })
      }
    }
  }
}

function processExprList<OtherInfo>(info: DataflowInformation<OtherInfo>): (exprList: RNodeWithParent<OtherInfo>, children: FoldInfo[]) => FoldInfo {
  // TODO: deal with information in order + scoping when we have functions
  // we assume same scope for local currently, yet we return local writes too, as a simple exprList does not act as scoping block
  // link a given name to IdTypes
  return (exprList, children) => {
    // TODO: keep scope for writePointers
    const writePointers = new Map<string, WritePointerTargets>()
    const remainingRead = []

    // TODO: optimize by linking names
    for (const element of children) {
      const currentElement: FoldInfo = element
      for (const readId of currentElement.read) {
        const existingRef = info.dataflowIdMap.get(readId)
        const readName = existingRef?.lexeme
        if (readName === undefined) {
          throw new Error(`Could not find name for ${readId}`)
        }
        const probableTarget = writePointers.get(readName)
        if (probableTarget === undefined) {
          // keep it, for we have no target
          remainingRead.push(readId)
        } else if (probableTarget.type === 'always') {
          addEdge(info.dataflowGraph, readId, probableTarget.id, 'read', 'always')
        } else {
          for (const target of probableTarget.ids) {
            addEdge(info.dataflowGraph, readId, target, 'read', 'maybe')
          }
        }
      }

      // for each variable read add the closest write and if we have one, remove it from read
      updateAllWriteTargets(currentElement, info, writePointers)
    }
    return {
      // TODO: ensure active killed on that level?
      activeNodes: children.flatMap(child => child.activeNodes),
      read:        remainingRead,
      writeTo:     new Map(children.flatMap(child => [...child.writeTo]))
    }
  }
}

export interface DataflowInformation<OtherInfo> {
  dataflowIdMap: DataflowMap<OtherInfo> // TODO: migrate if ids moved to parents
  dataflowGraph: DataflowGraph
}

export function produceDataFlowGraph<OtherInfo>(ast: RNodeWithParent<OtherInfo>): DataflowInformation<OtherInfo> {
  const info = {
    dataflowIdMap: new BiMap<IdType, RNodeWithParent<OtherInfo>>(),
    dataflowGraph: {
      nodes: [],
      edges: new Map<IdType, DataflowGraphEdge[]>() // TODO: default map?
    }
  }

  const foldResult = foldAst<OtherInfo & Id & ParentInformation, FoldInfo>(ast, {
    foldNumber:  processUninterestingLeaf,
    foldString:  processUninterestingLeaf,
    foldLogical: processUninterestingLeaf,
    foldSymbol:  processSymbol(info),
    binaryOp:    {
      foldLogicalOp:    processBinaryOp,
      foldArithmeticOp: processBinaryOp,
      foldComparisonOp: processBinaryOp,
      // TODO: deal with assignments
      foldAssignment:   processAssignment(info)
    },
    foldIfThenElse: processIfThenElse,
    foldExprList:   processExprList(info)
  })

  // TODO: process
  dataflowLogger.warn(`remaining actives: ${JSON.stringify(foldResult)}`)

  // TODO: implement
  return info
}
