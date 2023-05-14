import { assertUnreachable } from "../../../../../util/assert"
import { DeepReadonly } from "ts-essentials"
import { Type } from "../type"
import {
  RExpressionList,
  RNumber,
  RSymbol,
  RLogical,
  RString,
  RArithmeticBinaryOp,
  RAssignmentOp,
  RBinaryOp,
  RComparisonBinaryOp,
  RLogicalBinaryOp,
  RArithmeticUnaryOp,
  RLogicalUnaryOp,
  RUnaryOp,
  RIfThenElse,
  RForLoop,
  RRepeatLoop,
  RWhileLoop,
  RFunctionCall,
  RComment } from '../nodes'
import { RNode } from '../model'

export interface FoldFunctions<Info, T> {
  foldNumber:  (num: RNumber<Info>) => T;
  foldString:  (str: RString<Info>) => T;
  foldLogical: (logical: RLogical<Info>) => T;
  foldSymbol:  (symbol: RSymbol<Info>) => T;
  binaryOp: {
    foldLogicalOp:    (op: RLogicalBinaryOp<Info>, lhs: T, rhs: T) => T;
    foldArithmeticOp: (op: RArithmeticBinaryOp<Info>, lhs: T, rhs: T) => T;
    foldComparisonOp: (op: RComparisonBinaryOp<Info>, lhs: T, rhs: T) => T;
    foldAssignment:   (op: RAssignmentOp<Info>, lhs: T, rhs: T) => T;
  };
  unaryOp: {
    foldLogicalOp:    (op: RLogicalUnaryOp<Info>, operand: T) => T;
    foldArithmeticOp: (op: RArithmeticUnaryOp<Info>, operand: T) => T;
  };
  loop: {
    foldFor:    (loop: RForLoop<Info>, variable: T, vector: T, body: T) => T;
    foldWhile:  (loop: RWhileLoop<Info>, condition: T, body: T) => T;
    foldRepeat: (loop: RRepeatLoop<Info>, body: T) => T;
  };
  other: {
    foldComment: (comment: RComment<Info>) => T;
  };
  foldIfThenElse: (
    ifThenExpr: RIfThenElse<Info>,
    cond: T,
    then: T,
    otherwise?: T
  ) => T;
  foldExprList:     (exprList: RExpressionList<Info>, expressions: T[]) => T;
  foldFunctionCall: (
    call: RFunctionCall<Info>,
    functionName: T,
    parameters: T[]
  ) => T;
}

/**
 * Folds in old functional-fashion over the AST structure
 */
export function foldAst<Info, T>(ast: RNode<Info>, folds: DeepReadonly<FoldFunctions<Info, T>>): T {
  const type = ast.type
  switch (type) {
    case Type.Number:
      return folds.foldNumber(ast)
    case Type.String:
      return folds.foldString(ast)
    case Type.Logical:
      return folds.foldLogical(ast)
    case Type.Symbol:
      return folds.foldSymbol(ast)
    case Type.Comment:
      return folds.other.foldComment(ast)
    case Type.BinaryOp:
      return foldBinaryOp(ast, folds)
    case Type.UnaryOp:
      return foldUnaryOp(ast, folds)
    case Type.For:
      return folds.loop.foldFor(ast, foldAst(ast.variable, folds), foldAst(ast.vector, folds), foldAst(ast.body, folds))
    case Type.While:
      return folds.loop.foldWhile(ast, foldAst(ast.condition, folds), foldAst(ast.body, folds))
    case Type.Repeat:
      return folds.loop.foldRepeat(ast, foldAst(ast.body, folds))
    case Type.FunctionCall:
      return folds.foldFunctionCall(ast, foldAst(ast.functionName, folds), ast.parameters.map(param => foldAst(param, folds)))
    // TODO: other loops
    case Type.If:
      return folds.foldIfThenElse(ast, foldAst(ast.condition, folds), foldAst(ast.then, folds), ast.otherwise === undefined ? undefined : foldAst(ast.otherwise, folds))
    case Type.ExpressionList:
      return folds.foldExprList(ast, ast.children.map(expr => foldAst(expr, folds)))
    default:
      assertUnreachable(type)
  }
}

function foldBinaryOp<Info, T>(ast: RBinaryOp<Info>, folds: FoldFunctions<Info, T>): T {
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


function foldUnaryOp<Info, T>(ast: RUnaryOp<Info>, folds: FoldFunctions<Info, T>): T {
  switch (ast.flavor) {
    case 'logical':
      return folds.unaryOp.foldLogicalOp(ast as RLogicalUnaryOp<Info>, foldAst(ast.operand, folds))
    case 'arithmetic':
      return folds.unaryOp.foldArithmeticOp(ast as RArithmeticUnaryOp<Info>, foldAst(ast.operand, folds))
    default:
      assertUnreachable(ast.flavor)
  }
}
