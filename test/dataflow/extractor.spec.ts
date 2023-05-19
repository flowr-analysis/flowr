// TODO: get def-usage for every line
import { retrieveAst } from '../helper/shell'
import { DataflowGraph, diffGraphsToMermaidUrl, graphToMermaidUrl, LocalScope } from '../../src/dataflow'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateAst, deterministicCountingIdGenerator, RShell } from '../../src/r-bridge'
import { it } from 'mocha'
import { assert } from 'chai'

// TODO: merge with shell afterwards
export const assertDataflow = (name: string, shell: RShell, input: string, expected: DataflowGraph, startIndexForDeterministicIds = 0): void => {
  it(name, async function() {
    const ast = await retrieveAst(shell, input)
    const decoratedAst = decorateAst(ast, deterministicCountingIdGenerator(startIndexForDeterministicIds))
    // TODO: use both info
    const { graph } = produceDataFlowGraph(decoratedAst, LocalScope)

    const diff = diffGraphsToMermaidUrl({ label: 'expected', graph: expected }, { label: 'got', graph}, decoratedAst.idMap)
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

describe("Extract Dataflow Information", () => {
  require('./elements/atomic')
})
