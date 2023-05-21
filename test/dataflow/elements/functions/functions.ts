import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, LocalScope } from '../../../../src/dataflow'

// TODO: <- in parameters
describe('Functions', withShell(shell => {
  describe('Only Functions', () => {
    assertDataflow(`unknown read in function`, shell, `function() { x }`,
      new DataflowGraph()
        .addNode("0", "x")
    )
    assertDataflow(`read of parameter`, shell, `function(x) { x }`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("2", "x")
        .addEdge("2", "0", "read", "always")
    )
    assertDataflow(`read of one parameter`, shell, `function(x,y,z) y`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("2", "y", LocalScope)
        .addNode("4", "z", LocalScope)
        .addNode("6", "y")
        .addEdge("6", "2", "read", "always")
    )
  })
}))
