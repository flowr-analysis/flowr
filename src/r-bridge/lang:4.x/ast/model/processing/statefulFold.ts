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
  RComment,
  RNext,
  RBreak,
  RParameter,
  RArgument,
  RFunctionDefinition
} from '../nodes'
import { RNode } from '../model'


/**
 * Called during the down-pass, will pe propagated to children and used in the up-pass (see {@link StatefulFoldFunctions}).
 * As it will be called between each child, the `lastUp` argument will be the up result of the last call, and undefined for the first call on each node.
 * <p>
 * Exists for leafs as well for consistency reasons.
 */
export type DownFold<Info, Up, Down> = (node: RNode<Info>, down: Down, lastUp: Up | undefined) => Down

/**
 * All fold functions besides `down` are called after the down-pass in conventional fold-fashion.
 * The `down` argument holds information obtained during the down-pass, issued by the `down` function.
 * The down function will be called in-between folding each child, with the `Up` result for the last call.
 */
export interface StatefulFoldFunctions<Info, Down, Up> {
  down:        DownFold<Info, Up, Down>
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
  /** The `otherwise` argument is `undefined` if the `else` branch is missing */
  foldIfThenElse: (ifThenExpr: RIfThenElse<Info>, cond: Up, then: Up, otherwise: Up | undefined, down: Down ) => Up;
  foldExprList:   (exprList: RExpressionList<Info>, expressions: Up[], down: Down) => Up;
  functions: {
    foldFunctionDefinition: (definition: RFunctionDefinition<Info>, args: Up[], body: Up, down: Down) => Up;
    foldFunctionCall:       (call: RFunctionCall<Info>, functionName: Up, args: Up[], down: Down) => Up;
    /** The `name` is `undefined` if the argument is unnamed */
    foldArgument:           (argument: RArgument<Info>, name: Up | undefined, value: Up, down: Down) => Up;
    /** The `defaultValue` is `undefined` if the argument was not initialized with a default value */
    foldParameter:          (parameter: RParameter<Info>, name: Up, defaultValue: Up | undefined, down: Down) => Up;
  }
}


/**
 * Folds in old functional-fashion over the AST structure but allowing for a down function which can pass context to child nodes.
 */
export function foldAstStateful<Info, Down, Up>(ast: RNode<Info>, down: Down, folds: DeepReadonly<StatefulFoldFunctions<Info, Down, Up>>): Up {
  const type = ast.type
  // first down is used as the initial down before children processing, it will be passed to each folds call and first children
  const firstDown = folds.down(ast, down, undefined)
  switch (type) {
    case Type.Number:
      return folds.foldNumber(ast, firstDown)
    case Type.String:
      return folds.foldString(ast, firstDown)
    case Type.Logical:
      return folds.foldLogical(ast, firstDown)
    case Type.Symbol:
      return folds.foldSymbol(ast, firstDown)
    case Type.Comment:
      return folds.other.foldComment(ast, firstDown)
    case Type.BinaryOp:
      return foldBinaryOp(ast, firstDown, down, folds)
    case Type.UnaryOp:
      return foldUnaryOp(ast, firstDown, folds)
    case Type.For: {
      const variable = foldAstStateful(ast.variable, firstDown, folds)
      const vector = foldAstStateful(ast.vector, folds.down(ast, down, variable), folds)
      const body = foldAstStateful(ast.body, folds.down(ast, down, vector), folds)
      return folds.loop.foldFor(ast, variable, vector, body, firstDown)
    }
    case Type.While: {
      const condition = foldAstStateful(ast.condition, firstDown, folds)
      const body = foldAstStateful(ast.body, folds.down(ast, down, condition), folds)
      return folds.loop.foldWhile(ast, condition, body, firstDown)
    }
    case Type.Repeat:
      return folds.loop.foldRepeat(ast, foldAstStateful(ast.body, firstDown, folds), firstDown)
    case Type.FunctionCall: {
      const functionName = foldAstStateful(ast.functionName, firstDown, folds)
      const args: Up[] = []
      let last: Up = functionName
      for (const arg of ast.arguments) {
        last = foldAstStateful(arg, folds.down(ast, down, last), folds)
        args.push(last)
      }
      return folds.functions.foldFunctionCall(ast, functionName, args, firstDown)
    }
    case Type.FunctionDefinition: {
      const params: Up[] = []
      let last: Up | undefined = undefined
      for (const param of ast.parameters) {
        last = foldAstStateful(param, last === undefined ? firstDown : folds.down(ast, down, last), folds)
        params.push(last)
      }
      return folds.functions.foldFunctionDefinition(ast, params, foldAstStateful(ast.body, folds.down(ast, down, last), folds), firstDown)
    }
    case Type.Parameter: {
      const name = foldAstStateful(ast.name, firstDown, folds)
      return folds.functions.foldParameter(ast, name, ast.defaultValue ? foldAstStateful(ast.defaultValue, folds.down(ast, down, name), folds) : undefined, firstDown)
    }
    case Type.Argument: {
      const name: Up | undefined = ast.name ? foldAstStateful(ast.name, firstDown, folds) : undefined
      return folds.functions.foldArgument(ast, name, foldAstStateful(ast.value, name === undefined ? firstDown : folds.down(ast, down, name), folds), firstDown)
    }
    case Type.Next:
      return folds.loop.foldNext(ast, down)
    case Type.Break:
      return folds.loop.foldBreak(ast, down)
    case Type.If: {
      const cond = foldAstStateful(ast.condition, firstDown, folds)
      const then = foldAstStateful(ast.then, folds.down(ast, down, cond), folds)
      const otherwise = ast.otherwise === undefined ? undefined : foldAstStateful(ast.otherwise, folds.down(ast, down, then), folds)
      return folds.foldIfThenElse(ast, cond, then, otherwise, firstDown)
    }
    case Type.ExpressionList: {
      const children: Up[] = []
      let last: Up | undefined = undefined
      for (const child of ast.children) {
        last = foldAstStateful(child, last === undefined ? firstDown : folds.down(ast, down, last), folds)
        children.push(last)
      }
      return folds.foldExprList(ast, children, firstDown)
    }
    default:
      assertUnreachable(type)
  }
}

function foldBinaryOp<Info, Down, Up>(ast: RBinaryOp<Info>, firstDown: Down, down: Down, folds: StatefulFoldFunctions<Info, Down, Up>): Up {
  const lhs = foldAstStateful(ast.lhs, firstDown, folds)
  const rhs = foldAstStateful(ast.rhs, folds.down(ast, down, lhs), folds)
  switch (ast.flavor) {
    case 'logical':
      return folds.binaryOp.foldLogicalOp(ast as RLogicalBinaryOp<Info>, lhs, rhs, firstDown)
    case 'arithmetic':
      return folds.binaryOp.foldArithmeticOp(ast as RArithmeticBinaryOp<Info>, lhs, rhs, firstDown)
    case 'comparison':
      return folds.binaryOp.foldComparisonOp(ast as RComparisonBinaryOp<Info>, lhs, rhs, firstDown)
    case 'assignment':
      return folds.binaryOp.foldAssignment(ast as RAssignmentOp<Info>, lhs, rhs, firstDown)
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
