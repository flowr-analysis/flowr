import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'

import { exprList, numVal } from '../../../helper/ast-builder'
import { assertAst, describeSession } from '../../../helper/shell'

describe('99. Parse larger snippets', () => {
  describeSession('99.1 if-then, assignments, symbols, and comparisons', shell => {
    assertAst('max function', shell, `
a <- 3
b = 4
if (a >b) {
  max <<- a
  i ->2
} else {
  b ->> max
}
max
    `, exprList(
      {
        type: Lang.Type.BinaryOp,
        flavor: 'assignment',
        lexeme: '<-',
        op: '<-',
        location: Lang.rangeFrom(2, 3, 2, 4),
        lhs: { type: Lang.Type.Symbol, lexeme: 'a', content: 'a', location: Lang.rangeFrom(2, 1, 2, 1) },
        rhs: { type: Lang.Type.Number, lexeme: '3', content: numVal(3), location: Lang.rangeFrom(2, 6, 2, 6) }
      },
      {
        type: Lang.Type.BinaryOp,
        flavor: 'assignment',
        lexeme: '=',
        op: '=',
        location: Lang.rangeFrom(3, 3, 3, 3),
        lhs: { type: Lang.Type.Symbol, lexeme: 'b', content: 'b', location: Lang.rangeFrom(3, 1, 3, 1) },
        rhs: { type: Lang.Type.Number, lexeme: '4', content: numVal(4), location: Lang.rangeFrom(3, 5, 3, 5) }
      },
      {
        type: Lang.Type.If,
        lexeme: 'if',
        location: Lang.rangeFrom(4, 1, 4, 2),
        condition: {
          type: Lang.Type.BinaryOp,
          flavor: 'comparison',
          lexeme: '>',
          op: '>',
          location: Lang.rangeFrom(4, 7, 4, 7),
          lhs: { type: Lang.Type.Symbol, lexeme: 'a', content: 'a', location: Lang.rangeFrom(4, 5, 4, 5) },
          rhs: { type: Lang.Type.Symbol, lexeme: 'b', content: 'b', location: Lang.rangeFrom(4, 8, 4, 8) }
        },
        then: {
          type: Lang.Type.ExprList,
          content: '{\nmax <<- a\ni ->2\n}',
          location: Lang.rangeFrom(4, 11, 7, 1),
          lexeme: undefined,
          children: [
            {
              type: Lang.Type.BinaryOp,
              flavor: 'assignment',
              lexeme: '<<-',
              op: '<<-',
              location: Lang.rangeFrom(5, 7, 5, 9),
              lhs: { type: Lang.Type.Symbol, lexeme: 'max', content: 'max', location: Lang.rangeFrom(5, 3, 5, 5) },
              rhs: { type: Lang.Type.Symbol, lexeme: 'a', content: 'a', location: Lang.rangeFrom(5, 11, 5, 11) }
            },
            {
              type: Lang.Type.BinaryOp,
              flavor: 'assignment',
              lexeme: '->',
              op: '->',
              location: Lang.rangeFrom(6, 5, 6, 6),
              lhs: { type: Lang.Type.Symbol, lexeme: 'i', content: 'i', location: Lang.rangeFrom(6, 3, 6, 3) },
              rhs: { type: Lang.Type.Number, lexeme: '2', content: numVal(2), location: Lang.rangeFrom(6, 7, 6, 7) }
            }
          ]
        },
        otherwise: {
          type: Lang.Type.BinaryOp,
          flavor: 'assignment',
          lexeme: '->>',
          op: '->>',
          location: Lang.rangeFrom(8, 5, 8, 7),
          lhs: { type: Lang.Type.Symbol, lexeme: 'b', content: 'b', location: Lang.rangeFrom(8, 3, 8, 3) },
          rhs: { type: Lang.Type.Symbol, lexeme: 'max', content: 'max', location: Lang.rangeFrom(8, 9, 8, 11) }
        }
      },
      {
        type: Lang.Type.Symbol,
        lexeme: 'max',
        content: 'max',
        location: Lang.rangeFrom(10, 1, 10, 3)
      }
    ))
  })
})
