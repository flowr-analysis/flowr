import { assertAst, withShell } from '../../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../../helper/ast-builder'
import { rangeFrom } from '../../../../src/util/range'

describe('3. Parse expression lists', withShell(shell => {
  describe('1. Expression lists with newlines and braces', () => {
    // TODO: find a better way to name these tests
    // this is already covered by other tests, yet it is good to state it here explicitly (expr list is the default top-level token for R)
    assertAst(`1.1 "42" (single element)`, shell, `42`, exprList({
      type:     Lang.Type.Number,
      location: rangeFrom(1, 1, 1, 2),
      lexeme:   '42',
      content:  numVal(42)
    }))
    // the r standard does not seem to allow '\r\n' or '\n\r'
    // TODO: split again for R treats lines differently on location compare
    const twoLine = `42\na`
    assertAst(`1.2 ${JSON.stringify(twoLine)} (two lines)`, shell, twoLine, exprList({
      type:     Lang.Type.Number,
      location: rangeFrom(1, 1, 1, 2),
      lexeme:   '42',
      content:  numVal(42)
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(2, 1, 2, 1),
      lexeme:   'a',
      content:  'a'
    }))

    const manyLines = `a\nb\nc\nd\nn2\nz\n`
    assertAst(`1.3 ${JSON.stringify(manyLines)} (many lines)`, shell, manyLines, exprList({
      type:     Lang.Type.Symbol,
      location: rangeFrom(1, 1, 1, 1),
      lexeme:   'a',
      content:  'a'
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(2, 1, 2, 1),
      lexeme:   'b',
      content:  'b'
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(3, 1, 3, 1),
      lexeme:   'c',
      content:  'c'
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(4, 1, 4, 1),
      lexeme:   'd',
      content:  'd'
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(5, 1, 5, 2),
      lexeme:   'n2',
      content:  'n2'
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(6, 1, 6, 1),
      lexeme:   'z',
      content:  'z'
    }))

    const twoLineWithBraces = `{ 42\na }`
    assertAst(`1.4 ${JSON.stringify(twoLineWithBraces)} (two lines with braces)`, shell, twoLineWithBraces, exprList({
      type:     Lang.Type.ExpressionList,
      location: rangeFrom(1, 1, 2, 3),
      lexeme:   '{ 42\na }',
      children: [
        {
          type:     Lang.Type.Number,
          location: rangeFrom(1, 3, 1, 4),
          lexeme:   '42',
          content:  numVal(42)
        },
        {
          type:     Lang.Type.Symbol,
          location: rangeFrom(2, 1, 2, 1),
          lexeme:   'a',
          content:  'a'
        }
      ]
    }))

    // { 42\na }{ x } seems to be illegal for R...
    const multipleBraces = `{ 42\na }\n{ x }`
    assertAst(`1.5 ${JSON.stringify(multipleBraces)} (multiple braces)`, shell, multipleBraces, exprList({
      type:     Lang.Type.ExpressionList,
      location: rangeFrom(1, 1, 2, 3),
      lexeme:   '{ 42\na }',
      children: [
        {
          type:     Lang.Type.Number,
          location: rangeFrom(1, 3, 1, 4),
          lexeme:   '42',
          content:  numVal(42)
        },
        {
          type:     Lang.Type.Symbol,
          location: rangeFrom(2, 1, 2, 1),
          lexeme:   'a',
          content:  'a'
        }
      ]
    }, {
      type:     Lang.Type.Symbol,
      location: rangeFrom(3, 3, 3, 3),
      lexeme:   'x',
      content:  'x'
    }))
  })

  describe('2. Expression lists with semicolons', () => {
    assertAst(`1.1 "42;a" (two elements in same line)`, shell, `42;a`, exprList(
      {
        type:     Lang.Type.Number,
        location: rangeFrom(1, 1, 1, 2),
        lexeme:   '42',
        content:  numVal(42)
      },
      {
        type:     Lang.Type.Symbol,
        location: rangeFrom(1, 4, 1, 4),
        lexeme:   'a',
        content:  'a'
      }))
  })
}))
