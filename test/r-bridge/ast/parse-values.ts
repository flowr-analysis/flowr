import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { assertAst, describeSession } from '../helper/shell'
import { RNumberPool, RStringPool, RSymbolPool } from '../helper/provider'
import { exprList } from '../helper/ast-builder'

describeSession('0. parse values', shell => {
  describe('0.1 numbers', () => {
    for (const number of RNumberPool) {
      const range = Lang.rangeFrom(1, 1, 1, number.str.length)
      assertAst(number.str, shell, number.str, exprList({
        type: Lang.Type.Number,
        location: range,
        content: number.val
      }))
    }
  })
  describe('0.2 strings', () => {
    for (const string of RStringPool) {
      const range = Lang.rangeFrom(1, 1, 1, string.str.length)
      assertAst(string.str, shell, string.str, exprList({
        type: Lang.Type.String,
        location: range,
        content: string.val
      })
      )
    }
  })
  describe('0.3 symbols', () => {
    for (const symbol of RSymbolPool) {
      const range = Lang.rangeFrom(1, 1, 1, symbol.str.length)
      assertAst(symbol.str, shell, symbol.str, exprList({
        type: Lang.Type.Symbol,
        location: range,
        content: symbol.val
      })
      )
    }
  })
  assertAst('boolean', shell, 'TRUE', exprList({
    type: Lang.Type.Boolean,
    location: Lang.rangeFrom(1, 1, 1, 4),
    content: true
  }))
})
