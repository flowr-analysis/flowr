import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { assertAst, describeSession } from '../helper/shell'

const exprList = (...children: Lang.RNode[]): Lang.RExprList => {
  return { type: Lang.Type.ExprList, children }
}

describeSession('0. parse simple values', shell => {
  // all examples are based on the R language def (Draft of 2023-03-15, 10.3.1)
  // TODO: integer constants
  describe('0.1 numbers', () => {
    for (const number of [{ val: 1, str: '1' }, { val: 10, str: '10' }, { val: 0.1, str: '0.1' },
      { val: 0.2, str: '0.2' }, { val: 1e-7, str: '1e-7' }, { val: 1.2e7, str: '1.2e7' }, { val: 0xAF12, str: '0xAF12' }
      /* { val: (1 * 16 + 1 / 16) * 2 ^ 1, str: '0x1.1p1' }, { val: (1 * 16 + 1 / 16) * 2 ^ 1, str: '0x1.1P1' } */]) {
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
        content: 1
      },
      rhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 5, 1, 5),
        content: 1
      }
    }
  )
  )
})
