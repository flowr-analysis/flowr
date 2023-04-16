import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { assertAst, describeSession } from '../helper/shell'
import { RNumberPool } from '../helper/provider'

const exprList = (...children: Lang.RNode[]): Lang.RExprList => {
  return { type: Lang.Type.ExprList, children }
}

describeSession('0. parse simple values', shell => {
  // TODO: integer constants
  describe('0.1 numbers', () => {
    for (const number of RNumberPool) {
      assertAst(number.str, shell, number.str, exprList({
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 1, 1, number.str.length),
        content: number.val
      }))
    }
  })
  assertAst('string', shell, '"hi"', exprList({
    type: Lang.Type.String,
    location: Lang.rangeFrom(1, 1, 1, 4),
    quotes: '"',
    content: 'hi'
  }))
  assertAst('boolean', shell, 'TRUE', exprList({
    type: Lang.Type.String,
    location: Lang.rangeFrom(1, 1, 1, 4),
    quotes: '"',
    content: 'hi'
  }))
})

describeSession('1. Parse simple expressions', shell => {
  assertAst('1. retrieve ast of simple expression', shell, '1 + 1', exprList(
    {
      type: Lang.Type.BinaryOp,
      op: '+',
      location: Lang.rangeFrom(1, 3, 1, 3),
      lhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 1, 1, 1),
        content: { num: 1, markedAsInt: false, complexNumber: false }
      },
      rhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 5, 1, 5),
        content: { num: 1, markedAsInt: false, complexNumber: false }
      }
    }
  )
  )
})
