import { assertAst, withShell } from "../../../helper/shell"
import {
  RNumberPool,
  RStringPool,
  RSymbolPool,
} from "../../../helper/provider"
import { exprList } from "../../../helper/ast-builder"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from "../../../../src/r-bridge/lang:4.x/ast/model/type"

describe(
  "0. Constant Parsing",
  withShell((shell) => {
    describe("0. parse single", () => {
      describe("0.1 numbers", () => {
        for (const number of RNumberPool) {
          const range = rangeFrom(1, 1, 1, number.str.length)
          assertAst(
            number.str,
            shell,
            number.str,
            exprList({
              type:     Type.Number,
              location: range,
              lexeme:   number.str,
              content:  number.val,
            })
          )
        }
      })
      describe("0.2 strings", () => {
        for (const string of RStringPool) {
          const range = rangeFrom(1, 1, 1, string.str.length)
          assertAst(
            string.str,
            shell,
            string.str,
            exprList({
              type:     Type.String,
              location: range,
              lexeme:   string.str,
              content:  string.val,
            })
          )
        }
      })
      describe("0.3 symbols", () => {
        for (const symbol of RSymbolPool) {
          const range = rangeFrom(
            1,
            symbol.symbolStart,
            1,
            symbol.symbolStart + symbol.val.length - 1
          )
          assertAst(
            symbol.str,
            shell,
            symbol.str,
            exprList({
              type:      Type.Symbol,
              namespace: symbol.namespace,
              location:  range,
              lexeme:    symbol.val,
              content:   symbol.val,
            })
          )
        }
      })
      describe("0.4 boolean", () => {
        assertAst(
          "TRUE",
          shell,
          "TRUE",
          exprList({
            type:     Type.Logical,
            location: rangeFrom(1, 1, 1, 4),
            lexeme:   "TRUE",
            content:  true,
          })
        )
        assertAst(
          "FALSE",
          shell,
          "FALSE",
          exprList({
            type:     Type.Logical,
            location: rangeFrom(1, 1, 1, 5),
            lexeme:   "FALSE",
            content:  false,
          })
        )
      })
    })
    // TODO: vectors etc.
  })
)
