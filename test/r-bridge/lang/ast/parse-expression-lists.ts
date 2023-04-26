import { assertAst, describeSession } from '../../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../../helper/ast-builder'
import { RAssignmentOpPool } from '../../../helper/provider'

describe('3. Parse expression lists', () => {
  describeSession('1. Artificial expression lists (newlines & ;)', shell => {
    // TODO: find a better way to name these tests
    // this is already covered by other tests, yet it is good to state it here explicitly (expr list is the default top-level token for R)
    assertAst(`1.1 "42" (single element)`, shell, `42`, exprList({
      type:     Lang.Type.Number,
      location: Lang.rangeFrom(1, 1, 1, 2),
      lexeme:   '42',
      content:  numVal(42)
    }))
    let idx = 1
    // the r standard does not seem to allow '\r\n' or '\n\r'
    for(const separator of ['\n', ';']) {
      describeSession(`1.${++idx} using ${JSON.stringify(separator)}`, shell => {
        const twoLine = `42${separator}a`
        assertAst(`1.${idx}.1 ${JSON.stringify(twoLine)} (two lines)`, shell, twoLine, exprList({
          type:     Lang.Type.Number,
          location: Lang.rangeFrom(1, 1, 1, 2),
          lexeme:   '42',
          content:  numVal(42)
        }, {
          type:     Lang.Type.Symbol,
          location: Lang.rangeFrom(2, 1, 2, 1),
          lexeme:   'a',
          content:  'a'
        }))
        const twoLineWithBraces = `{ 42${separator}a }`
        assertAst(`1.${idx}.2 ${JSON.stringify(twoLineWithBraces)} (two lines with braces)`, shell, twoLineWithBraces, exprList({
          type:     Lang.Type.ExpressionList,
          location: Lang.rangeFrom(1, 1, 2, 3),
          lexeme:   '{ 42\na }',
          children: [
            {
              type:     Lang.Type.Number,
              location: Lang.rangeFrom(1, 3, 1, 4),
              lexeme:   '42',
              content:  numVal(42)
            },
            {
              type:     Lang.Type.Symbol,
              location: Lang.rangeFrom(2, 1, 2, 1),
              lexeme:   'a',
              content:  'a'
            }
          ]
        }))

        // { 42\na }{ x } seems to be illegal for R...
        const multipleBraces = `{ 42${separator}a }${separator}{ x }`
        assertAst(`1.${idx}.3 ${JSON.stringify(multipleBraces)} (multiple braces)`, shell, multipleBraces, exprList({
          type:     Lang.Type.ExpressionList,
          location: Lang.rangeFrom(1, 1, 2, 3),
          lexeme:   '{ 42\na }',
          children: [
            {
              type:     Lang.Type.Number,
              location: Lang.rangeFrom(1, 3, 1, 4),
              lexeme:   '42',
              content:  numVal(42)
            },
            {
              type:     Lang.Type.Symbol,
              location: Lang.rangeFrom(2, 1, 2, 1),
              lexeme:   'a',
              content:  'a'
            }
          ]
        }, {
          type:     Lang.Type.Symbol,
          location: Lang.rangeFrom(3, 3, 3, 3),
          lexeme:   'x',
          content:  'x'
        }))
      })
    }
  })
  describeSession('2. Expression lists with semicolons', shell => {
    assertAst(`1.1 "42;a" (two elements in same line)`, shell, `42;a`, exprList({
      type:     Lang.Type.Number,
      location: Lang.rangeFrom(1, 1, 1, 2),
      lexeme:   '42',
      content:  numVal(42)
    }))
  })
})
