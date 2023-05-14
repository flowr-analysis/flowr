import { assertDecoratedAst, withShell } from "../helper/shell"
import { numVal } from "../helper/ast-builder"
import { rangeFrom } from "../../src/util/range"
import { Type, decorateAst, RNodeWithParent, deterministicCountingIdGenerator } from '../../src/r-bridge'

describe("Assign unique Ids and Parents",
  withShell((shell) => {
    describe("Testing deterministic counting Id assignment", () => {
      const assertDecorated = (name: string, input: string, expected: RNodeWithParent): void => {
        assertDecoratedAst(name, shell, input,
          (ast) => decorateAst(ast, deterministicCountingIdGenerator()).decoratedAst,
          expected
        )
      }
      // decided to test with ast parsing, as we are dependent on these changes in reality
      describe("1. Single nodes (leafs)", () => {
        const exprList = (...children: RNodeWithParent[]): RNodeWithParent => ({
          type:   Type.ExpressionList,
          lexeme: undefined,
          info:   {
            parent: undefined,
            id:     "1"
          },
          children,
        })
        assertDecorated(
          "1.1 String",
          '"hello"',
          exprList({
            type:     Type.String,
            location: rangeFrom(1, 1, 1, 7),
            lexeme:   '"hello"',
            content:  {
              str:    "hello",
              quotes: '"',
            },
            info: {
              parent: "1",
              id:     "0"
            },
          })
        )
        assertDecorated(
          "1.2 Number",
          "42",
          exprList({
            type:     Type.Number,
            location: rangeFrom(1, 1, 1, 2),
            lexeme:   "42",
            content:  numVal(42),
            info:     {
              parent: "1",
              id:     "0"
            },
          })
        )
        assertDecorated(
          "1.3 Logical",
          "FALSE",
          exprList({
            type:     Type.Logical,
            location: rangeFrom(1, 1, 1, 5),
            lexeme:   "FALSE",
            content:  false,
            info:     {
              parent: "1",
              id:     "0"
            },
          })
        )
        assertDecorated(
          "1.4 Symbol",
          "k",
          exprList({
            type:      Type.Symbol,
            location:  rangeFrom(1, 1, 1, 1),
            namespace: undefined,
            lexeme:    "k",
            content:   "k",
            info:      {
              parent: "1",
              id:     "0"
            },
          })
        )
      })
      // TODO: Tests others
    })
  })
)
