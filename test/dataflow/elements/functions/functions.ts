import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, LocalScope } from '../../../../src/dataflow'

describe('Functions', withShell(shell => {
  describe('Only Functions', () => {
    assertDataflow(`unknown read in function`, shell, `function() { x }`,
      new DataflowGraph()
        .addNode("0", "x")
    )
    assertDataflow(`read of parameter`, shell, `function(x) { x }`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("1", "x")
        .addEdge("1", "0", "read", "always")
    )
  })
}))
