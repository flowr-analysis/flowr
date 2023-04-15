import type * as Lang from '../../../src/r-bridge/lang/ast/model'
import { it } from 'mocha'
import { RShell } from '../../../src/r-bridge/shell'
import { testRequiresNetworkConnection } from '../network-helper'
import { getStoredTokenMap, retrieveAstFromRCode } from '../../../src/r-bridge/retriever'
import { assert } from 'chai'

let defaultTokenMap: Record<string, string>

// we want the token map only once (to speed up tests)!
before(async () => {
  const shell = new RShell()
  try {
    shell.tryToInjectHomeLibPath()
    await shell.ensurePackageInstalled('xmlparsedata')
    defaultTokenMap = await getStoredTokenMap(shell)
  } finally {
    shell.close()
  }
})

/**
 * Produces a new test with the given name. It parses the `input` with R and checks the resulting ast against `expected`.
 * // TODO: allow to reuse shell?
 */
export const assertAst = (name: string, input: string, expected: Lang.RExprList): Mocha.Test => {
  return it(name, async function () {
    this.slow('500ms')
    const shell = new RShell()
    // this way we probably do not have to reinstall even if we launch from WebStorm
    shell.tryToInjectHomeLibPath()
    if (!await shell.isPackageInstalled('xmlparsedata')) {
      // if we do not have it, we need to install!
      await testRequiresNetworkConnection(this)
    }
    await shell.ensurePackageInstalled('xmlparsedata')

    after(() => { shell.close() })
    const ast = await retrieveAstFromRCode({ request: 'text', content: input, attachSourceInformation: true }, defaultTokenMap, shell)
    assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
  }).timeout('15min') /* retrieval downtime */
}
