import { assertAst, withShell } from "../../../helper/shell"
import { exprList, numVal } from "../../../helper/ast-builder"
import { RAssignmentOpPool } from "../../../helper/provider"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe("Parse simple assignments",
  withShell((shell) => {
    describe("constant assignments", () => {
      for (const op of RAssignmentOpPool) {
        const opOffset = op.str.length - 1
        assertAst(
          `Assign to 5`,
          shell,
          `x ${op.str} 5`,
          exprList({
            type:     Type.BinaryOp,
            location: rangeFrom(1, 3, 1, 3 + opOffset),
            flavor:   "assignment",
            lexeme:   op.str,
            operator: op.str,
            info:     {},
            lhs:      {
              type:      Type.Symbol,
              location:  rangeFrom(1, 1, 1, 1),
              namespace: undefined,
              lexeme:    "x",
              content:   "x",
              info:      {}
            },
            rhs: {
              type:     Type.Number,
              location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
              lexeme:   "5",
              content:  numVal(5),
              info:     {}
            },
          })
        )
      }
    })

    // allow assignments to strings and function calls
    describe("Assignments to strings", () => {
      assertAst(
        `Assign to given string`,
        shell,
        `'a' <- 5`,
        exprList({
          type:     Type.BinaryOp,
          location: rangeFrom(1, 5, 1, 6),
          flavor:   "assignment",
          lexeme:   '<-',
          operator: '<-',
          info:     {},
          lhs:      {
            type:      Type.Symbol,
            location:  rangeFrom(1, 1, 1, 3),
            namespace: undefined,
            // TODO: mark quoted
            lexeme:    "'a'",
            content:   "a",
            info:      {}
          },
          rhs: {
            type:     Type.Number,
            location: rangeFrom(1, 8, 1, 8),
            lexeme:   "5",
            content:  numVal(5),
            info:     {}
          },
        })
      )
    })
  })
)
