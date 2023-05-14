import { assertAst, withShell } from "../../../helper/shell"
import { exprList, numVal } from "../../../helper/ast-builder"
import { RAssignmentOpPool } from "../../../helper/provider"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe(
  "2. Parse simple assignments",
  withShell((shell) => {
    describe("1.1 constant assignments", () => {
      for (const op of RAssignmentOpPool) {
        const opOffset = op.str.length - 1
        assertAst(
          `x ${op.str} 5`,
          shell,
          `x ${op.str} 5`,
          exprList({
            type:     Type.BinaryOp,
            location: rangeFrom(1, 3, 1, 3 + opOffset),
            flavor:   "assignment",
            lexeme:   op.str,
            op:       op.str,
            lhs:      {
              type:      Type.Symbol,
              location:  rangeFrom(1, 1, 1, 1),
              namespace: undefined,
              lexeme:    "x",
              content:   "x",
            },
            rhs: {
              type:     Type.Number,
              location: rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
              lexeme:   "5",
              content:  numVal(5),
            },
          })
        )
      }
    })
  })
)
