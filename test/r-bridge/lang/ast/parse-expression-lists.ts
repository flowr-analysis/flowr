import { assertAst, describeSession } from '../../../helper/shell'
import * as Lang from '../../../../src/r-bridge/lang:4.x/ast/model'
import { exprList, numVal } from '../../../helper/ast-builder'
import { RAssignmentOpPool } from '../../../helper/provider'

describe('3. Parse expression lists', () => {
  describeSession('1. Expression lists with newline', shell => {
    // this is already covered by other tests, yet it is good to state it here explicitly (expr list is the default top-level token for R)
    assertAst(`1.1 "42" (single element)`, shell, `42`, exprList({
      type:     Lang.Type.Number,
      location: Lang.rangeFrom(1, 1, 1, 2),
      lexeme:   '42',
      content:  numVal(42)
    }))
    assertAst(`1.2 "42\\na" (two lines)`, shell, `42\na`, exprList({
      type:     Lang.Type.Number,
      location: Lang.rangeFrom(1, 1, 1, 2),
      lexeme:   '42',
      content:  numVal(42)
    },
    {
      type:     Lang.Type.Symbol,
      location: Lang.rangeFrom(2, 1, 2, 1),
      lexeme:   'a',
      content:  'a'
    }))
    assertAst(`1.3 "{ 42\\na }" (two lines with braces)`, shell, `{ 42\na }`, exprList({
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
      ]})
    )
    // { 42\na }{ x } seems to be illegal for R...
    assertAst(`1.4 "{ 42\\na }\n{ x }" (multiple braces)`, shell, `{ 42\na }\n{ x }`, exprList(
      {
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
      },
      {
        type:     Lang.Type.Symbol,
        location: Lang.rangeFrom(3, 3, 3, 3),
        lexeme:   'x',
        content:  'x'
      }
    )
    )
  })
})
