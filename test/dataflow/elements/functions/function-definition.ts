import { assertDataflow, withShell } from '../../../helper/shell'
import { BuiltIn, DataflowGraph, GlobalScope, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define, pushLocalEnvironment } from '../../../../src/dataflow/environments'

// TODO: <- in parameters
// TODO: allow to access environments in the end
describe('Function Definition', withShell(shell => {
  describe('Only Functions', () => {
    assertDataflow(`unknown read in function`, shell, `function() { x }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         "1",
          name:       "1",
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['0'],
          subflow:    {
            out:         [ /* TODO: exit points in the far future */],
            activeNodes: [],
            in:          [{ nodeId: "0", used: 'always', name: 'x', scope: LocalScope }],
            scope:       LocalScope,
            graph:       new DataflowGraph().addNode({
              tag:         'use',
              id:          "0",
              name:        "x",
              environment: pushLocalEnvironment(initializeCleanEnvironments()),
              when:        'always'
            }),
            environments: pushLocalEnvironment(initializeCleanEnvironments())
          }
        })
    )
    const envWithXDefined = define(
      { nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`read of parameter`, shell, `function(x) { x }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         "3",
          name:       "3",
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['2'],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({
                tag:         'variable-definition',
                id:          "0",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                scope:       LocalScope,
                when:        'always'
              })
              .addNode({
                tag:         'use',
                id:          "2",
                name:        "x",
                environment: envWithXDefined,
                when:        'always'
              })
              .addEdge("2", "0", "read", "always"),
            environments: envWithXDefined
          }
        })
    )
    assertDataflow(`read of parameter in return`, shell, `function(x) { return(x) }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         "5",
          name:       "5",
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['4'],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({
                tag:         'variable-definition',
                id:          "0",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                scope:       LocalScope,
                when:        'always'
              })
              .addNode({
                tag:         'use',
                id:          "3",
                name:        "x",
                environment: envWithXDefined,
                when:        'always'
              })
              .addNode({
                tag:         'function-call',
                id:          "4",
                name:        'return',
                environment: envWithXDefined,
                when:        'always',
                args:        [{ nodeId: "3", used: 'always', name: 'x', scope: LocalScope }]
              })
              .addNode({
                tag:         'use',
                id:          "2",
                name:        'return',
                environment: envWithXDefined,
                when:        'always',
              })
              .addEdge("4", "2", "read", "always")
              .addEdge("3", "0", "read", "always")
              .addEdge("4", "3", "argument", "always")
              .addEdge("2", BuiltIn, 'read', 'always'),
            environments: envWithXDefined
          }
        })
    )

    const envWithoutParams = pushLocalEnvironment(initializeCleanEnvironments())
    const envWithXParam = define(
      { nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
      LocalScope,
      envWithoutParams
    )
    const envWithXYParam = define(
      { nodeId: '2', scope: 'local', name: 'y', used: 'always', kind: 'parameter', definedAt: '3' },
      LocalScope,
      envWithXParam
    )
    const envWithXYZParam = define(
      { nodeId: '4', scope: 'local', name: 'z', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      envWithXYParam
    )

    assertDataflow(`read of one parameter`, shell, `function(x,y,z) y`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         "7",
          name:       "7",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '6' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: envWithoutParams, scope: LocalScope, when: 'always' })
              .addNode({ tag: 'variable-definition', id: "2", name: "y", environment: envWithXParam, scope: LocalScope, when: 'always' })
              .addNode({ tag: 'variable-definition', id: "4", name: "z", environment: envWithXYParam, scope: LocalScope, when: 'always' })
              .addNode( { tag: 'use', id: "6", name: "y", environment: envWithXYZParam, when: 'always' })
              .addEdge("6", "2", "read", "always"),
            environments: envWithXYZParam
          }
        })
    )
  })
  describe('Scoping of body', () => {
    assertDataflow(`previously defined read in function`, shell, `x <- 3; function() { x }`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode({
          tag:        'function-definition',
          id:         "4",
          name:       "4",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '3' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [ { nodeId: "3", scope: LocalScope, name: "x", used: "always" } ],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode( { tag: 'use', id: "3", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), when: 'always' }),
            environments: pushLocalEnvironment(initializeCleanEnvironments())
          }
        })
    )
    const envWithXDefined = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))

    assertDataflow(`local define with <- in function, read after`, shell, `function() { x <- 3; }; x`,
      new DataflowGraph()
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         '3',
          name:       '3',
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2' /* the assignment */ ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }),
            environments: envWithXDefined
          }
        })
    )
    assertDataflow(`local define with = in function, read after`, shell, `function() { x = 3; }; x`,
      new DataflowGraph()
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         "3",
          name:       "3",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2', ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }),
            environments: envWithXDefined
          }
        })
    )

    const envWithXDefinedR = define(
      {nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`local define with -> in function, read after`, shell, `function() { 3 -> x; }; x`,
      new DataflowGraph()
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         "3",
          name:       "3",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "1", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }),
            environments: envWithXDefinedR
          }
        })
    )
    const envWithXDefinedGlobal = define(
      {nodeId: '0', scope: GlobalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
      GlobalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`global define with <<- in function, read after`, shell, `function() { x <<- 3; }; x`,
      new DataflowGraph()
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         "3",
          name:       "3",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: GlobalScope, when: 'always' }),
            environments: envWithXDefinedGlobal
          }
        })
    )
    const envWithXDefinedGlobalR = define(
      {nodeId: '1', scope: GlobalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
      GlobalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`global define with ->> in function, read after`, shell, `function() { 3 ->> x; }; x`,
      new DataflowGraph()
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         "3",
          name:       "3",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "1", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: GlobalScope, when: 'always' }),
            environments: envWithXDefinedGlobalR
          }
        })
    )
    const envDefXSingle = define(
      {nodeId: '3', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '5' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`shadow in body`, shell, `x <- 2; function() { x <- 3; x }; x`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode({ tag: 'use', id: "9", name: "x" })  /* TODO: this should probably be defined by 0 in env */
        .addEdge("9", "0", "read", "always")
        .addNode({
          tag:        'function-definition',
          id:         "8",
          name:       "8",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '6' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({
                tag:         'use',
                id:          "6",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                when:        'always'
              })
              .addNode({
                tag:         'variable-definition',
                id:          "3",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                scope:       LocalScope,
                when:        'always'
              })
              .addEdge("6", "3", "read", "always"),
            environments: envDefXSingle
          }
        })
    )
    assertDataflow(`shadow in body with closure`, shell, `x <- 2; function() { x <- x; x }; x`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode({ tag: 'use', id: "9", name: "x" })
        .addEdge("9", "0", "read", "always")
        .addNode({
          tag:        'function-definition',
          id:         "8",
          name:       "8",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '6' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({
                tag:         'use',
                id:          "6",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                when:        'always'
              })
              .addNode({
                tag:         'variable-definition',
                id:          "3",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                scope:       LocalScope,
                when:        'always'
              })
              .addNode({
                tag:         'use',
                id:          "4",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                when:        'always'
              })
              .addEdge("6", "3", "read", "always")
              .addEdge("3", "4", "defined-by", "always"),
            environments: envDefXSingle
          }
        })
    )
  })
  describe('Scoping of parameters', () => {
    const envWithXDefined = define(
      {nodeId: '3', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '4' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`parameter shadows`, shell, `x <- 3; function(x) { x }`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode({
          tag:        'function-definition',
          id:         "6",
          name:       "6",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '5' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "3", name: "x", environment: envWithXDefined, scope: LocalScope, when: 'always' })
              .addNode({
                tag:         'use',
                id:          "5",
                name:        "x",
                environment: envWithXDefined,
                when:        'always'
              })
              .addEdge("5", "3", "read", "always"),
            environments: envWithXDefined
          }
        })
    )
    // TODO: other tests for scoping within parameters
  })
  describe('Late binding of environment variables', () => {
    assertDataflow(`define after function definition`, shell, `function() { x }; x <- 3`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "2", name: "x", scope: LocalScope })
        .addNode({
          tag:        'function-definition',
          id:         "1",
          name:       "1",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '0' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [{
              nodeId: '0',
              scope:  LocalScope,
              name:   'x',
              used:   'always'
            }],
            scope: LocalScope,
            graph: new DataflowGraph()
              .addNode({
                tag:         'use',
                id:          "0",
                name:        "x",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                when:        'always'
              }),
            environments: pushLocalEnvironment(initializeCleanEnvironments())
          }
        })
    )
  })

  /* TODO: make it work with a() call at the end */
  describe('Nested Function Definitions', () => {
    const withXParameterInOuter = define(
      {nodeId: '1', scope: LocalScope, name: 'x', used: 'always', kind: 'function', definedAt: '8' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    const withinNestedFunctionWithParam = define(
      {nodeId: '2', scope: LocalScope, name: 'x', used: 'always', kind: 'parameter', definedAt: '3' },
      LocalScope,
      pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))
    )
    const withinNestedFunctionWithDef = define(
      {nodeId: '4', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '6' },
      LocalScope,
      pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))
    )
    assertDataflow(`double nested functions`, shell, `a <- function() { x <- function(x) { x <- b }; x }; b <- 3; a`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "a", scope: LocalScope })
        .addNode( { tag: 'variable-definition', id: "13", name: "b", scope: LocalScope })
        .addNode( { tag: 'use', id: "16", name: "a" })
        .addEdge("16", "0", "read", "always")
        .addNode({
          tag:        'function-definition',
          id:         "11",
          name:       "11",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '9' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'use', id: "9", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'variable-definition', id: "1", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' })
              .addNode({
                tag:         'function-definition',
                id:          "7",
                name:        "7",
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                scope:       LocalScope,
                when:        'always',
                exitPoints:  [ '6' ],
                subflow:     {
                  out:         [],
                  activeNodes: [],
                  in:          [{
                    nodeId: '5',
                    scope:  LocalScope,
                    name:   'x',
                    used:   'always'
                  }],
                  scope: LocalScope,
                  graph: new DataflowGraph()
                    .addNode({ tag: 'use', id: "5", name: "b", environment: withinNestedFunctionWithParam })
                    .addNode({ tag: 'variable-definition', id: "4", name: "x", environment: withinNestedFunctionWithParam, scope: LocalScope, when: 'always' })
                    .addNode({ tag: 'variable-definition', id: "2", name: "x", environment: withinNestedFunctionWithParam, scope: LocalScope, when: 'always' })
                    .addEdge("4", "5", "defined-by", "always")
                    .addEdge("2", "4", 'same-def-def', 'always'),
                  environments: withinNestedFunctionWithDef
                }
              })
              .addEdge("9", "1", "read", "always")
              .addEdge("1", "7", "defined-by", "always"),
            environments: withXParameterInOuter
          }
        })
        .addEdge("0", "11", "defined-by", "always")
    )
  })
  // TODO: named parameters
  // TODO: tests for nested functions
}))
