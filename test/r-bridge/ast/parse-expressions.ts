import { assertAst, describeSession } from '../helper/shell'
import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { exprList, numVal } from '../helper/ast-builder'

describeSession('1. Parse simple expressions', shell => {
  assertAst('1.1 simple addition', shell, '1 + 1', exprList(
    Lang.rangeFrom(1, 1, 1, 5),
    {
      type: Lang.Type.BinaryOp,
      op: '+',
      location: Lang.rangeFrom(1, 1, 1, 5),
      lhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 1, 1, 1),
        content: numVal(1)
      },
      rhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 5, 1, 5),
        content: numVal(1)
      }
    }
  ))
})
