import { assertDecoratedAst, withShell } from '../helper/shell'
import { deterministicCountingIdGenerator, type Id, decorateWithIds } from '../../src/dataflow/id'
import * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { type RExpressionList } from '../../src/r-bridge/lang:4.x/ast/model'
import { numVal } from '../helper/ast-builder'
import { rangeFrom } from '../../src/util/range'

describe('Assign unique Ids', withShell(shell => {
  describe('Testing deterministic counting Id assignment', () => {
    const assertId = (name: string, input: string, expected: RExpressionList<Id>): void => {
      assertDecoratedAst(name, shell, input, ast => decorateWithIds(ast, deterministicCountingIdGenerator()).decoratedAst, expected)
    }
    // decided to test with ast parsing, as we are dependent on these changes in reality
    describe('1. Single nodes (leafs)', () => {
      const exprList = (...children: Array<Lang.RNode<Id>>): Lang.RExpressionList<Id> => ({
        type:   Lang.Type.ExpressionList,
        lexeme: undefined,
        id:     '1',
        children
      })
      assertId('1.1 String', '"hello"', exprList({
        type:     Lang.Type.String,
        location: rangeFrom(1, 1, 1, 7),
        lexeme:   '"hello"',
        content:  {
          str:    'hello',
          quotes: '"'
        },
        id: '0'
      }))
      assertId('1.2 Number', '42', exprList({
        type:     Lang.Type.Number,
        location: rangeFrom(1, 1, 1, 2),
        lexeme:   '42',
        content:  numVal(42),
        id:       '0'
      }))
      assertId('1.3 Logical', 'FALSE', exprList({
        type:     Lang.Type.Logical,
        location: rangeFrom(1, 1, 1, 5),
        lexeme:   'FALSE',
        content:  false,
        id:       '0'
      }))
      assertId('1.4 Symbol', 'k', exprList({
        type:     Lang.Type.Symbol,
        location: rangeFrom(1, 1, 1, 1),
        lexeme:   'k',
        content:  'k',
        id:       '0'
      }))
    })
    // TODO: Tests others
  })
}))
