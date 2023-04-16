import { assertAst, describeSession } from '../helper/shell'
import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { exprList } from '../helper/ast-builder'

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
