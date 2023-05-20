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
  RComment, RNext, RBreak
} from '../nodes'
import { RNode } from '../model'
import { RFunctionDefinition } from '../nodes/RFunctionDefinition'


/**
 * Called during the down-pass, will pe propagated to children and used in the up-pass (see {@link StatefulFoldFunctions}).
 * <p>
 * Exists for leafs as well for consistency reasons.
 */
export type DownFold<Info, Down> = (node: RNode<Info>, down: Down) => Down

/**
 * All fold functions besides `down` are called after the down-pass in conventional fold-fashion.
 * The `down` parameter holds information obtained during the down-pass, issued by the `down` function.
 */
export interface StatefulFoldFunctions<Info, Down, Up> {
  down:        DownFold<Info, Down>
  foldNumber:  (num: RNumber<Info>, down: Down) => Up;
  foldString:  (str: RString<Info>, down: Down) => Up;
  foldLogical: (logical: RLogical<Info>, down: Down) => Up;
  foldSymbol:  (symbol: RSymbol<Info>, down: Down) => Up;
  binaryOp: {
    foldLogicalOp:    (op: RLogicalBinaryOp<Info>, lhs: Up, rhs: Up, down: Down) => Up;
    foldArithmeticOp: (op: RArithmeticBinaryOp<Info>, lhs: Up, rhs: Up, down: Down) => Up;
    foldComparisonOp: (op: RComparisonBinaryOp<Info>, lhs: Up, rhs: Up, down: Down) => Up;
    foldAssignment:   (op: RAssignmentOp<Info>, lhs: Up, rhs: Up, down: Down) => Up;
  };
  unaryOp: {
    foldLogicalOp:    (op: RLogicalUnaryOp<Info>, operand: Up, down: Down) => Up;
    foldArithmeticOp: (op: RArithmeticUnaryOp<Info>, operand: Up, down: Down) => Up;
  };
  loop: {
    foldFor:    (loop: RForLoop<Info>, variable: Up, vector: Up, body: Up, down: Down) => Up;
    foldWhile:  (loop: RWhileLoop<Info>, condition: Up, body: Up, down: Down) => Up;
    foldRepeat: (loop: RRepeatLoop<Info>, body: Up, down: Down) => Up;
    foldNext:   (next: RNext<Info>, down: Down) => Up;
    foldBreak:  (next: RBreak<Info>, down: Down) => Up;
  };
  other: {
    foldComment: (comment: RComment<Info>, down: Down) => Up;
  };
  foldIfThenElse: (
    ifThenExpr: RIfThenElse<Info>,
    cond: Up,
    then: Up,
    otherwise: Up | undefined,
    down: Down
  ) => Up;
  foldExprList: (exprList: RExpressionList<Info>, expressions: Up[], down: Down) => Up;
  functions: {
    foldFunctionDefinition: (definition: RFunctionDefinition<Info>, parameters: Up[], body: Up, down: Down) => Up;
    foldFunctionCall:       (call: RFunctionCall<Info>, functionName: Up, parameters: Up[], down: Down) => Up;
  }
}


/**
 * Folds in old functional-fashion over the AST structure but allowing for a down function which can pass context to child nodes.
 */
export function foldAstStateful<Info, Down, Up>(ast: RNode<Info>, down: Down, folds: DeepReadonly<StatefulFoldFunctions<Info, Down, Up>>): Up {
  const type = ast.type
  down = folds.down(ast, down)
  switch (type) {
    case Type.Number:
      return folds.foldNumber(ast, down)
    case Type.String:
      return folds.foldString(ast, down)
    case Type.Logical:
      return folds.foldLogical(ast, down)
    case Type.Symbol:
      return folds.foldSymbol(ast, down)
    case Type.Comment:
      return folds.other.foldComment(ast, down)
    case Type.BinaryOp:
      return foldBinaryOp(ast, down, folds)
    case Type.UnaryOp:
      return foldUnaryOp(ast, down, folds)
    case Type.For:
      return folds.loop.foldFor(ast, foldAstStateful(ast.variable, down, folds), foldAstStateful(ast.vector, down, folds), foldAstStateful(ast.body, down, folds), down)
    case Type.While:
      return folds.loop.foldWhile(ast, foldAstStateful(ast.condition, down, folds), foldAstStateful(ast.body, down, folds), down)
    case Type.Repeat:
      return folds.loop.foldRepeat(ast, foldAstStateful(ast.body, down, folds), down)
    case Type.FunctionCall:
      return folds.functions.foldFunctionCall(ast, foldAstStateful(ast.functionName, down, folds), ast.parameters.map(param => foldAstStateful(param, down, folds)), down)
    case Type.Function:
      return folds.functions.foldFunctionDefinition(ast, ast.parameters.map(param => foldAstStateful(param, down, folds)), foldAstStateful(ast.body, down, folds), down)
    case Type.Next:
      return folds.loop.foldNext(ast, down)
    case Type.Break:
      return folds.loop.foldBreak(ast, down)
    case Type.If:
      return folds.foldIfThenElse(ast, foldAstStateful(ast.condition, down, folds), foldAstStateful(ast.then, down, folds), ast.otherwise === undefined ? undefined : foldAstStateful(ast.otherwise, down, folds), down)
    case Type.ExpressionList:
      return folds.foldExprList(ast, ast.children.map(expr => foldAstStateful(expr, down, folds)), down)
    default:
      assertUnreachable(type)
  }
}

function foldBinaryOp<Info, Down, Up>(ast: RBinaryOp<Info>, down: Down, folds: StatefulFoldFunctions<Info, Down, Up>): Up {
  switch (ast.flavor) {
    case 'logical':
      return folds.binaryOp.foldLogicalOp(ast as RLogicalBinaryOp<Info>, foldAstStateful(ast.lhs, down, folds), foldAstStateful(ast.rhs, down, folds), down)
    case 'arithmetic':
      return folds.binaryOp.foldArithmeticOp(ast as RArithmeticBinaryOp<Info>, foldAstStateful(ast.lhs, down, folds), foldAstStateful(ast.rhs, down, folds), down)
    case 'comparison':
      return folds.binaryOp.foldComparisonOp(ast as RComparisonBinaryOp<Info>, foldAstStateful(ast.lhs, down, folds), foldAstStateful(ast.rhs, down, folds), down)
    case 'assignment':
      return folds.binaryOp.foldAssignment(ast as RAssignmentOp<Info>, foldAstStateful(ast.lhs, down, folds), foldAstStateful(ast.rhs, down, folds), down)
    default:
      assertUnreachable(ast.flavor)
  }
}


function foldUnaryOp<Info, Down, Up>(ast: RUnaryOp<Info>, down: Down, folds: StatefulFoldFunctions<Info, Down, Up>): Up {
  switch (ast.flavor) {
    case 'logical':
      return folds.unaryOp.foldLogicalOp(ast as RLogicalUnaryOp<Info>, foldAstStateful(ast.operand, down, folds), down)
    case 'arithmetic':
      return folds.unaryOp.foldArithmeticOp(ast as RArithmeticUnaryOp<Info>, foldAstStateful(ast.operand, down, folds), down)
    default:
      assertUnreachable(ast.flavor)
  }
}
