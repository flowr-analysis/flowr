import { assertAst, describeSession } from '../helper/shell'
import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { exprList, numVal } from '../helper/ast-builder'

describe('1. Parse simple expressions', () => {
  describeSession('1.1 arithmetic operations', shell => {
    // TODO: %%, %/%, ... "SPECIAL"
    for (const op of ['+', '-', '*', '/', '^']) {
      describe(op, () => {
        const simpleInput = `1 ${op} 1`
        const opOffset = op.length - 1
        assertAst(simpleInput, shell, simpleInput, exprList(
          {
            type: Lang.Type.BinaryOp,
            op,
            location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
            lhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 1, 1, 1),
              content: numVal(1)
            },
            rhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
              content: numVal(1)
            }
          }
        ))

        // '^' has a different behavior when nested, TODO: will be tested below
        if (op === '^') {
          return
        }

        const nestedInput = `1 ${op} 1 ${op} 42`
        assertAst(nestedInput, shell, nestedInput, exprList(
          {
            type: Lang.Type.BinaryOp,
            op,
            location: Lang.rangeFrom(1, 7 + opOffset, 1, 7 + 2 * opOffset),
            lhs: {
              type: Lang.Type.BinaryOp,
              op,
              location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
              lhs: {
                type: Lang.Type.Number,
                location: Lang.rangeFrom(1, 1, 1, 1),
                content: numVal(1)
              },
              rhs: {
                type: Lang.Type.Number,
                location: Lang.rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
                content: numVal(1)
              }
            },
            rhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 9 + 2 * opOffset, 1, 10 + 2 * opOffset),
              content: numVal(42)
            }
          }
        ))

        const invertedPrecedenceInput = `1 ${op} (1 ${op} 42)`
        assertAst(invertedPrecedenceInput, shell, invertedPrecedenceInput, exprList(
          {
            type: Lang.Type.BinaryOp,
            op,
            location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
            lhs: {
              type: Lang.Type.Number,
              location: Lang.rangeFrom(1, 1, 1, 1),
              content: numVal(1)
            },
            rhs: {
              type: Lang.Type.BinaryOp,
              op,
              // TODO: deal with brackets in location?
              location: Lang.rangeFrom(1, 8 + opOffset, 1, 8 + 2 * opOffset),
              lhs: {
                type: Lang.Type.Number,
                location: Lang.rangeFrom(1, 6 + opOffset, 1, 6 + opOffset),
                content: numVal(1)
              },
              rhs: {
                type: Lang.Type.Number,
                location: Lang.rangeFrom(1, 10 + 2 * opOffset, 1, 11 + 2 * opOffset),
                content: numVal(42)
              }
            }
          }
        ))
      })
    }
  })
})
