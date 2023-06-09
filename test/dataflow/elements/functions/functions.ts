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
        .addNode("1", "1", initializeCleanEnvironments(), LocalScope, 'always', {
          out:          [ /* TODO: exit points in the far future */ ],
          activeNodes:  [],
          in:           [ { nodeId: "0", used: 'always', name: 'x', scope: LocalScope } ],
          scope:        LocalScope,
          graph:        new DataflowGraph().addNode("0", "x", pushLocalEnvironment(initializeCleanEnvironments()), false, 'always'),
          environments: pushLocalEnvironment(initializeCleanEnvironments())
        })
    )
    const envWithXDefined = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'argument', definedAt: '1' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`read of parameter`, shell, `function(x) { x }`,
      new DataflowGraph()
        .addNode("3", "3", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("0", "x", envWithXDefined, LocalScope, 'always')
            .addNode("2", "x", envWithXDefined, false, 'always')
            .addEdge("2", "0", "read", "always"),
          environments: envWithXDefined
        })
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
        .addNode("7", "7", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("0", "x", envWithParams, LocalScope, 'always')
            .addNode("2", "y", envWithParams, LocalScope, 'always')
            .addNode("4", "z", envWithParams, LocalScope, 'always')
            .addNode("6", "y", envWithParams, false, 'always')
            .addEdge("6", "2", "read", "always"),
          environments: envWithParams
        })
    )
  })
  describe('Scoping of body', () => {
    assertDataflow(`previously defined read in function`, shell, `x <- 3; function() { x }`,
      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
        .addNode("4", "4", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [ { nodeId: "3", scope: LocalScope, name: "x", used: "always" } ],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("3", "x", pushLocalEnvironment(initializeCleanEnvironments()), false, 'always'),
          environments: pushLocalEnvironment(initializeCleanEnvironments())
        })
    )
    const envWithXDefined = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))

    assertDataflow(`local define with <- in function, read after`, shell, `function() { x <- 3; }; x`,
      new DataflowGraph()
        .addNode("4", "x", initializeCleanEnvironments())
        .addNode("3", "3", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("0", "x", pushLocalEnvironment(initializeCleanEnvironments()), LocalScope, 'always'),
          environments: envWithXDefined
        })
    )
    assertDataflow(`local define with = in function, read after`, shell, `function() { x = 3; }; x`,
      new DataflowGraph()
        .addNode("4", "x", initializeCleanEnvironments())
        .addNode("3", "3", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("0", "x", pushLocalEnvironment(initializeCleanEnvironments()), LocalScope, 'always'),
          environments: envWithXDefined
        })
    )

    const envWithXDefinedR = define(
      {nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`local define with -> in function, read after`, shell, `function() { 3 -> x; }; x`,
      new DataflowGraph()
        .addNode("4", "x", initializeCleanEnvironments())
        .addNode("3", "3", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("1", "x", pushLocalEnvironment(initializeCleanEnvironments()), LocalScope, 'always'),
          environments: envWithXDefinedR
        })
    )
    assertDataflow(`global define with <<- in function, read after`, shell, `function() { x <<- 3; }; x`,
      new DataflowGraph()
        .addNode("4", "x", initializeCleanEnvironments())
        .addNode("3", "3", initializeCleanEnvironments(), LocalScope, 'always', {
          out:         [],
          activeNodes: [],
          in:          [],
          scope:       LocalScope,
          graph:       new DataflowGraph()
            .addNode("1", "x", pushLocalEnvironment(initializeCleanEnvironments()), LocalScope, 'always'),
          environments: envWithXDefinedR
        })
      /*      new DataflowGraph()
        .addNode("0", "x", initializeCleanEnvironments(), GlobalScope, 'maybe')
        .addNode("4", "x", initializeCleanEnvironments())
        /!* can be shown as a global link as well, as it is not the local instance of x which survives *!/
        .addEdge("4", "0", "read", "maybe")*/
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
