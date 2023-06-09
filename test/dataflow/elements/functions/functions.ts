import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, GlobalScope, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define, pushLocalEnvironment } from '../../../../src/dataflow/environments'

// TODO: <- in parameters
// TODO: allow to access environments in the end
// TODO: nodes for anonymous functions
// TODO: new mode, do not make everything 'maybe' within a function
describe('Functions', withShell(shell => {
  describe('Only Functions', () => {
    assertDataflow(`unknown read in function`, shell, `function() { x }`,
      new DataflowGraph()
        .addNode("0", "x", pushLocalEnvironment(initializeCleanEnvironments()), false, 'maybe')
    )
    const envWithXDefined = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'argument', definedAt: '1' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`read of parameter`, shell, `function(x) { x }`,
      new DataflowGraph()
        .addNode("0", "x", envWithXDefined, LocalScope, 'maybe')
        .addNode("2", "x", envWithXDefined, false, 'maybe')
        .addEdge("2", "0", "read", "always")
    )
    const envWithParams = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'argument', definedAt: '1' },
      LocalScope,
      define(
        {nodeId: '2', scope: 'local', name: 'y', used: 'always', kind: 'argument', definedAt: '3' },
        LocalScope,
        define(
          {nodeId: '4', scope: 'local', name: 'z', used: 'always', kind: 'argument', definedAt: '5' },
          LocalScope,
          pushLocalEnvironment(initializeCleanEnvironments()))))

    assertDataflow(`read of one parameter`, shell, `function(x,y,z) y`,
      new DataflowGraph()
        .addNode("0", "x", envWithParams, LocalScope, 'maybe')
        .addNode("2", "y", envWithParams, LocalScope, 'maybe')
        .addNode("4", "z", envWithParams, LocalScope, 'maybe')
        .addNode("6", "y", envWithParams, false, 'maybe')
        .addEdge("6", "2", "read", "always")
    )
  })
  describe('Scoping of body', () => {
    const xPrevDefined = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'argument', definedAt: '1' },
      LocalScope,
      initializeCleanEnvironments())

    assertDataflow(`previously defined read in function`, shell, `x <- 3; function() { x }`,
      new DataflowGraph()
        .addNode("0", "x", xPrevDefined, LocalScope)
        .addNode("3", "x", pushLocalEnvironment(xPrevDefined), false, 'maybe')
        .addEdge("3", "0", "read", "maybe")
    )
    assertDataflow(`local define with <- in function, read after`, shell, `function() { x <- 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments())
    )
    assertDataflow(`local define with = in function, read after`, shell, `function() { x = 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments())
    )
    assertDataflow(`local define with -> in function, read after`, shell, `function() { 3 -> x; }; x`,
      new DataflowGraph()
        .addNode("1", "x", initializeCleanEnvironments(), LocalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments())
    )
    assertDataflow(`global define with <<- in function, read after`, shell, `function() { x <<- 3; }; x`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), GlobalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments())
        /* can be shown as a global link as well, as it is not the local instance of x which survives */
        .addEdge("4", "0", "read", "maybe")
    )
    assertDataflow(`global define with ->> in function, read after`, shell, `function() { 3 ->> x; }; x`,
      new DataflowGraph()
        .addNode("1", "x", initializeCleanEnvironments(), GlobalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments())
        .addEdge("4", "1", "read", "maybe")
    )
    assertDataflow(`shadow in body`, shell, `x <- 2; function() { x <- 3; x }; x`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
        .addNode("3", "x", initializeCleanEnvironments(), LocalScope, 'maybe')
        .addNode("6", "x", initializeCleanEnvironments(), false, 'maybe')
        .addNode("9", "x", initializeCleanEnvironments())
        .addEdge("6", "3", "read", "always")
        .addEdge("9", "0", "read", "always")
    )
    assertDataflow(`shadow in body with closure`, shell, `x <- 2; function() { x <- x; x }; x`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
        .addNode("3", "x", initializeCleanEnvironments(), LocalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments(), false, 'maybe')
        .addNode("6", "x", initializeCleanEnvironments(), false, 'maybe')
        .addNode("9", "x", initializeCleanEnvironments())
        .addEdge("6", "3", "read", "always")
        .addEdge("3", "4", "defined-by", "always")
        .addEdge("4", "0", "read", "maybe")
        .addEdge("9", "0", "read", "always")
    )
  })
  describe('Scoping of parameters', () => {
    assertDataflow(`parameter shadows`, shell, `x <- 3; function(x) { x }`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
        .addNode("3", "x", initializeCleanEnvironments(), LocalScope, 'maybe')
        .addNode("5", "x", initializeCleanEnvironments(), false, 'maybe')
        .addEdge("5", "3", "read", "always")
    )
    // TODO: other tests for scoping within parameters
  })
  describe('Late binding of environment variables', () => {
    assertDataflow(`define after function definition`, shell, `function() { x }; x <- 3`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
        .addNode("3", "x", initializeCleanEnvironments(), false, 'maybe')
        .addEdge("3", "0", "read", "maybe")
    )

  })

  // TODO: named parameters
  // TODO: tests for nested functions
}))
