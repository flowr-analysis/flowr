import { assertAst, describeSession } from '../../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../../helper/ast-builder'
import { RAssignmentOpPool } from '../../../helper/provider'

describe('2. Parse simple assignments', () => {
  describeSession('1.1 constant assignments', shell => {
    for (const op of RAssignmentOpPool) {
      const opOffset = op.str.length - 1
      assertAst(`x ${op.str} 5`, shell, `x ${op.str} 5`, exprList({
        type:     Lang.Type.BinaryOp,
        location: Lang.rangeFrom(1, 3, 1, 3 + opOffset),
        flavor:   'assignment',
        lexeme:   op.str,
        op:       op.str,
        lhs:      {
          type:     Lang.Type.Symbol,
          location: Lang.rangeFrom(1, 1, 1, 1),
          lexeme:   'x',
          content:  'x'
        },
        rhs: {
          type:     Lang.Type.Number,
          location: Lang.rangeFrom(1, 5 + opOffset, 1, 5 + opOffset),
          lexeme:   '5',
          content:  numVal(5)
        }
      }))
    }
  })
})
