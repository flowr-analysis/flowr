import { Slicer } from '../../src/benchmark/slicer'
import { stats2string } from '../../src/benchmark/stats/print'
import { assert } from 'chai'
import { summarizePerSliceStats } from '../../src/benchmark/stats/summarizer'

describe("The Benchmark Slicer", () => {
  describe('Stats by parsing text-based inputs', () => {
    it('Simple slice for simple line', async() => {
      const slicer = new Slicer()
      await slicer.init({ request: 'text', content: 'a <- b' })
      slicer.slice('1@a')
      const stats = slicer.finish()
      const statInfo = stats2string(stats)
      console.log(statInfo)
      assert.strictEqual(stats.input.numberOfLines, 1, statInfo)
      assert.strictEqual(stats.input.numberOfCharacters, 6, statInfo)
      assert.strictEqual(stats.input.numberOfRTokens, 6, statInfo)
      assert.strictEqual(stats.input.numberOfNormalizedTokens, 4, statInfo) // root expression list, assignment, lhs, rhs
      assert.strictEqual(stats.dataflow.numberOfNodes, 2, statInfo) // the defined variable and the reading ref
      assert.strictEqual(stats.dataflow.numberOfEdges, 1, statInfo) // the defined-by edge
      assert.strictEqual(stats.dataflow.numberOfCalls, 0, statInfo) // no calls
      assert.strictEqual(stats.dataflow.numberOfFunctionDefinitions, 0, statInfo) // no definitions
    })
  })
})
