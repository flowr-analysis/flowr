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
          flavour:      "named",
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
    // TODO: update slice criterion resolution for arguments
    describe("functions with arguments", () => {
      assertAst(
        "f(1, 2)",
        shell,
        "f(1, 2)",
        exprList({
          type:         Type.FunctionCall,
          flavour:      "named",
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
              type:     Type.Argument,
              location: rangeFrom(1, 3, 1, 3),
              name:     undefined,
              info:     {},
              lexeme:   "1",
              value:    {
                type:     Type.Number,
                location: rangeFrom(1, 3, 1, 3),
                lexeme:   "1",
                content:  numVal(1),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 6, 1, 6),
              name:     undefined,
              lexeme:   "2",
              info:     {},
              value:    {
                type:     Type.Number,
                location: rangeFrom(1, 6, 1, 6),
                lexeme:   "2",
                content:  numVal(2),
                info:     {}
              }
            }
          ],
        })
      )
    })
    describe("functions with named arguments", () => {
      assertAst(
        "f(1, x=2, 4, y=3)",
        shell,
        "f(1, x=2, 4, y=3)",
        exprList({
          type:         Type.FunctionCall,
          flavour:      "named",
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
              type:     Type.Argument,
              location: rangeFrom(1, 3, 1, 3),
              name:     undefined,
              info:     {},
              lexeme:   "1",
              value:    {
                type:     Type.Number,
                location: rangeFrom(1, 3, 1, 3),
                lexeme:   "1",
                content:  numVal(1),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 6, 1, 6),
              name:     {
                type:      Type.Symbol,
                location:  rangeFrom(1, 6, 1, 6),
                lexeme:    "x",
                content:   "x",
                namespace: undefined,
                info:      {}
              },
              lexeme: "x",
              info:   {},
              value:  {
                type:     Type.Number,
                location: rangeFrom(1, 8, 1, 8),
                lexeme:   "2",
                content:  numVal(2),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 11, 1, 11),
              name:     undefined,
              info:     {},
              lexeme:   "4",
              value:    {
                type:     Type.Number,
                location: rangeFrom(1, 11, 1, 11),
                lexeme:   "4",
                content:  numVal(4),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 14, 1, 14),
              name:     {
                type:      Type.Symbol,
                location:  rangeFrom(1, 14, 1, 14),
                lexeme:    "y",
                content:   "y",
                namespace: undefined,
                info:      {}
              },
              lexeme: "y",
              info:   {},
              value:  {
                type:     Type.Number,
                location: rangeFrom(1, 16, 1, 16),
                lexeme:   "3",
                content:  numVal(3),
                info:     {}
              }
            }
          ],
        })
      )
    })
    /*
    describe("directly called functions", () => {
      assertAst(
        "Directly call with 2",
        shell,
        "(function(x) { x + 1 })(2)",
        exprList({
          type:         Type.FunctionCall,
          flavour:      "named", // TODO:
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
              type:     Type.Argument,
              location: rangeFrom(1, 3, 1, 3),
              name:     undefined,
              info:     {},
              lexeme:   "1",
              value:    {
                type:     Type.Number,
                location: rangeFrom(1, 3, 1, 3),
                lexeme:   "1",
                content:  numVal(1),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 6, 1, 6),
              name:     {
                type:      Type.Symbol,
                location:  rangeFrom(1, 6, 1, 6),
                lexeme:    "x",
                content:   "x",
                namespace: undefined,
                info:      {}
              },
              lexeme: "x",
              info:   {},
              value:  {
                type:     Type.Number,
                location: rangeFrom(1, 8, 1, 8),
                lexeme:   "2",
                content:  numVal(2),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 11, 1, 11),
              name:     undefined,
              info:     {},
              lexeme:   "4",
              value:    {
                type:     Type.Number,
                location: rangeFrom(1, 11, 1, 11),
                lexeme:   "4",
                content:  numVal(4),
                info:     {}
              }
            }, {
              type:     Type.Argument,
              location: rangeFrom(1, 14, 1, 14),
              name:     {
                type:      Type.Symbol,
                location:  rangeFrom(1, 14, 1, 14),
                lexeme:    "y",
                content:   "y",
                namespace: undefined,
                info:      {}
              },
              lexeme: "y",
              info:   {},
              value:  {
                type:     Type.Number,
                location: rangeFrom(1, 16, 1, 16),
                lexeme:   "3",
                content:  numVal(3),
                info:     {}
              }
            }
          ],
        })
      )
    })
*/
    describe("functions with explicit namespacing", () => {
      assertAst(
        "x::f()",
        shell,
        "x::f()",
        exprList({
          type:         Type.FunctionCall,
          flavour:      "named",
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
