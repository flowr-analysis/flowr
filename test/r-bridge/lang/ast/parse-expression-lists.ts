import { assertAst, withShell } from "../../../helper/shell"
import { exprList, numVal } from "../../../helper/ast-builder"
import { rangeFrom } from "../../../../src/util/range"
import { Type } from '../../../../src/r-bridge'

describe("Parse expression lists",
  withShell((shell) => {
    describe("Expression lists with newlines and braces", () => {
      // TODO: find a better way to name these tests
      // this is already covered by other tests, yet it is good to state it here explicitly (expr list is the default top-level token for R)
      assertAst(`"42" (single element)`, shell,
        `42`,
        exprList({
          type:     Type.Number,
          location: rangeFrom(1, 1, 1, 2),
          lexeme:   "42",
          content:  numVal(42),
          info:     {}
        })
      )
      // the r standard does not seem to allow '\r\n' or '\n\r'
      // TODO: split again for R treats lines differently on location compare
      const twoLine = `42\na`
      assertAst(`${JSON.stringify(twoLine)} (two lines)`, shell,
        twoLine,
        exprList(
          {
            type:     Type.Number,
            location: rangeFrom(1, 1, 1, 2),
            lexeme:   "42",
            content:  numVal(42),
            info:     {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(2, 1, 2, 1),
            namespace: undefined,
            lexeme:    "a",
            content:   "a",
            info:      {}
          }
        )
      )

      const manyLines = `a\nb\nc\nd\nn2\nz\n`
      assertAst(`${JSON.stringify(manyLines)} (many lines)`, shell,
        manyLines,
        exprList(
          {
            type:      Type.Symbol,
            location:  rangeFrom(1, 1, 1, 1),
            namespace: undefined,
            lexeme:    "a",
            content:   "a",
            info:      {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(2, 1, 2, 1),
            namespace: undefined,
            lexeme:    "b",
            content:   "b",
            info:      {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(3, 1, 3, 1),
            namespace: undefined,
            lexeme:    "c",
            content:   "c",
            info:      {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(4, 1, 4, 1),
            namespace: undefined,
            lexeme:    "d",
            content:   "d",
            info:      {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(5, 1, 5, 2),
            namespace: undefined,
            lexeme:    "n2",
            content:   "n2",
            info:      {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(6, 1, 6, 1),
            namespace: undefined,
            lexeme:    "z",
            content:   "z",
            info:      {}
          }
        )
      )

      const twoLineWithBraces = `{ 42\na }`
      assertAst(`${JSON.stringify(twoLineWithBraces)} (two lines with braces)`, shell,
        twoLineWithBraces,
        exprList({
          type:     Type.ExpressionList,
          location: rangeFrom(1, 1, 2, 3),
          lexeme:   "{ 42\na }",
          info:     {},
          children: [
            {
              type:     Type.Number,
              location: rangeFrom(1, 3, 1, 4),
              lexeme:   "42",
              content:  numVal(42),
              info:     {}
            },
            {
              type:      Type.Symbol,
              location:  rangeFrom(2, 1, 2, 1),
              namespace: undefined,
              lexeme:    "a",
              content:   "a",
              info:      {}
            },
          ],
        })
      )

      // { 42\na }{ x } seems to be illegal for R...
      const multipleBraces = `{ 42\na }\n{ x }`
      assertAst(`${JSON.stringify(multipleBraces)} (multiple braces)`, shell,
        multipleBraces,
        exprList(
          {
            type:     Type.ExpressionList,
            location: rangeFrom(1, 1, 2, 3),
            lexeme:   "{ 42\na }",
            info:     {},
            children: [
              {
                type:     Type.Number,
                location: rangeFrom(1, 3, 1, 4),
                lexeme:   "42",
                content:  numVal(42),
                info:     {}
              },
              {
                type:      Type.Symbol,
                location:  rangeFrom(2, 1, 2, 1),
                namespace: undefined,
                lexeme:    "a",
                content:   "a",
                info:      {}
              },
            ],
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(3, 3, 3, 3),
            namespace: undefined,
            lexeme:    "x",
            content:   "x",
            info:      {}
          }
        )
      )
    })

    describe("Expression lists with semicolons", () => {
      assertAst(`"42;a" (two elements in same line)`, shell,
        `42;a`,
        exprList(
          {
            type:     Type.Number,
            location: rangeFrom(1, 1, 1, 2),
            lexeme:   "42",
            content:  numVal(42),
            info:     {}
          },
          {
            type:      Type.Symbol,
            location:  rangeFrom(1, 4, 1, 4),
            namespace: undefined,
            lexeme:    "a",
            content:   "a",
            info:      {}
          }
        )
      )

      assertAst(`"{ 3; }" (empty)`, shell,
        `{ 3; }`,
        exprList({
          type:     Type.Number,
          location: rangeFrom(1, 3, 1, 3),
          lexeme:   "3",
          content:  numVal(3),
          info:     {}
        })
      )


      assertAst('Inconsistent split with semicolon', shell,
        '1\n2; 3\n4',
        exprList({
          type:     Type.Number,
          location: rangeFrom(1, 1, 1, 1),
          lexeme:   "1",
          content:  numVal(1),
          info:     {}
        }, {
          type:     Type.Number,
          location: rangeFrom(2, 1, 2, 1),
          lexeme:   "2",
          content:  numVal(2),
          info:     {}
        }, {
          type:     Type.Number,
          location: rangeFrom(2, 4, 2, 4),
          lexeme:   "3",
          content:  numVal(3),
          info:     {}
        }, {
          type:     Type.Number,
          location: rangeFrom(3, 1, 3, 1),
          lexeme:   "4",
          content:  numVal(4),
          info:     {}
        }
        )
      )
    })
  })
)
