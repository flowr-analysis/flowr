import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { assertAst } from './ast-helper'

const exprList = (...children: Lang.RNode[]): Lang.RExprList => {
  return { type: Lang.Type.ExprList, children }
}

describe('0. parse simple values', () => {
  assertAst('0.1 literal', '1', exprList({
    type: Lang.Type.Number,
    location: Lang.rangeFrom(1, 1, 1, 1),
    content: 1
  }))
  assertAst('0.2 string', '"hi"', exprList({
    type: Lang.Type.String,
    location: Lang.rangeFrom(1, 1, 1, 4),
    quotes: '"',
    content: 'hi'
  }))
})

assertAst('1. retrieve ast of simple expression', '1 + 1', exprList(
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
