import {
  type RArithmeticOp, type RAssignmentOp, type RBinaryOp,
  type RComparisonOp,
  type RLogical,
  type RLogicalOp,
  type RNode,
  type RNumber,
  type RString,
  type RSymbol
} from './model'
import * as Lang from './model'
import { assertUnreachable } from '../../../util/assert'
import { type DeepReadonly } from 'ts-essentials'

export interface FoldFunctions<T> {
  foldNumber: (num: RNumber) => T
  foldString: (str: RString) => T
  foldLogical: (logical: RLogical) => T
  foldSymbol: (symbol: RSymbol) => T
  binaryOp: {
    foldLogicalOp: (op: RLogicalOp, lhs: T, rhs: T) => T
    foldArithmeticOp: (op: RArithmeticOp, lhs: T, rhs: T) => T
    foldComparisonOp: (op: RComparisonOp, lhs: T, rhs: T) => T
    foldAssignment: (op: RAssignmentOp, lhs: T, rhs: T) => T
  }
  foldIfThenElse: (cond: T, then: T, otherwise?: T) => T
  foldExprList: (expressions: T[]) => T
}

/**
 * Folds in old functional-fashion over the AST structure
 */
export function foldAST<T>(ast: DeepReadonly<RNode>, folds: FoldFunctions<T>): T {
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
      return folds.foldIfThenElse(foldAST(ast.condition, folds), foldAST(ast.then, folds), ast.otherwise === undefined ? undefined : foldAST(ast.otherwise, folds))
    case Lang.Type.ExprList:
      return folds.foldExprList(ast.children.map(expr => foldAST(expr, folds)))
    default:
      assertUnreachable(type)
  }
}

function foldBinaryOp<T>(ast: DeepReadonly<RBinaryOp>, folds: FoldFunctions<T>): T {
  switch (ast.flavor) {
    case 'logical':
      return folds.binaryOp.foldLogicalOp(ast as RLogicalOp, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    case 'arithmetic':
      return folds.binaryOp.foldArithmeticOp(ast as RArithmeticOp, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    case 'comparison':
      return folds.binaryOp.foldComparisonOp(ast as RComparisonOp, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    case 'assignment':
      return folds.binaryOp.foldAssignment(ast as RAssignmentOp, foldAST(ast.lhs, folds), foldAST(ast.rhs, folds))
    default:
      assertUnreachable(ast.flavor)
  }
}
