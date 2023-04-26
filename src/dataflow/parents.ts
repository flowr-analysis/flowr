// adds id-based parent information for an ast
import {
  type RBinaryOp,
  type RExpressionList,
  RForLoop,
  type RIfThenElse,
  type RSingleNode
} from '../r-bridge/lang:4.x/ast/model'
import { type Id, type IdRNode, type IdType } from './id'
import { foldAst } from '../r-bridge/lang:4.x/ast/fold'

export interface ParentInformation {
  parent: IdType | undefined
}

export type RNodeWithParent<OtherInfo> = IdRNode<OtherInfo & ParentInformation>

export function decorateWithParentInformation<OtherInfo> (ast: IdRNode<OtherInfo>): RNodeWithParent<OtherInfo> {
  const foldLeaf = (leaf: RSingleNode<OtherInfo & Id>): RNodeWithParent<OtherInfo> => ({
    ...leaf,
    parent: undefined
  })
  const binaryOp = (op: RBinaryOp<OtherInfo & Id>, lhs: RNodeWithParent<OtherInfo>, rhs: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    lhs.parent = op.id
    rhs.parent = op.id
    return {
      ...op,
      lhs,
      rhs,
      parent: undefined
    }
  }
  const foldIfThenElse = (ifThen: RIfThenElse<OtherInfo & Id>, condition: RNodeWithParent<OtherInfo>, then: RNodeWithParent<OtherInfo>, otherwise?: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    condition.parent = ifThen.id
    then.parent = ifThen.id
    if (otherwise !== undefined) {
      otherwise.parent = ifThen.id
    }

    return {
      ...ifThen,
      condition,
      then,
      otherwise,
      parent: undefined
    }
  }

  const foldExprList = (exprList: RExpressionList<OtherInfo & Id>, children: Array<RNodeWithParent<OtherInfo>>): RNodeWithParent<OtherInfo> => {
    children.forEach(c => {
      c.parent = exprList.id
    })
    return {
      ...exprList,
      children,
      parent: undefined
    }
  }

  const foldForLoop = (loop: RForLoop<OtherInfo & Id>, variable: RNodeWithParent<OtherInfo>, vector: RNodeWithParent<OtherInfo>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    variable.parent = loop.id
    vector.parent = loop.id
    body.parent = loop.id
    return {
      ...loop,
      variable,
      vector,
      body,
      parent: undefined
    }
  }

  return foldAst(ast, {
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
}
