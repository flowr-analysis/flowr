import { it } from 'mocha'
import { testRequiresNetworkConnection } from '../network-helper'
import { assert } from 'chai'
import { RShell } from '../../../src/r-bridge/shell'
import * as Lang from '../../../src/r-bridge/lang/ast/model'
import { getStoredTokenMap, retrieveAstFromRCode } from '../../../src/r-bridge/retriever'

export function simpleAstParsingSpec(): void {
  const assertAst = (msg: string, input: string, expected: Lang.RExprList): Mocha.Test => {
    return it(msg, async function () {
      this.slow('500ms')
      const shell = new RShell()
      // this way we probably do not have to reinstall even if we launch from WebStorm
      shell.tryToInjectHomeLibPath()
      if (!await shell.isPackageInstalled('xmlparsedata')) {
        // if we do not have it, we need to install!
        await testRequiresNetworkConnection(this)
      }
      await shell.ensurePackageInstalled('xmlparsedata')
      const defaultTokenMap = await getStoredTokenMap(shell)

      after(() => { shell.close() })
      const ast = await retrieveAstFromRCode({ request: 'text', content: input, attachSourceInformation: true }, defaultTokenMap, shell)
      assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
    }).timeout('15min') /* retrieval downtime */
  }
  const exprList = (...children: Lang.RNode[]): Lang.RExprList => {
    return { type: Lang.Type.ExprList, children }
  }

  assertAst('0. retrieve ast of literal', '1', exprList({
    type: Lang.Type.Number,
    location: Lang.rangeFrom(1, 1, 1, 1),
    content: 1
  }))

  assertAst('1. retrieve ast of simple expression', '1 + 1', exprList(
    {
      type: Lang.Type.BinaryOp,
      op: '+',
      location: Lang.rangeFrom(1, 3, 1, 3),
      lhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 1, 1, 1),
        content: 1
      },
      rhs: {
        type: Lang.Type.Number,
        location: Lang.rangeFrom(1, 5, 1, 5),
        content: 1
      }
    }
  )
  )
}
