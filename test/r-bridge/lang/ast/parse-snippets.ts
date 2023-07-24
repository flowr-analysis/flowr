import { exprList, numVal } from "../../../helper/ast-builder"
import { assertAst, withShell } from "../../../helper/shell"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe("Parse larger snippets", withShell((shell) => {
  describe("if-then, assignments, symbols, and comparisons", () => {
    assertAst(
      "max function",
      shell,
      `
a <- 3
b = 4
if (a >b) {
  max <<- a
  i ->2
} else {
  b ->> max
}
max
    `,
      exprList(
        {
          type:     Type.BinaryOp,
          flavor:   "assignment",
          lexeme:   "<-",
          operator: "<-",
          location: rangeFrom(2, 3, 2, 4),
          info:     {},
          lhs:      {
            type:      Type.Symbol,
            lexeme:    "a",
            namespace: undefined,
            content:   "a",
            location:  rangeFrom(2, 1, 2, 1),
            info:      {}
          },
          rhs: {
            type:     Type.Number,
            lexeme:   "3",
            content:  numVal(3),
            location: rangeFrom(2, 6, 2, 6),
            info:     {}
          },
        },
        {
          type:     Type.BinaryOp,
          flavor:   "assignment",
          lexeme:   "=",
          operator: "=",
          location: rangeFrom(3, 3, 3, 3),
          info:     {},
          lhs:      {
            type:      Type.Symbol,
            lexeme:    "b",
            namespace: undefined,
            content:   "b",
            location:  rangeFrom(3, 1, 3, 1),
            info:      {}
          },
          rhs: {
            type:     Type.Number,
            lexeme:   "4",
            content:  numVal(4),
            location: rangeFrom(3, 5, 3, 5),
            info:     {}
          },
        },
        {
          type:      Type.If,
          lexeme:    "if",
          location:  rangeFrom(4, 1, 4, 2),
          info:      {},
          condition: {
            type:     Type.BinaryOp,
            flavor:   "comparison",
            lexeme:   ">",
            operator: ">",
            location: rangeFrom(4, 7, 4, 7),
            info:     {},
            lhs:      {
              type:      Type.Symbol,
              lexeme:    "a",
              namespace: undefined,
              content:   "a",
              location:  rangeFrom(4, 5, 4, 5),
              info:      {}
            },
            rhs: {
              type:      Type.Symbol,
              lexeme:    "b",
              namespace: undefined,
              content:   "b",
              location:  rangeFrom(4, 8, 4, 8),
              info:      {}
            },
          },
          then: {
            type:     Type.ExpressionList,
            lexeme:   "{\nmax <<- a\ni ->2\n}",
            location: rangeFrom(4, 11, 7, 1),
            info:     {},
            children: [
              {
                type:     Type.BinaryOp,
                flavor:   "assignment",
                lexeme:   "<<-",
                operator: "<<-",
                location: rangeFrom(5, 7, 5, 9),
                info:     {},
                lhs:      {
                  type:      Type.Symbol,
                  lexeme:    "max",
                  namespace: undefined,
                  content:   "max",
                  location:  rangeFrom(5, 3, 5, 5),
                  info:      {}
                },
                rhs: {
                  type:      Type.Symbol,
                  lexeme:    "a",
                  namespace: undefined,
                  content:   "a",
                  location:  rangeFrom(5, 11, 5, 11),
                  info:      {}
                },
              },
              {
                type:     Type.BinaryOp,
                flavor:   "assignment",
                lexeme:   "->",
                operator: "->",
                location: rangeFrom(6, 5, 6, 6),
                info:     {},
                lhs:      {
                  type:      Type.Symbol,
                  lexeme:    "i",
                  namespace: undefined,
                  content:   "i",
                  location:  rangeFrom(6, 3, 6, 3),
                  info:      {}
                },
                rhs: {
                  type:     Type.Number,
                  lexeme:   "2",
                  content:  numVal(2),
                  location: rangeFrom(6, 7, 6, 7),
                  info:     {}
                },
              },
            ],
          },
          otherwise: {
            type:     Type.BinaryOp,
            flavor:   "assignment",
            lexeme:   "->>",
            operator: "->>",
            location: rangeFrom(8, 5, 8, 7),
            info:     {},
            lhs:      {
              type:      Type.Symbol,
              lexeme:    "b",
              namespace: undefined,
              content:   "b",
              location:  rangeFrom(8, 3, 8, 3),
              info:      {}
            },
            rhs: {
              type:      Type.Symbol,
              lexeme:    "max",
              namespace: undefined,
              content:   "max",
              location:  rangeFrom(8, 9, 8, 11),
              info:      {}
            },
          },
        },
        {
          type:      Type.Symbol,
          lexeme:    "max",
          content:   "max",
          namespace: undefined,
          location:  rangeFrom(10, 1, 10, 3),
          info:      {}
        }
      )
    )
  })
})
)
