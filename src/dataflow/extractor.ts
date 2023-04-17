import {
  type RAssignmentOp, type RBinaryOp, type RExprList,
  type RLogical,
  type RNode,
  type RNumber,
  type RString,
  type RSymbol
} from '../r-bridge/lang:4.x/ast/model'
import { foldAST } from '../r-bridge/lang:4.x/ast/fold'
import { RNa, RNull } from '../r-bridge/lang:4.x/values'
import { log } from '../util/log'
import { isNotUndefined } from '../util/assert'

export type DataflowId = string

export interface DataflowInfo {
  id: DataflowId
  // TODO: more definition information
  definedBy?: DataflowId
}

// TODO: addtional & is dirty type fix?
export type DataflowNode<OtherInfo> = RNode<OtherInfo & { dataflow: DataflowInfo }> & { info: { dataflow: DataflowInfo } }

// used to get an entry point for every id, after that it allows reference-chasing of the graph
export type DataflowMap<OtherInfo> = Map<DataflowId, DataflowNode<OtherInfo>>

// TODO: improve on the graph
// TODO: deal with overshadowing, same names etc.

export interface DataflowGraph {
  nodes: Array<{
    id: DataflowId
    name: string
  }>
  edges: Map<DataflowId, DataflowId[]>
}

export function decorateWithDataFlowInfo<OtherInfo>(ast: RNode<OtherInfo>): {
  decoratedAst: DataflowNode<OtherInfo>
  dataflowIdMap: DataflowMap<OtherInfo>
  dataflowGraph: DataflowGraph
} {
  // active contains the list of read/written to variables atm
  interface FoldInfo {
    data: DataflowNode<OtherInfo>
    active: {
      // TODO: name and id
      read: string[]
      def: string[]
    }
  }

  const dataflowIdMap = new Map<DataflowId, DataflowNode<OtherInfo>>()

  const dataflowGraph: DataflowGraph = {
    nodes: [],
    edges: new Map<DataflowId, DataflowId[]>() // TODO: default map?
  }

  // TODO: symbol map

  let currentId = 0
  const getNewId = (node: RNode<OtherInfo>, usageOfVariable = false): FoldInfo => {
    currentId++ // todo: find a better way?
    const newNode = { ...node, info: { dataflow: { id: currentId.toString() } } }
    const id = currentId.toString()
    dataflowIdMap.set(id, newNode)
    return { data: newNode, active: { read: usageOfVariable ? [node.lexeme ?? 'unknown'] : [], def: [] } }
  }

  const mergeActives = (...actives: Array<undefined | FoldInfo['active']>): FoldInfo['active'] => {
    const read = actives.flatMap(active => active?.read).filter(isNotUndefined)
    const def = actives.flatMap(active => active?.def).filter(isNotUndefined)
    return { read, def }
  }

  const foldNumber = (num: RNumber<OtherInfo>): FoldInfo => getNewId(num)
  const foldString = (str: RString<OtherInfo>): FoldInfo => getNewId(str)
  const foldLogical = (logical: RLogical<OtherInfo>): FoldInfo => getNewId(logical)
  const foldSymbol = (symbol: RSymbol<OtherInfo>): FoldInfo => {
    // TODO: detect built-in
    if (symbol.content === RNull || symbol.content === RNa) {
      return getNewId(symbol)
    } else {
      const node = getNewId(symbol, true)
      dataflowGraph.nodes.push({ id: node.data.info.dataflow.id, name: node.data.lexeme ?? '<unknown>' })
      return node
    }
  }

  const foldLogicalOp = (op: RBinaryOp<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo => {
    const newOp = getNewId(op)
    newOp.data.lhs = lhs.data
    newOp.data.rhs = rhs.data
    return { data: newOp.data, active: mergeActives(newOp.active, lhs.active, rhs.active) }
  }

  // TODO: edge type and changed edge-types?
  const foldArithmeticOp = foldLogicalOp
  const foldComparisonOp = foldLogicalOp

  const foldAssignment = (op: RAssignmentOp<OtherInfo>, lhs: FoldInfo, rhs: FoldInfo): FoldInfo => {
    const newOp = getNewId(op, true)
    newOp.data.lhs = lhs.data
    newOp.data.rhs = rhs.data

    // TODO: ensure that it is only one symbol on lhs or rhs
    // TODO: global assignments in scope
    // TODO: FIX for both sides (+eq_assignment) !
    if (op.op === '<-' || op.op === '<<-') {
      const def = lhs.data.lexeme
      const read = rhs.active.read
      if (def !== undefined) {
        console.log('ADDING', def, read)
        dataflowGraph.edges.set(def, read)
        newOp.active.def = [def]
      }
    }

    return { data: newOp.data, active: mergeActives(newOp.active, lhs.active, rhs.active) }
  }

  const foldIfThenElse = (condition: FoldInfo, then: FoldInfo, otherwise?: FoldInfo): FoldInfo => {
    /* no scoping for if */
    condition.data.then = then.data
    condition.data.otherwise = otherwise?.data
    return { data: condition.data, active: mergeActives(condition.active, then.active, otherwise?.active) }
  }

  const foldExprList = (exprList: RExprList<OtherInfo>, expressions: FoldInfo[]): FoldInfo => {
    const newExprList = getNewId(exprList)
    newExprList.data.children = expressions.map(exp => exp.data)
    // TODO: this is wrong, make read-def chains in order of appearance
    return { data: newExprList.data, active: mergeActives(newExprList.active, ...expressions.map(e => e.active)) }
  }

  const foldResult = foldAST<OtherInfo, FoldInfo>(ast, {
    foldNumber,
    foldString,
    foldLogical,
    foldSymbol,
    binaryOp: {
      foldLogicalOp,
      foldArithmeticOp,
      foldComparisonOp,
      foldAssignment
    },
    foldIfThenElse,
    foldExprList
  })

  // log.info('dataflowIdMap', dataflowIdMap)
  return {
    decoratedAst: foldResult.data,
    dataflowGraph,
    dataflowIdMap
  }
}
