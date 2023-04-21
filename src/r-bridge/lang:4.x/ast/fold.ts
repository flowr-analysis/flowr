import {
  type RArithmeticOp, type RAssignmentOp, type RBinaryOp,
  type RComparisonOp, type RExprList, type RIfThenElse,
  type RLogical,
  type RLogicalOp,
  type RNode,
  type RNumber,
  type RString,
  type RSymbol
} from './model'
import * as Lang from './model'
import { assertUnreachable } from '../../../util/assert'

export interface FoldFunctions<Info, T> {
  foldNumber: (num: RNumber<Info>) => T
  foldString: (str: RString<Info>) => T
  foldLogical: (logical: RLogical<Info>) => T
  foldSymbol: (symbol: RSymbol<Info>) => T
  binaryOp: {
    foldLogicalOp: (op: RLogicalOp<Info>, lhs: T, rhs: T) => T
    foldArithmeticOp: (op: RArithmeticOp<Info>, lhs: T, rhs: T) => T
    foldComparisonOp: (op: RComparisonOp<Info>, lhs: T, rhs: T) => T
    foldAssignment: (op: RAssignmentOp<Info>, lhs: T, rhs: T) => T
  }
  foldIfThenElse: (ifThenExpr: RIfThenElse<Info>, cond: T, then: T, otherwise?: T) => T
  foldExprList: (exprList: RExprList<Info>, expressions: T[]) => T
}

/**
 * Folds in old functional-fashion over the AST structure
 */
export function foldAST<Info, T>(ast: RNode<Info>, folds: FoldFunctions<Info, T>): T {
  const type = ast.type
  switch (type) {
    case Lang.Type.Number:
      return folds.foldNumber(ast)
    case Lang.Type.String:
      return folds.foldString(ast)
    case Lang.Type.Logical:
      return folds.foldLogical(ast)
    case Lang.Type.Symbol:
      return folds.foldSymbol(ast)
    case Lang.Type.BinaryOp:
      return foldBinaryOp(ast, folds)
    case Lang.Type.If:
      return folds.foldIfThenElse(ast, foldAST(ast.condition, folds), foldAST(ast.then, folds), ast.otherwise === undefined ? undefined : foldAST(ast.otherwise, folds))
    case Lang.Type.ExprList:
      return folds.foldExprList(ast, ast.children.map(expr => foldAST(expr, folds)))
    default:
      assertUnreachable(type)
  }
}

function foldBinaryOp<Info, T>(ast: RBinaryOp<Info>, folds: FoldFunctions<Info, T>): T {
  switch (ast.flavor) {
    case 'logical':
      return folds.binaryOp.foldLogicalOp(ast as RLogicalOp<Info>, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    case 'arithmetic':
      return folds.binaryOp.foldArithmeticOp(ast as RArithmeticOp<Info>, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    case 'comparison':
      return folds.binaryOp.foldComparisonOp(ast as RComparisonOp<Info>, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    case 'assignment':
      return folds.binaryOp.foldAssignment(ast as RAssignmentOp<Info>, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    default:
      assertUnreachable(ast.flavor)
  }
}
