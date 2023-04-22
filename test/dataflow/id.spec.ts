import { assertDecoratedAst, describeSession } from '../helper/shell'
import { deterministicCountingIdGenerator, type Id, decorateWithIds } from '../../src/dataflow/id'
import * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { type RExprList } from '../../src/r-bridge/lang:4.x/ast/model'
import { numVal } from '../helper/ast-builder'

describe('Assign unique Ids', () => {
  describeSession('Testing deterministic counting Id assignment', (shell) => {
    const assertId = (name: string, input: string, expected: RExprList<Id>): void => {
      assertDecoratedAst(name, shell, input, ast => decorateWithIds(ast, deterministicCountingIdGenerator()).decoratedAst, expected)
    }
    // decided to test with ast parsing, as we are dependent on these changes in reality
    describe('1. Single nodes (leafs)', () => {
      const exprList = (...children: Array<Lang.RNode<Id>>): Lang.RExprList<Id> => ({
        type: Lang.Type.ExprList,
        lexeme: undefined,
        id: '1',
        children
      })
      assertId('1.1 String', '"hello"', exprList({
        type: Lang.Type.String,
        location: Lang.rangeFrom(1, 1, 1, 7),
        lexeme: '"hello"',
        content: {
          str: 'hello',
          quotes: '"'
        },
        id: '0'
      }))
      assertId('1.2 Number', '42', exprList({
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 1, 1, 2),
        lexeme: '42',
        content: numVal(42),
        id: '0'
      }))
      assertId('1.3 Logical', 'FALSE', exprList({
        type: Lang.Type.Logical,
        location: Lang.rangeFrom(1, 1, 1, 5),
        lexeme: 'FALSE',
        content: false,
        id: '0'
      }))
      assertId('1.4 Symbol', 'k', exprList({
        type: Lang.Type.Symbol,
        location: Lang.rangeFrom(1, 1, 1, 1),
        lexeme: 'k',
        content: 'k',
        id: '0'
      }))
    })
    // TODO: Tests others
  })
})
