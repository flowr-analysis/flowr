import * as Lang from './model'
import {
  type RArithmeticBinaryOp, RArithmeticUnaryOp,
  type RAssignmentOp,
  type RBinaryOp,
  type RComparisonBinaryOp,
  type RExpressionList, RForLoop,
  type RIfThenElse,
  type RLogical,
  type RLogicalBinaryOp, RLogicalUnaryOp,
  type RNode,
  type RNumber, RRepeatLoop,
  type RString,
  type RSymbol, RUnaryOp, RWhileLoop
} from './model'
import { assertUnreachable } from '../../../util/assert'
import { DeepReadonly } from "ts-essentials"

export interface FoldFunctions<Info, T> {
  foldNumber:  (num: RNumber<Info>) => T
  foldString:  (str: RString<Info>) => T
  foldLogical: (logical: RLogical<Info>) => T
  foldSymbol:  (symbol: RSymbol<Info>) => T
  binaryOp: {
    foldLogicalOp:    (op: RLogicalBinaryOp<Info>, lhs: T, rhs: T) => T
    foldArithmeticOp: (op: RArithmeticBinaryOp<Info>, lhs: T, rhs: T) => T
    foldComparisonOp: (op: RComparisonBinaryOp<Info>, lhs: T, rhs: T) => T
    foldAssignment:   (op: RAssignmentOp<Info>, lhs: T, rhs: T) => T
  },
  unaryOp: {
    foldLogicalOp:    (op: RLogicalUnaryOp<Info>, operand: T) => T
    foldArithmeticOp: (op: RArithmeticUnaryOp<Info>, operand: T) => T
  },
  loop: {
    foldFor:    (loop: RForLoop<Info>, variable: T, vector: T, body: T) => T
    foldWhile:  (loop: RWhileLoop<Info>, condition: T, body: T) => T
    foldRepeat: (loop: RRepeatLoop<Info>, body: T) => T
  },
  foldIfThenElse: (ifThenExpr: RIfThenElse<Info>, cond: T, then: T, otherwise?: T) => T
  foldExprList:   (exprList: RExpressionList<Info>, expressions: T[]) => T
}

/**
 * Folds in old functional-fashion over the AST structure
 */
export function foldAst<Info, T> (ast: RNode<Info>, folds: DeepReadonly<FoldFunctions<Info, T>>): T {
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
    case Lang.Type.UnaryOp:
      return foldUnaryOp(ast, folds)
    case Lang.Type.For:
      return folds.loop.foldFor(ast, foldAst(ast.variable, folds), foldAst(ast.vector, folds), foldAst(ast.body, folds))
    case Lang.Type.While:
      return folds.loop.foldWhile(ast, foldAst(ast.condition, folds), foldAst(ast.body, folds))
    case Lang.Type.Repeat:
      return folds.loop.foldRepeat(ast, foldAst(ast.body, folds))
    // TODO: other loops
    case Lang.Type.If:
      return folds.foldIfThenElse(ast, foldAst(ast.condition, folds), foldAst(ast.then, folds), ast.otherwise === undefined ? undefined : foldAst(ast.otherwise, folds))
    case Lang.Type.ExpressionList:
      return folds.foldExprList(ast, ast.children.map(expr => foldAst(expr, folds)))
    default:
      assertUnreachable(type)
  }
}

function foldBinaryOp<Info, T> (ast: RBinaryOp<Info>, folds: FoldFunctions<Info, T>): T {
  switch (ast.flavor) {
    case 'logical':
      return folds.binaryOp.foldLogicalOp(ast as RLogicalBinaryOp<Info>, foldAst(ast.lhs, folds), foldAst(ast.rhs, folds))
    case 'arithmetic':
      return folds.binaryOp.foldArithmeticOp(ast as RArithmeticBinaryOp<Info>, foldAst(ast.lhs, folds), foldAst(ast.rhs, folds))
    case 'comparison':
      return folds.binaryOp.foldComparisonOp(ast as RComparisonBinaryOp<Info>, foldAst(ast.lhs, folds), foldAst(ast.rhs, folds))
    case 'assignment':
      return folds.binaryOp.foldAssignment(ast as RAssignmentOp<Info>, foldAst(ast.lhs, folds), foldAst(ast.rhs, folds))
    default:
      assertUnreachable(ast.flavor)
  }
}


function foldUnaryOp<Info, T> (ast: RUnaryOp<Info>, folds: FoldFunctions<Info, T>): T {
  switch (ast.flavor) {
    case 'logical':
      return folds.unaryOp.foldLogicalOp(ast as RLogicalUnaryOp<Info>, foldAst(ast.operand, folds))
    case 'arithmetic':
      return folds.unaryOp.foldArithmeticOp(ast as RArithmeticUnaryOp<Info>, foldAst(ast.operand, folds))
    default:
      assertUnreachable(ast.flavor)
  }
}
