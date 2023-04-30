// adds id-based parent information for an ast
import {
  type RBinaryOp,
  type RExpressionList,
  RForLoop,
  type RIfThenElse, RRepeatLoop,
  type RSingleNode, RUnaryOp, RWhileLoop
} from '../r-bridge/lang:4.x/ast/model'
import { type Id, type IdRNode, type IdType } from './id'
import { foldAst } from '../r-bridge/lang:4.x/ast/fold'

export interface ParentInformation {
  parent: IdType | undefined
}

export type RNodeWithParent<OtherInfo> = IdRNode<OtherInfo & ParentInformation>

export function decorateWithParentInformation<OtherInfo> (ast: IdRNode<OtherInfo>): RNodeWithParent<OtherInfo> {
  // TODO: move out
  // TODO: abstract away from all those cases with "children" if not needed
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
  const unaryOp = (op: RUnaryOp<OtherInfo & Id>, operand: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    operand.parent = op.id
    return {
      ...op,
      operand,
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

  const foldFor = (loop: RForLoop<OtherInfo & Id>, variable: RNodeWithParent<OtherInfo>, vector: RNodeWithParent<OtherInfo>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
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

  const foldRepeat = (loop: RRepeatLoop<OtherInfo & Id>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    body.parent = loop.id
    return {
      ...loop,
      body,
      parent: undefined
    }
  }

  const foldWhile = (loop: RWhileLoop<OtherInfo & Id>, condition: RNodeWithParent<OtherInfo>, body: RNodeWithParent<OtherInfo>): RNodeWithParent<OtherInfo> => {
    body.parent = loop.id
    condition.parent = loop.id
    return {
      ...loop,
      body,
      condition,
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
    unaryOp: {
      foldLogicalOp:    unaryOp,
      foldArithmeticOp: unaryOp
    },
    loop: {
      foldFor,
      foldRepeat,
      foldWhile
    },
    foldIfThenElse,
    foldExprList
  })
}
