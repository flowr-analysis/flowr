import type * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { it } from 'mocha'
import { RShell } from '../../src/r-bridge/shell'
import { testRequiresNetworkConnection } from './network'
import { getStoredTokenMap, retrieveAstFromRCode } from '../../src/r-bridge/retriever'
import { assert } from 'chai'
import { DataflowGraph, diffGraphsToMermaid, diffGraphsToMermaidUrl, graphToMermaidUrl } from '../../src/dataflow/graph'
import { decorateWithIds, deterministicCountingIdGenerator } from '../../src/dataflow/id'
import { decorateWithParentInformation } from '../../src/dataflow/parents'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'

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

export const testWithShell = (msg: string, fn: (shell: RShell, test: Mocha.Context) => void | Promise<void>): Mocha.Test => {
  return it(msg, async function (): Promise<void> {
    let shell: RShell | null = null
    try {
      shell = new RShell()
      await fn(shell, this)
    } finally {
      // ensure we close the shell in error cases too
      shell?.close()
    }
  })
}

export const describeSession = (name: string, fn: (shell: RShell) => void, packages: string[] = ['xmlparsedata']): Mocha.Suite => {
  return describe(name, function () {
    this.slow('500ms') // allow for shell mechanics
    const shell = new RShell()
    // this way we probably do not have to reinstall even if we launch from WebStorm
    before(async () => {
      shell.tryToInjectHomeLibPath()
      for (const pkg of packages) {
        if (!await shell.isPackageInstalled(pkg)) {
          // TODO: only check this once? network should not be expected to break during tests
          await testRequiresNetworkConnection(this.ctx)
        }
        await shell.ensurePackageInstalled(pkg, true)
      }
    })
    fn(shell)
    after(() => {
      shell.close()
    })
  }).timeout('15min')
}

export const retrieveAst = async (shell: RShell, input: string): Promise<Lang.RExpressionList> => {
  return await retrieveAstFromRCode({
    request:                 'text',
    content:                 input,
    attachSourceInformation: true,
    ensurePackageInstalled:  false // should be called within describeSession for that!
  }, defaultTokenMap, shell)
}

/** call within describeSession */
export const assertAst = (name: string, shell: RShell, input: string, expected: Lang.RExpressionList): void => {
  it(name, async function () {
    const ast = await retrieveAst(shell, input)
    assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
  })
}

// TODO: improve comments and structure
/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, decorator: (input: Lang.RNode) => Lang.RNode<Decorated>, expected: Lang.RExpressionList<Decorated>): void {
  it(name, async function () {
    const baseAst = await retrieveAst(shell, input)
    const ast = decorator(baseAst)
    assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)} (baseAst before decoration: ${JSON.stringify(baseAst)})`)
  })
}

export const assertDataflow = (name: string, shell: RShell, input: string, expected: DataflowGraph, startIndexForDeterministicIds = 0): void => {
  it(name, async function () {
    const ast = await retrieveAst(shell, input)
    const astWithId = decorateWithIds(ast, deterministicCountingIdGenerator(startIndexForDeterministicIds))
    const astWithParentIds = decorateWithParentInformation(astWithId.decoratedAst)
    const { dataflowIdMap, dataflowGraph } = produceDataFlowGraph(astWithParentIds)

    const diff = diffGraphsToMermaidUrl({ label: 'expected', graph: expected }, { label: 'got', graph: dataflowGraph }, dataflowIdMap)
    try {
      assert.isTrue(expected.equals(dataflowGraph), diff)
    } catch (e) {
      console.error('vis-wanted:\n', graphToMermaidUrl(expected, dataflowIdMap))
      console.error('vis-got:\n', graphToMermaidUrl(dataflowGraph, dataflowIdMap))
      console.error('diff:\n', diff)
      throw e
    }
  })
}
