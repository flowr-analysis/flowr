import { assertAst, describeSession } from '../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang/ast/model'
import { exprList, numVal } from '../../helper/ast-builder'

describe('1. Parse simple assignments', () => {
  describeSession('1.1 local assignments', shell => {
    describe('1.1.1 local & constant assignments', () => {
      assertAst('x <- 5', shell, 'x <- 5', exprList({
        type: Lang.Type.Assignment,
        location: Lang.rangeFrom(1, 1, 1, 6),
        lexeme: '<-',
        op: '<-',
        lhs: {
          type: Lang.Type.Symbol,
          location: Lang.rangeFrom(1, 1, 1, 2),
          lexeme: 'x',
          content: 'x'
        },
        rhs: {
          type: Lang.Type.Number,
          location: Lang.rangeFrom(1, 5, 1, 6),
          lexeme: '5',
          content: numVal(5)
        }
      }))
    })
  })
})
