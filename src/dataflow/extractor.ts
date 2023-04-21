import { log } from '../util/log'
import { BiMap } from '../util/bimap'
import { type Id, type IdRNode, type IdType } from './id'
import { foldAST } from '../r-bridge/lang:4.x/ast/fold'

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
export type DataflowMap<OtherInfo> = BiMap<IdType, IdRNode<OtherInfo>>

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

function processUninterestingLeaf<OtherInfo>(leaf: IdRNode<OtherInfo>): FoldInfo {
  return { activeNodes: [] }
}

function processBinaryOp<OtherInfo>(op: IdRNode<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo {
  // TODO: produce edges
  const activeNodes = [...lhs.activeNodes, ...rhs.activeNodes]
  return { activeNodes }
}

function processIfThenElse<OtherInfo>(ifThen: IdRNode<OtherInfo>, cond: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo {
  return { activeNodes: [...cond.activeNodes, ...then.activeNodes, ...(otherwise?.activeNodes ?? [])] }
}

function processExprList<OtherInfo>(exprList: IdRNode<OtherInfo>, children: FoldInfo[]): FoldInfo {
  return { activeNodes: children.flatMap(child => child.activeNodes) }
}

export function produceDataFlowGraph<OtherInfo>(ast: IdRNode<OtherInfo>): {
  dataflowIdMap: DataflowMap<OtherInfo>
  dataflowGraph: DataflowGraph
} {
  const dataflowIdMap = new BiMap<IdType, IdRNode<OtherInfo>>()
  const dataflowGraph: DataflowGraph = {
    nodes: [],
    edges: new Map<IdType, IdType[]>() // TODO: default map?
  }

  const foldResult = foldAST<OtherInfo & Id, FoldInfo>(ast, {
    foldNumber: processUninterestingLeaf,
    foldString: processUninterestingLeaf,
    foldLogical: processUninterestingLeaf,
    // TODO: change
    foldSymbol: processUninterestingLeaf,
    binaryOp: {
      foldLogicalOp: processBinaryOp,
      foldArithmeticOp: processBinaryOp,
      foldComparisonOp: processBinaryOp,
      // TODO: deal with assignments
      foldAssignment: processBinaryOp
    },
    foldIfThenElse: processIfThenElse,
    foldExprList: processExprList
  })

  // TODO: process
  dataflowLogger.warn(`remaining actives: ${JSON.stringify(foldResult)}`)

  // TODO: implement
  return { dataflowIdMap, dataflowGraph }
}
