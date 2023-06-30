import { Slicer } from '../../src/benchmark/slicer'
import { stats2string } from '../../src/benchmark/print'

describe("The Benchmark Slicer", () => {
  describe('Stats by parsing text-based inputs', () => {
    it('Simple slice for simple line', async() => {
      const slicer = new Slicer()
      await slicer.init({ request: 'text', content: 'a <- 1' })
      slicer.slice('1@a')
      const stats = slicer.finish()
      console.log(stats2string(stats))
    })
  })
})
