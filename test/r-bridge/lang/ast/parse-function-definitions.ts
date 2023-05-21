import { assertAst, withShell } from "../../../helper/shell"
import { exprList, numVal, parameter } from '../../../helper/ast-builder'
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe("Parse function definitions",
  withShell((shell) => {
    describe("functions without arguments", () => {
      const noop = "function() { }"
      assertAst(`noop - ${noop}`, shell, noop,
        exprList({
          type:       Type.Function,
          location:   rangeFrom(1, 1, 1, 8),
          lexeme:     "function",
          parameters: [],
          info:       {},
          body:       {
            type:     Type.ExpressionList,
            location: rangeFrom(1, 12, 1, 14),
            lexeme:   "{ }",
            children: [],
            info:     {}
          }
        })
      )
      const noArgs = "function() { x + 2 * 3 }"
      assertAst(`noArgs - ${noArgs}`, shell, noArgs,
        exprList({
          type:       Type.Function,
          location:   rangeFrom(1, 1, 1, 8),
          lexeme:     "function",
          parameters: [],
          info:       {},
          body:       {
            type:     Type.BinaryOp,
            location: rangeFrom(1, 16, 1, 16),
            flavor:   'arithmetic',
            lexeme:   "+",
            op:       '+',
            info:     {},
            lhs:      {
              type:      Type.Symbol,
              location:  rangeFrom(1, 14, 1, 14),
              lexeme:    "x",
              content:   "x",
              namespace: undefined,
              info:      {}
            },
            rhs: {
              type:     Type.BinaryOp,
              location: rangeFrom(1, 20, 1, 20),
              flavor:   'arithmetic',
              lexeme:   "*",
              op:       '*',
              info:     {},
              lhs:      {
                type:     Type.Number,
                location: rangeFrom(1, 18, 1, 18),
                lexeme:   "2",
                content:  numVal(2),
                info:     {}
              },
              rhs: {
                type:     Type.Number,
                location: rangeFrom(1, 22, 1, 22),
                lexeme:   "3",
                content:  numVal(3),
                info:     {}
              }
            }
          }
        })
      )
    })
    describe("functions with unnamed parameters", () => {
      const oneParameter = "function(x) { }"
      assertAst(`one parameter - ${oneParameter}`, shell, oneParameter,
        exprList({
          type:       Type.Function,
          location:   rangeFrom(1, 1, 1, 8),
          lexeme:     "function",
          parameters: [parameter("x", rangeFrom(1, 10, 1, 10))],
          info:       {},
          body:       {
            type:     Type.ExpressionList,
            location: rangeFrom(1, 13, 1, 15),
            lexeme:   "{ }",
            children: [],
            info:     {}
          }
        })
      )
      const multipleParameters = "function(a,the,b) { b }"
      assertAst(`multiple parameter - ${multipleParameters}`, shell, multipleParameters,
        exprList({
          type:       Type.Function,
          location:   rangeFrom(1, 1, 1, 8),
          lexeme:     "function",
          parameters: [
            parameter("a", rangeFrom(1, 10, 1, 10)),
            parameter("the", rangeFrom(1, 12, 1, 14)),
            parameter("b", rangeFrom(1, 16, 1, 16))
          ],
          info: {},
          body: {
            type:      Type.Symbol,
            location:  rangeFrom(1, 21, 1, 21),
            lexeme:    "b",
            content:   "b",
            namespace: undefined,
            info:      {}
          }
        })
      )
    })
  })
)
