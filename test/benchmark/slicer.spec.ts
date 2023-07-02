import {
  BenchmarkSlicer,
  CommonSlicerMeasurements,
  stats2string,
  summarizeSlicerStats,
  PerSliceMeasurements
} from '../../src/benchmark'
import { assert } from 'chai'

async function retrieveStatsSafe(slicer: BenchmarkSlicer, request: { request: string; content: string }) {
  const rawStats = slicer.finish()
  const stats = await summarizeSlicerStats(rawStats)
  const statInfo = stats2string(stats)

  assert.strictEqual(stats.request, request, statInfo)
  assert.sameMembers([...stats.commonMeasurements.keys()], [...CommonSlicerMeasurements], `Must have all keys in common measurements ${statInfo}`)
  assert.sameMembers([...stats.perSliceMeasurements.measurements.keys()], [...PerSliceMeasurements], `Must have all keys in per-slice measurements ${statInfo}`)
  return { stats, statInfo }
}

describe("The Benchmark Slicer", () => {
  describe('Stats by parsing text-based inputs', () => {
    it('Simple slice for simple line', async() => {
      const slicer = new BenchmarkSlicer()
      const request = { request: 'text' as const, content: 'a <- b' }
      await slicer.init(request)
      slicer.slice('1@a')
      const { stats, statInfo } = await retrieveStatsSafe(slicer, request)

      // TODO: test more?

      assert.deepStrictEqual(stats.input, {
        numberOfLines:            1,
        numberOfCharacters:       6,
        numberOfRTokens:          6,
        numberOfNormalizedTokens: 4  // root expression list, assignment, lhs, rhs
      }, statInfo)
      assert.deepStrictEqual(stats.dataflow, {
        numberOfNodes:               2,  // the defined variable and the reading ref
        numberOfEdges:               1,  // the defined-by edge
        numberOfCalls:               0,  // no calls
        numberOfFunctionDefinitions: 0   // no definitions
      }, statInfo)

      assert.strictEqual(stats.perSliceMeasurements.numberOfSlices, 1, `sliced only once ${statInfo}`)

      assert.deepStrictEqual(stats.perSliceMeasurements.sliceSize, {
        // only one entry
        normalizedTokens: { min: 4, max: 4, median: 4, mean: 4, std: 0 },
        characters:       { min: 6, max: 6, median: 6, mean: 6, std: 0 },
        dataflowNodes:    { min: 2, max: 2, median: 2, mean: 2, std: 0 },
        tokens:           { min: 6, max: 6, median: 6, mean: 6, std: 0 },
        lines:            { min: 1, max: 1, median: 1, mean: 1, std: 0 },
        autoSelected:     { min: 0, max: 0, median: 0, mean: 0, std: 0 }
      }, `sliced only once ${statInfo}`)

      assert.deepStrictEqual(stats.perSliceMeasurements.sliceCriteriaSizes, {
        min:    1,
        max:    1,
        median: 1,
        mean:   1,
        std:    0
      })

    })
    it('Slicing the same code three times', async() => {
      const slicer = new BenchmarkSlicer()
      const request = {
        request: 'text' as const,
        content: `library(x)
a <- 3
b <- a + 4
c <- 5
d <- b + 5
cat(c, d)
cat(d)`
      }
      await slicer.init(request)
      slicer.slice('2@a')
      slicer.slice('2@a', '4@c')
      slicer.slice('7@d')
      const { stats, statInfo } = await retrieveStatsSafe(slicer, request)

      // TODO: test more?

      assert.deepStrictEqual(stats.input, {
        numberOfLines:            7,
        numberOfCharacters:       63,
        // checked manually
        numberOfRTokens:          56,
        numberOfNormalizedTokens: 31
      }, statInfo)
      assert.deepStrictEqual(stats.dataflow, {
        numberOfNodes:               17,
        numberOfEdges:               19,
        numberOfCalls:               3,
        numberOfFunctionDefinitions: 0
      }, statInfo)

      assert.strictEqual(stats.perSliceMeasurements.numberOfSlices, 3, `sliced three times ${statInfo}`)

      assert.deepStrictEqual(stats.perSliceMeasurements.sliceSize, {
        // only one entry
        lines:            { min: 2,  max: 5,  median: 3,  mean: (2+3+5)/3,   std: 1.247219128924647  },
        characters:       { min: 17, max: 46, median: 24, mean: 29,          std: 12.355835328567093 },
        tokens:           { min: 13, max: 40, median: 19, mean: 24,          std: 11.575836902790225 },
        normalizedTokens: { min: 8,  max: 22, median: 11, mean: (8+11+22)/3, std: 6.018490028422596  },
        dataflowNodes:    { min: 1,  max: 7,  median: 2,  mean: (1+2+7)/3,   std: 2.6246692913372702 },
        autoSelected:     { min: 1,  max: 1,  median: 1,  mean: 1,           std: 0  } // always select one library statement
      }, statInfo)

      assert.deepStrictEqual(stats.perSliceMeasurements.sliceCriteriaSizes, {
        min:    1,
        max:    2,
        median: 1,
        mean:   (1+2+1)/3,
        std:    0.4714045207910317
      }, statInfo)

    })
  })
})
