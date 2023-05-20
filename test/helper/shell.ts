import { it } from "mocha"
import { testRequiresNetworkConnection } from "./network"
import { DeepPartial } from 'ts-essentials'
import {
  decorateAst, deterministicCountingIdGenerator,
  getStoredTokenMap,
  retrieveAstFromRCode,
  RExpressionList,
  RNode, RNodeWithParent,
  RShell,
  XmlParserHooks
} from '../../src/r-bridge'
import { assert } from 'chai'
import {
  DataflowGraph,
  diffGraphsToMermaidUrl, graphToMermaidUrl, LocalScope
} from '../../src/dataflow'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'

let defaultTokenMap: Record<string, string>

// we want the token map only once (to speed up tests)!
before(async() => {
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
  return it(msg, async function(): Promise<void> {
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

/**
 * produces a shell session for you, can be used within a `describe` block
 * @param fn       - function to use the shell
 * @param packages - packages to be ensured when the shell is created
 */
export function withShell(fn: (shell: RShell) => void, packages: string[] = ['xmlparsedata']): () => void {
  // TODO: use this from context? to set this.slow?
  return function() {
    const shell = new RShell()
    // this way we probably do not have to reinstall even if we launch from WebStorm
    before(async function() {
      this.timeout('15min')
      shell.tryToInjectHomeLibPath()
      for (const pkg of packages) {
        if (!await shell.isPackageInstalled(pkg)) {
        // TODO: only check this once? network should not be expected to break during tests
          await testRequiresNetworkConnection(this)
        }
        await shell.ensurePackageInstalled(pkg, true)
      }
    })
    fn(shell)
    after(() => {
      shell.close()
    })
  }
}

export const retrieveAst = async(shell: RShell, input: string, hooks?: DeepPartial<XmlParserHooks>): Promise<RExpressionList> => {
  return await retrieveAstFromRCode({
    request:                 'text',
    content:                 input,
    attachSourceInformation: true,
    ensurePackageInstalled:  false // should be called within describeSession for that!
  }, defaultTokenMap, shell, hooks)
}

/** call within describeSession */
export const assertAst = (name: string, shell: RShell, input: string, expected: RExpressionList): Mocha.Test => {
  return it(name, async function() {
    const ast = await retrieveAst(shell, input)
    assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
  })
}

// TODO: improve comments and structure
/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, decorator: (input: RNode) => RNode<Decorated>, expected: RNodeWithParent<Decorated>): void {
  it(name, async function() {
    const baseAst = await retrieveAst(shell, input)
    const ast = decorator(baseAst)
    assert.deepStrictEqual(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)} (baseAst before decoration: ${JSON.stringify(baseAst)})`)
  })
}

// TODO: allow more configuration with title, etc.
export const assertDataflow = (name: string, shell: RShell, input: string, expected: DataflowGraph, startIndexForDeterministicIds = 0): void => {
  it(name, async function() {
    const ast = await retrieveAst(shell, input)
    const decoratedAst = decorateAst(ast, deterministicCountingIdGenerator(startIndexForDeterministicIds))
    // TODO: use both info
    const { graph } = produceDataFlowGraph(decoratedAst, LocalScope)

    const diff = diffGraphsToMermaidUrl({ label: 'expected', graph: expected }, { label: 'got', graph}, decoratedAst.idMap, `%% ${input.replace(/\n/g, '\n%% ')}\n`)
    try {
      assert.isTrue(expected.equals(graph), diff)
    } catch (e) {
      console.error('vis-wanted:\n', graphToMermaidUrl(expected, decoratedAst.idMap))
      console.error('vis-got:\n', graphToMermaidUrl(graph, decoratedAst.idMap))
      console.error('diff:\n', diff)
      throw e
    }
  })
}
