import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, GlobalScope, LocalScope } from '../../../../src/dataflow'

// TODO: <- in parameters
// TODO: allow to access environments in the end
// TODO: nodes for anonymous functions
// TODO: new mode, do not make everything 'maybe' within a function
describe('Functions', withShell(shell => {
  describe('Only Functions', () => {
    assertDataflow(`unknown read in function`, shell, `function() { x }`,
      new DataflowGraph()
        .addNode("0", "x", false, 'maybe')
    )
    assertDataflow(`read of parameter`, shell, `function(x) { x }`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope, 'maybe')
        .addNode("2", "x", false, 'maybe')
        .addEdge("2", "0", "read", "always")
    )
    assertDataflow(`read of one parameter`, shell, `function(x,y,z) y`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope, 'maybe')
        .addNode("2", "y", LocalScope, 'maybe')
        .addNode("4", "z", LocalScope, 'maybe')
        .addNode("6", "y", false, 'maybe')
        .addEdge("6", "2", "read", "always")
    )
  })
  describe('Scoping of body', () => {
    assertDataflow(`previously defined read in function`, shell, `x <- 3; function() { x }`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("3", "x", false, 'maybe')
        .addEdge("3", "0", "read", "maybe")
    )
    assertDataflow(`local define with <- in function, read after`, shell, `function() { x <- 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope, 'maybe')
        .addNode("4", "x")
    )
    assertDataflow(`local define with = in function, read after`, shell, `function() { x = 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope, 'maybe')
        .addNode("4", "x")
    )
    assertDataflow(`local define with -> in function, read after`, shell, `function() { 3 -> x; }; x`,
      new DataflowGraph()
        .addNode("1", "x", LocalScope, 'maybe')
        .addNode("4", "x")
    )
    assertDataflow(`global define with <<- in function, read after`, shell, `function() { x <<- 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", GlobalScope, 'maybe')
        .addNode("4", "x")
        /* can be shown as a global link as well, as it is not the local instance of x which survives */
        .addEdge("4", "0", "read", "maybe")
    )
    assertDataflow(`global define with ->> in function, read after`, shell, `function() { 3 ->> x; }; x`,
      new DataflowGraph()
        .addNode("1", "x", GlobalScope, 'maybe')
        .addNode("4", "x")
        .addEdge("4", "1", "read", "maybe")
    )
    assertDataflow(`shadow in body`, shell, `x <- 2; function() { x <- 3; x }; x`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("3", "x", LocalScope, 'maybe')
        .addNode("6", "x", false, 'maybe')
        .addNode("9", "x")
        .addEdge("6", "3", "read", "always")
        .addEdge("9", "0", "read", "always")
    )
    assertDataflow(`shadow in body with closure`, shell, `x <- 2; function() { x <- x; x }; x`,
      new DataflowGraph()
        .addNode("0", "x", LocalScope)
        .addNode("3", "x", LocalScope, 'maybe')
        .addNode("4", "x", false, 'maybe')
        .addNode("6", "x", false, 'maybe')
        .addNode("9", "x")
        .addEdge("6", "3", "read", "always")
        .addEdge("3", "4", "defined-by", "always")
        .addEdge("4", "0", "read", "maybe")
        .addEdge("9", "0", "read", "always")
    )
  })
  describe('Scoping of parameters', () => {
    // TODO: scoping within parameters
  })
}))
