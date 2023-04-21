// assign each node with a unique id to simplify usage and further compares
import {
  type RBinaryOp, type RExprList,
  type RNode
} from '../r-bridge/lang:4.x/ast/model'
import { foldAST } from '../r-bridge/lang:4.x/ast/fold'

export type IdType = string
export interface Id { id: IdType }

/** uniquely identifies AST-Nodes */
export type IdRNode<OtherInfo> = RNode<OtherInfo & Id> & Id

// TODO: other generators?
/**
 * The simplest id generator which just increments a number on each call
 */
export function deterministicCountingIdGenerator<OtherInfo>(): (data: RNode<Exclude<OtherInfo, Id>>) => IdType {
  let id = 0
  return () => `${id++}`
}

/**
 * Decorate the given AST by assigning an unique ID to each node
 *
 * @param ast the ast to decorate, must not already have an id field! (TODO: check guard)
 * @param getId the id generator: must generate a unique id für each passed node
 *
 * @typeParam OtherInfo the original decoration of the ast nodes (probably is nothing as the id decoration is most likely the first step to be performed after extraction)
 */
export function decorateWithIds<OtherInfo>(ast: RNode<Exclude<OtherInfo, Id>>, getId = deterministicCountingIdGenerator<OtherInfo>()): IdRNode<OtherInfo> {
  const foldLeaf = (leaf: RNode<OtherInfo>): IdRNode<OtherInfo> => ({ ...leaf, id: getId(leaf) })
  const binaryOp = (op: RBinaryOp<OtherInfo>, lhs: IdRNode<OtherInfo>, rhs: IdRNode<OtherInfo>): IdRNode<OtherInfo> => ({ ...op, lhs, rhs, id: getId(op) })
  const foldIfThenElse = (ifThen: RNode<OtherInfo>, cond: IdRNode<OtherInfo>, then: IdRNode<OtherInfo>, otherwise?: IdRNode<OtherInfo>): IdRNode<OtherInfo> => ({ ...ifThen, cond, then, otherwise, id: getId(ifThen) })
  const foldExprList = (exprList: RExprList<OtherInfo>, children: Array<IdRNode<OtherInfo>>): IdRNode<OtherInfo> => ({ ...exprList, children, id: getId(exprList) })

  return foldAST(ast, {
    foldNumber: foldLeaf,
    foldString: foldLeaf,
    foldLogical: foldLeaf,
    foldSymbol: foldLeaf,
    binaryOp: {
      foldLogicalOp: binaryOp,
      foldArithmeticOp: binaryOp,
      foldComparisonOp: binaryOp,
      foldAssignment: binaryOp
    },
    foldIfThenElse,
    foldExprList
  })
}
