import { it } from "mocha"
import { testRequiresNetworkConnection } from "./network"
import { DeepPartial } from 'ts-essentials'
import {
  decorateAst, DecoratedAstMap, deterministicCountingIdGenerator,
  getStoredTokenMap, IdGenerator, NodeId, NoInfo,
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
import { produceDataFlowGraph } from '../../src/dataflow'
import { reconstructToCode } from '../../src/slicing/reconstruct'
import { naiveStaticSlicing } from '../../src/slicing/static'
import { SlicingCriterion, slicingCriterionToId } from '../../src/slicing/criteria'

let defaultTokenMap: Record<string, string>

// we want the token map only once (to speed up tests)!
before(async function() {
  this.timeout('15min')
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

// TODO: recursive work?
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeSourceInformation<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    if (key === 'fullRange' || key === 'additionalTokens' || key === 'fullLexeme') {
      return undefined
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value
  })) as T
}

function assertAstEqualIngoreSourceInformation<Info>(ast: RNode<Info>, expected: RNode<Info>, message?: string): void {
  const astCopy = removeSourceInformation(ast)
  const expectedCopy = removeSourceInformation(expected)
  assert.deepStrictEqual(astCopy, expectedCopy, message)
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
    assertAstEqualIngoreSourceInformation(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)}`)
  })
}

// TODO: improve comments and structure
/** call within describeSession */
export function assertDecoratedAst<Decorated>(name: string, shell: RShell, input: string, decorator: (input: RNode) => RNode<Decorated>, expected: RNodeWithParent<Decorated>): void {
  it(name, async function() {
    const baseAst = await retrieveAst(shell, input)
    const ast = decorator(baseAst)
    assertAstEqualIngoreSourceInformation(ast, expected, `got: ${JSON.stringify(ast)}, vs. expected: ${JSON.stringify(expected)} (baseAst before decoration: ${JSON.stringify(baseAst)})`)
  })
}

// TODO: allow more configuration with title, etc.
export const assertDataflow = (name: string, shell: RShell, input: string, expected: DataflowGraph, startIndexForDeterministicIds = 0): void => {
  it(`${name} (input: ${JSON.stringify(input)})`, async function() {
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


/** call within describeSession */
function printIdMapping(ids: NodeId[], map: DecoratedAstMap<NoInfo>): string {
  return ids.map(id => `${id}: ${JSON.stringify(map.get(id)?.lexeme)}`).join(', ')
}
export const assertReconstructed = (name: string, shell: RShell, input: string, ids: NodeId | NodeId[], expected: string, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Mocha.Test => {
  const selectedIds = Array.isArray(ids) ? ids : [ids]
  return it(name, async function() {
    const ast = await retrieveAst(shell, input)
    const decoratedAst = decorateAst(ast, getId)
    const reconstructed = reconstructToCode<NoInfo>(decoratedAst, new Set(selectedIds))
    assert.strictEqual(reconstructed, expected, `got: ${reconstructed}, vs. expected: ${expected}, for input ${input} (ids: ${printIdMapping(selectedIds, decoratedAst.idMap)})`)
  })
}


export const assertSliced = (name: string, shell: RShell, input: string, criteria: SlicingCriterion[], expected: string, getId: IdGenerator<NoInfo> = deterministicCountingIdGenerator(0)): Mocha.Test => {
  return it(`${JSON.stringify(criteria)} ${name}`, async function() {
    const ast = await retrieveAst(shell, input)
    const decoratedAst = decorateAst(ast, getId)


    const dataflow = produceDataFlowGraph(decoratedAst)

    try {
      const mappedIds = criteria.map(c => slicingCriterionToId(c, decoratedAst))

      const sliced = naiveStaticSlicing(dataflow.graph, decoratedAst.idMap, mappedIds)
      const reconstructed = reconstructToCode<NoInfo>(decoratedAst, sliced)

      assert.strictEqual(reconstructed, expected, `got: ${reconstructed}, vs. expected: ${expected}, for input ${input} (slice: ${printIdMapping(mappedIds, decoratedAst.idMap)}), url: ${graphToMermaidUrl(dataflow.graph, decoratedAst.idMap, sliced)}`)
    } catch (e) {
      console.error('vis-got:\n', graphToMermaidUrl(dataflow.graph, decoratedAst.idMap))
      throw e
    }
  })
}

