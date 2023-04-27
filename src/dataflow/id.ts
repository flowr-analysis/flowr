// assign each node with a unique id to simplify usage and further compares
import {
  type RBinaryOp,
  type RExpressionList, RForLoop,
  type RIfThenElse,
  type RNode,
  type RSingleNode
} from '../r-bridge/lang:4.x/ast/model'
import { foldAst } from '../r-bridge/lang:4.x/ast/fold'
import { BiMap } from '../util/bimap'

export type IdType = string

export interface Id {
  id: IdType
}

/** uniquely identifies AST-Nodes */
export type IdRNode<OtherInfo> = RNode<OtherInfo & Id>

export type IdGenerator<OtherInfo> = (data: RNode<OtherInfo>) => IdType

// TODO: other generators? => like one that uses the location
/**
 * The simplest id generator which just increments a number on each call
 */
export function deterministicCountingIdGenerator<OtherInfo> (start = 0): IdGenerator<OtherInfo> {
  let id = start
  return () => `${id++}`
}

export interface AstWithIdInformation<OtherInfo> {
  idMap:        BiMap<IdType, IdRNode<OtherInfo>>
  decoratedAst: IdRNode<OtherInfo>
}

/**
 * Decorate the given AST by assigning an unique ID to each node
 *
 * @param ast the ast to decorate, must not already have an id field! (TODO: check guard)
 * @param getId the id generator: must generate a unique id für each passed node
 *
 * @typeParam OtherInfo the original decoration of the ast nodes (probably is nothing as the id decoration is most likely the first step to be performed after extraction)
 *
 * TODO: add id map to more quickly access these ids in the future => make it usable for we create new nodes with parents => move to parents?
 */
export function decorateWithIds<OtherInfo> (ast: RNode<Exclude<OtherInfo, Id>>, getId: IdGenerator<OtherInfo> = deterministicCountingIdGenerator<OtherInfo>()): AstWithIdInformation<OtherInfo> {
  const idMap = new BiMap<IdType, IdRNode<OtherInfo>>()

  const foldLeaf = (leaf: RSingleNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newLeaf = {
      ...leaf,
      id: getId(leaf)
    }
    idMap.set(newLeaf.id, newLeaf)
    return newLeaf
  }
  const binaryOp = (op: RBinaryOp<OtherInfo>, lhs: IdRNode<OtherInfo>, rhs: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newOp = {
      ...op,
      lhs,
      rhs,
      id: getId(op)
    }
    idMap.set(newOp.id, newOp)
    return newOp
  }
  const foldIfThenElse = (ifThen: RIfThenElse<OtherInfo>, condition: IdRNode<OtherInfo>, then: IdRNode<OtherInfo>, otherwise?: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newIfThen = {
      ...ifThen,
      condition,
      then,
      otherwise,
      id: getId(ifThen)
    }
    idMap.set(newIfThen.id, newIfThen)
    return newIfThen
  }
  const foldExprList = (exprList: RExpressionList<OtherInfo>, children: Array<IdRNode<OtherInfo>>): IdRNode<OtherInfo> => {
    const newExprList = {
      ...exprList,
      children,
      id: getId(exprList)
    }
    idMap.set(newExprList.id, newExprList)
    return newExprList
  }

  const foldForLoop = (forLoop: RForLoop<OtherInfo>, variable: IdRNode<OtherInfo>, vector: IdRNode<OtherInfo>, body: IdRNode<OtherInfo>): IdRNode<OtherInfo> => {
    const newForLoop = {
      ...forLoop,
      variable,
      vector,
      body,
      id: getId(forLoop)
    }
    idMap.set(newForLoop.id, newForLoop)
    return newForLoop
  }

  const decoratedAst = foldAst(ast, {
    foldNumber:  foldLeaf,
    foldString:  foldLeaf,
    foldLogical: foldLeaf,
    foldSymbol:  foldLeaf,
    binaryOp:    {
      foldLogicalOp:    binaryOp,
      foldArithmeticOp: binaryOp,
      foldComparisonOp: binaryOp,
      foldAssignment:   binaryOp
    },
    loop: {
      foldForLoop
    },
    foldIfThenElse,
    foldExprList
  })

  return {
    decoratedAst,
    idMap
  }
}
