import { log } from '../util/log'
import { BiMap } from '../util/bimap'
import { type Id, type IdType } from './id'
import { foldAST } from '../r-bridge/lang:4.x/ast/fold'
import { RNa, RNull } from '../r-bridge/lang:4.x/values'
import { type RSymbol } from '../r-bridge/lang:4.x/ast/model'
import { type ParentInformation, type RNodeWithParent } from './parents'

const dataflowLogger = log.getSubLogger({ name: 'ast' })

/**
 * The basic dataflow algorithm will work like this:
 * Folding the ast from the leaves up it will perform the following actions (and nothing for all other nodes):
 * - for every variable usage it will create a node in the dataflow graph and add it to the active set
 * - if it encounters a definition, all targeted variables will be tagged with the corresponding definition operator form {@link Assignments}
 * TODO:
 *
 */

/** used to get an entry point for every id, after that it allows reference-chasing of the graph */
export type DataflowMap<OtherInfo> = BiMap<IdType, RNodeWithParent<OtherInfo>>

// TODO: improve on the graph
// TODO: deal with overshadowing, same names etc.

/**
 * holds the dataflow information found within the given AST
 * there is a node for every variable encountered, obeying scoping rules
 * TODO: additional information for edges
 */
export interface DataflowGraph {
  nodes: Array<{
    id: IdType
    name: string
  }>
  edges: Map<IdType, IdType[]>
}

interface FoldInfo {
  activeNodes: IdType[] /* TODO: SET? */
}

function processUninterestingLeaf<OtherInfo>(leaf: RNodeWithParent<OtherInfo>): FoldInfo {
  return { activeNodes: [] }
}

// TODO: is out parameter info the best choice? or should i remain with a closure? i want to reduce nesting
function processSymbol<OtherInfo>(info: DataflowInformation<OtherInfo>): (symbol: RSymbol<OtherInfo & Id & ParentInformation>) => FoldInfo {
  // TODO: are there other built-ins?
  return symbol => {
    if (symbol.content === RNull || symbol.content === RNa) {
      return { activeNodes: [] }
    }
    // TODO: can be replaced by id set if we have a mapping with ids
    info.dataflowIdMap.set(symbol.id, symbol)
    info.dataflowGraph.nodes.push({ id: symbol.id, name: symbol.content })
    return { activeNodes: [symbol.id] }
  }
}

function processBinaryOp<OtherInfo>(op: RNodeWithParent<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  const activeNodes = [...lhs.activeNodes, ...rhs.activeNodes]
  // TODO: produce special edges
  return { activeNodes }
}

function addEdge(graph: DataflowGraph, from: IdType, to: IdType): void {
  const targets = graph.edges.get(from)
  if (targets === undefined) {
    graph.edges.set(from, [to])
  } else {
    targets.push(to)
  }
}

// TODO: nested assignments like x <- y <- z <- 1
function processAssignment<OtherInfo>(info: DataflowInformation<OtherInfo>): (op: RNodeWithParent<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo) => FoldInfo {
  return (op, lhs, rhs) => {
    // TODO: identify global, local etc.
    const read = rhs.activeNodes
    const write = lhs.activeNodes
    for (const writeId of write) {
      for (const readId of read) {
        addEdge(info.dataflowGraph, readId, writeId)
      }
    }
    return { activeNodes: write }
  }
}

function processIfThenElse<OtherInfo>(ifThen: RNodeWithParent<OtherInfo>, cond: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo {
  return { activeNodes: [...cond.activeNodes, ...then.activeNodes, ...(otherwise?.activeNodes ?? [])] }
}

function processExprList<OtherInfo>(exprList: RNodeWithParent<OtherInfo>, children: FoldInfo[]): FoldInfo {
  return { activeNodes: children.flatMap(child => child.activeNodes) }
}

export interface DataflowInformation<OtherInfo> {
  dataflowIdMap: DataflowMap<OtherInfo>
  dataflowGraph: DataflowGraph
}

export function produceDataFlowGraph<OtherInfo>(ast: RNodeWithParent<OtherInfo>): DataflowInformation<OtherInfo> {
  const info = {
    dataflowIdMap: new BiMap<IdType, RNodeWithParent<OtherInfo>>(),
    dataflowGraph: {
      nodes: [],
      edges: new Map<IdType, IdType[]>() // TODO: default map?
    }
  }

  const foldResult = foldAST<OtherInfo & Id & ParentInformation, FoldInfo>(ast, {
    foldNumber: processUninterestingLeaf,
    foldString: processUninterestingLeaf,
    foldLogical: processUninterestingLeaf,
    // TODO: change
    foldSymbol: processSymbol(info),
    binaryOp: {
      foldLogicalOp: processBinaryOp,
      foldArithmeticOp: processBinaryOp,
      foldComparisonOp: processBinaryOp,
      // TODO: deal with assignments
      foldAssignment: processAssignment(info)
    },
    foldIfThenElse: processIfThenElse,
    foldExprList: processExprList
  })

  // TODO: process
  dataflowLogger.warn(`remaining actives: ${JSON.stringify(foldResult)}`)

  // TODO: implement
  return info
}
