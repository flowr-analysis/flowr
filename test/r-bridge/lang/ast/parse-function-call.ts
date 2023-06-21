import { assertAst, withShell } from "../../../helper/shell"
import { exprList, numVal } from "../../../helper/ast-builder"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe("Parse function calls",
  withShell((shell) => {
    describe("functions without arguments", () => {
      assertAst(
        "f()",
        shell,
        "f()",
        exprList({
          type:         Type.FunctionCall,
          location:     rangeFrom(1, 1, 1, 1),
          lexeme:       "f", // TODO: make this more sensible?
          info:         {},
          functionName: {
            type:      Type.Symbol,
            location:  rangeFrom(1, 1, 1, 1),
            lexeme:    "f",
            content:   "f",
            namespace: undefined,
            info:      {},
          },
          arguments: [],
        })
      )
    })
    describe("functions with arguments", () => {
      assertAst(
        "f(1, 2)",
        shell,
        "f(1, 2)",
        exprList({
          type:         Type.FunctionCall,
          location:     rangeFrom(1, 1, 1, 1),
          lexeme:       "f", // TODO: make this more sensible?
          info:         {},
          functionName: {
            type:      Type.Symbol,
            location:  rangeFrom(1, 1, 1, 1),
            lexeme:    "f",
            content:   "f",
            namespace: undefined,
            info:      {}
          },
          arguments: [
            {
              type:     Type.Number,
              location: rangeFrom(1, 3, 1, 3),
              lexeme:   "1",
              content:  numVal(1),
              info:     {}
            },
            {
              type:     Type.Number,
              location: rangeFrom(1, 6, 1, 6),
              lexeme:   "2",
              content:  numVal(2),
              info:     {}
            },
          ],
        })
      )
    })
    describe("functions with named arguments", () => { /* TODO */ })
    describe("functions with explicit namespacing", () => {
      assertAst(
        "x::f()",
        shell,
        "x::f()",
        exprList({
          type:         Type.FunctionCall,
          location:     rangeFrom(1, 1, 1, 4),
          lexeme:       "x::f", // TODO: make this more sensible?
          info:         {},
          functionName: {
            type:      Type.Symbol,
            location:  rangeFrom(1, 4, 1, 4),
            lexeme:    "f",
            content:   "f",
            namespace: "x",
            info:      {}
          },
          arguments: [],
        })
      )
    })
    // TODO: identify the correct namespace otherwise (statically this is surely limited :c )
  })
)
