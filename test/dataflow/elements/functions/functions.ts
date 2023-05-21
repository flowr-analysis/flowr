import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, LocalScope } from '../../../../src/dataflow'

// TODO: <- in parameters
// TODO: allow to access environments in the end
// TODO: nodes for anonymous functions
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
  describe('Scoping of body', () => {
    assertDataflow(`previously defined read in function`, shell, `x <- 3; function() { x }`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("3", "x")
        .addEdge("3", "0", "read", "maybe")
    )
    assertDataflow(`local define in function, read after`, shell, `function() { x <- 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("3", "x")
    )
  })
  describe('Scoping of parameters', () => {

  })
}))
