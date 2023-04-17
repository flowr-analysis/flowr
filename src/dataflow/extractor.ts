import {
  type RArithmeticOp, type RAssignmentOp, type RComparisonOp, type RExprList,
  type RLogical,
  type RLogicalOp,
  type RNode,
  type RNumber,
  type RString,
  type RSymbol
} from '../r-bridge/lang:4.x/ast/model'
import { foldAST } from '../r-bridge/lang:4.x/ast/fold'

export type DataflowId = string

export interface DataflowInfo {
  id: DataflowId
  // TODO: more definition information
  definedBy?: DataflowId
}

export type DataflowNode<OtherInfo> = RNode<OtherInfo & { dataflow: DataflowInfo }>

// used to get an entry point for every id, after that it allows reference-chasing of the graph
export type DataflowMap<OtherInfo> = Map<DataflowId, DataflowNode<OtherInfo>>

export function decorateWithDataFlowInfo<OtherInfo>(ast: RNode<OtherInfo>): { ast: DataflowNode<OtherInfo>, map: DataflowMap<OtherInfo> } {
  const dataflowIdMap = new Map<DataflowId, DataflowNode<OtherInfo>>()
  // TODO: symbol map

  let currentId = 0
  const getNewId = (node: RNode<OtherInfo>): DataflowNode<OtherInfo> => {
    currentId++ // todo: find a better way?
    const newNode = { ...node, info: { dataflow: { id: currentId.toString() } } }
    dataflowIdMap.set(currentId.toString(), newNode)
    return newNode
  }

  const foldNumber = (num: RNumber<OtherInfo>): DataflowNode<OtherInfo> => getNewId(num)
  const foldString = (str: RString<OtherInfo>): DataflowNode<OtherInfo> => getNewId(str)
  const foldLogical = (logical: RLogical<OtherInfo>): DataflowNode<OtherInfo> => getNewId(logical)
  // TODO: trace variables for symbol!
  const foldSymbol = (symbol: RSymbol<OtherInfo>): DataflowNode<OtherInfo> => getNewId(symbol)

  const foldLogicalOp = (op: RLogicalOp<OtherInfo>, lhs: DataflowNode<OtherInfo>, rhs: DataflowNode<OtherInfo>): DataflowNode<OtherInfo> => {
    const newOp = getNewId(op)
    newOp.lhs = lhs
    newOp.rhs = rhs
    return newOp
  }

  const foldArithmeticOp = (op: RArithmeticOp<OtherInfo>, lhs: DataflowNode<OtherInfo>, rhs: DataflowNode<OtherInfo>): DataflowNode<OtherInfo> => {
    const newOp = getNewId(op)
    newOp.lhs = lhs
    newOp.rhs = rhs
    return newOp
  }

  const foldComparisonOp = (op: RComparisonOp<OtherInfo>, lhs: DataflowNode<OtherInfo>, rhs: DataflowNode<OtherInfo>): DataflowNode<OtherInfo> => {
    const newOp = getNewId(op)
    newOp.lhs = lhs
    newOp.rhs = rhs
    return newOp
  }

  const foldAssignment = (op: RAssignmentOp<OtherInfo>, lhs: DataflowNode<OtherInfo>, rhs: DataflowNode<OtherInfo>): DataflowNode<OtherInfo> => {
    const newOp = getNewId(op)
    return newOp
  }

  const foldIfThenElse = (condition: DataflowNode<OtherInfo>, then: DataflowNode<OtherInfo>, otherwise?: DataflowNode<OtherInfo>): DataflowNode<OtherInfo> => {
    condition.then = then
    condition.otherwise = otherwise
    return condition
  }

  const foldExprList = (exprList: RExprList<OtherInfo>, expressions: Array<DataflowNode<OtherInfo>>): DataflowNode<OtherInfo> => {
    const newExprList = getNewId(exprList)
    newExprList.children = expressions
    return newExprList
  }

  const foldResult = foldAST(ast, {
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

  return {
    ast: foldResult,
    map: dataflowIdMap
  }
}
