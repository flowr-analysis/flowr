import { assertDataflow, withShell } from '../../../helper/shell'
import { BuiltIn, DataflowGraph, GlobalScope, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define, popLocalEnvironment, pushLocalEnvironment } from '../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../src/dataflow/internal/process/functions/argument'

// TODO: <- in parameters
// TODO: allow to access environments in the end
describe('Function Definition', withShell(shell => {
  describe('Only functions', () => {
    assertDataflow(`unknown read in function`, shell, `function() { x }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         "2",
          name:       "2",
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['0'],
          subflow:    {
            out:         [],
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
          id:         "4",
          name:       "4",
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
          id:         "7",
          name:       "7",
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['5'],
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
                id:          "5",
                name:        'return',
                environment: envWithXDefined,
                when:        'always',
                args:        [{ nodeId: "4", used: 'always', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope }]
              })
              .addNode({
                tag:         'use',
                id:          "4",
                name:        `${UnnamedArgumentPrefix}4`,
                environment: envWithXDefined,
                when:        'always',
              })
              .addEdge("5", BuiltIn, "read", "always")
              .addEdge("5", BuiltIn, "calls", "always")
              .addEdge("3", "0", "read", "always")
              .addEdge("5", "4", "argument", "always")
              .addEdge("5", "4", "returns", "always")
              .addEdge("4", "3", "read", "always"),
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
          id:         "5",
          name:       "5",
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
        .addNode( { tag: 'use', id: "5", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         '4',
          name:       '4',
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2' /* the assignment */ ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' })
              .addNode({ tag: 'exit-point', id: '2', name: '<-', when: 'always', environment: envWithXDefined })
              .addEdge("2", "0", "relates", "always"),
            environments: envWithXDefined
          }
        })
    )
    assertDataflow(`local define with = in function, read after`, shell, `function() { x = 3; }; x`,
      new DataflowGraph()
        .addNode( { tag: 'use', id: "5", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         "4",
          name:       "4",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2', ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' })
              .addNode({ tag: 'exit-point', id: '2', name: '=', when: 'always', environment: envWithXDefined })
              .addEdge("2", "0", "relates", "always"),
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
        .addNode( { tag: 'use', id: "5", name: "x" })
        .addNode({
          tag:        'function-definition',
          id:         "4",
          name:       "4",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '2' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "1", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' })
              .addNode({ tag: 'exit-point', id: '2', name: '->', when: 'always', environment: envWithXDefinedR })
              .addEdge("2", "1", "relates", "always"),
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
        .addNode( { tag: 'use', id: "5", name: "x" })
        .addNode({
          tag:         'function-definition',
          id:          "4",
          name:        "4",
          scope:       LocalScope,
          when:        'always',
          exitPoints:  [ '2' ],
          environment: popLocalEnvironment(envWithXDefinedGlobal),
          subflow:     {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "0", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: GlobalScope, when: 'always' })
              .addNode({ tag: 'exit-point', id: '2', name: '<<-', when: 'always', environment: envWithXDefinedGlobal })
              .addEdge("2", "0", "relates", "always"),
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
        .addNode( { tag: 'use', id: "5", name: "x" })
        .addNode({
          tag:         'function-definition',
          id:          "4",
          name:        "4",
          scope:       LocalScope,
          when:        'always',
          exitPoints:  [ '2' ],
          environment: popLocalEnvironment(envWithXDefinedGlobalR),
          subflow:     {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "1", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: GlobalScope, when: 'always' })
              .addNode({ tag: 'exit-point', id: '2', name: '->>', when: 'always', environment: envWithXDefinedGlobalR })
              .addEdge("2", "1", "relates", "always"),
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
        .addNode({
          tag:         'use',
          id:          "9",
          name:        "x",
          environment: define({
            nodeId:    '0',
            definedAt: '2',
            used:      'always',
            name:      'x',
            scope:     LocalScope,
            kind:      'variable'
          }, LocalScope, initializeCleanEnvironments())
        })
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
                environment: define({ nodeId: '3', definedAt: '5', used: 'always', name: 'x', scope: LocalScope, kind: 'variable'}, LocalScope, pushLocalEnvironment(initializeCleanEnvironments())),
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
        .addNode({
          tag:         'use',
          id:          "9",
          name:        "x",
          environment: define(
            { nodeId: '0', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
            LocalScope,
            initializeCleanEnvironments())
        })
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
            in:          [ { nodeId: '4', used: 'always', name: 'x', scope: LocalScope} ],
            scope:       LocalScope,
            graph:       new DataflowGraph()
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
              .addNode({
                tag:         'use',
                id:          "6",
                name:        "x",
                environment: define({
                  nodeId:    '3',
                  scope:     LocalScope,
                  name:      'x',
                  used:      'always',
                  kind:      'variable',
                  definedAt: '5'
                }, LocalScope, pushLocalEnvironment(initializeCleanEnvironments())),
                when: 'always'
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
          id:         "7",
          name:       "7",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '5' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: "3", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' })
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
  describe('Using named arguments', () => {
    const envWithA = define(
      { nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'parameter', definedAt: '2' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments())
    )
    const envWithAB = define(
      { nodeId: '3', scope: LocalScope, name: 'b', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      envWithA
    )
    assertDataflow(`Read first parameter`, shell, `function(a=3, b=a) { b }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         '8',
          name:       '8',
          exitPoints: ['6'],
          scope:      LocalScope,
          when:       'always',
          subflow:    {
            out:          [],
            activeNodes:  [],
            in:           [],
            scope:        LocalScope,
            environments: envWithAB,
            graph:        new DataflowGraph()
              .addNode({
                tag:         'variable-definition',
                id:          '0',
                name:        'a',
                environment: pushLocalEnvironment(initializeCleanEnvironments()),
                scope:       LocalScope,
                when:        'always'
              })
              .addNode({
                tag:         'variable-definition',
                id:          '3',
                name:        'b',
                environment: envWithA,
                scope:       LocalScope,
                when:        'always'
              })
              .addNode({ tag: 'use', id: '4', name: 'a', environment: envWithA, when: 'always' })
              .addNode({ tag: 'use', id: '6', name: 'b', environment: envWithAB, when: 'always' })
              .addEdge('4', '0', 'read', 'always')
              .addEdge('3', '4', 'defined-by', 'maybe' /* default values can be overridden */)
              .addEdge('6', '3', 'read', 'always')
          }
        })
    )

    const envWithFirstParam = define(
      { nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'parameter', definedAt: '2' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments())
    )
    const envWithBothParam = define(
      { nodeId: '3', scope: LocalScope, name: 'm', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      envWithFirstParam
    )
    const envWithBothParamFirstB = define(
      { nodeId: '6', scope: LocalScope, name: 'b', used: 'always', kind: 'variable', definedAt: '8' },
      LocalScope,
      envWithBothParam
    )
    const envWithBothParamSecondB = define(
      { nodeId: '10', scope: LocalScope, name: 'b', used: 'always', kind: 'variable', definedAt: '12' },
      LocalScope,
      envWithBothParam
    )
    assertDataflow(`Read later definition`, shell, `function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         '17',
          name:       '17',
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['15'],
          subflow:    {
            out:          [],
            activeNodes:  [],
            in:           [],
            scope:        LocalScope,
            environments: envWithBothParamSecondB,
            graph:        new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'variable-definition', id: '3', name: 'm', scope: LocalScope, when: 'always', environment: envWithFirstParam })
              .addNode({ tag: 'variable-definition', id: '10', name: 'b', scope: LocalScope, when: 'always', environment: envWithBothParamFirstB })
              .addNode({ tag: 'variable-definition', id: '6', name: 'b', scope: LocalScope, when: 'always', environment: envWithBothParam })
              .addNode({ tag: 'use', id: '1', name: 'b', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'use', id: '9', name: 'a', scope: LocalScope, when: 'always', environment: envWithBothParamFirstB })
              .addNode({ tag: 'use', id: '13', name: 'a', scope: LocalScope, when: 'always', environment: envWithBothParamSecondB })
              .addNode({ tag: 'exit-point', id: '15', name: '+', scope: LocalScope, when: 'always', environment: envWithBothParamSecondB })
              .addEdge('15', '13', 'relates', 'always')
              .addEdge('13', '9', 'same-read-read', 'always')
              .addEdge('9', '0', 'read', 'always')
              .addEdge('13', '0', 'read', 'always')
              .addEdge('0', '1', 'defined-by', 'maybe')
              .addEdge('1', '6', 'read', 'always')
              .addEdge('10', '6', 'same-def-def', 'always')
          }
        })
    )
  })
  describe('Using special argument', () => {
    const envWithA = define(
      { nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'parameter', definedAt: '1' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments())
    )
    const envWithASpecial = define(
      { nodeId: '2', scope: LocalScope, name: '...', used: 'always', kind: 'parameter', definedAt: '3' },
      LocalScope,
      envWithA
    )
    assertDataflow(`Return ...`, shell, `function(a, ...) { foo(...) }`,
      new DataflowGraph()
        .addNode({
          tag:        'function-definition',
          id:         "9",
          name:       "9",
          scope:      LocalScope,
          when:       'always',
          exitPoints: ['7'],
          subflow:    {
            out:          [],
            activeNodes:  [],
            in:           [],
            scope:        LocalScope,
            environments: envWithASpecial,
            graph:        new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'variable-definition', id: '2', name: '...', scope: LocalScope, when: 'always', environment: envWithA })
              .addNode({ tag: 'use', id: '5', name: '...', scope: LocalScope, when: 'always', environment: envWithASpecial })
              .addNode({
                tag:         'function-call',
                id:          '7', name:        'foo',
                scope:       LocalScope,
                when:        'always',
                environment: envWithASpecial,
                args:        [ { nodeId: '6', name: `${UnnamedArgumentPrefix}6`, scope: LocalScope, used: 'always'  } ]
              })
              .addNode({ tag: 'use', id: '6', name: `${UnnamedArgumentPrefix}6`, when: 'always', environment: envWithASpecial })
              .addEdge('7', '6', 'argument', 'always')
              .addEdge('6', '5', 'read', 'always')
              .addEdge('5', '2', 'read', 'always')
          }
        })
    )
  })
  describe('Late binding of environment variables', () => {
    assertDataflow(`define after function definition`, shell, `function() { x }; x <- 3`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "3", name: "x", scope: LocalScope })
        .addNode({
          tag:        'function-definition',
          id:         "2",
          name:       "2",
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

  describe('Nested Function Definitions', () => {
    const withXParameterInOuter = define(
      {nodeId: '1', scope: LocalScope, name: 'x', used: 'always', kind: 'function', definedAt: '9' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    const withinNestedFunctionWithoutParam = pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))
    const withinNestedFunctionWithParam = define(
      {nodeId: '2', scope: LocalScope, name: 'x', used: 'always', kind: 'parameter', definedAt: '3' },
      LocalScope,
      withinNestedFunctionWithoutParam
    )
    const withinNestedFunctionWithDef = define(
      {nodeId: '4', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '6' },
      LocalScope,
      pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))
    )
    const envWithA = define(
      { nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'function', definedAt: '13' },
      LocalScope,
      initializeCleanEnvironments()
    )
    const envWithAB = define(
      { nodeId: '14', scope: LocalScope, name: 'b', used: 'always', kind: 'variable', definedAt: '16' },
      LocalScope,
      envWithA
    )
    assertDataflow(`double nested functions`, shell, `a <- function() { x <- function(x) { x <- b }; x }; b <- 3; a`,
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "a", scope: LocalScope })
        .addNode( {
          tag:         'variable-definition',
          id:          "14",
          name:        "b",
          scope:       LocalScope,
          environment: envWithA
        })
        .addNode( { tag: 'use', id: "17", name: "a", environment: envWithAB })
        .addEdge("17", "0", "read", "always")
        .addNode({
          tag:        'function-definition',
          id:         "12",
          name:       "12",
          scope:      LocalScope,
          when:       'always',
          exitPoints: [ '10' ],
          subflow:    {
            out:         [],
            activeNodes: [],
            in:          [],
            scope:       LocalScope,
            graph:       new DataflowGraph()
              .addNode({ tag: 'use', id: "10", name: "x", environment: withXParameterInOuter })
              .addNode({ tag: 'variable-definition', id: "1", name: "x", environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' })
              .addNode({
                tag:         'function-definition',
                id:          "8",
                name:        "8",
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
                    .addNode({ tag: 'exit-point', id: "6", name: "<-", environment: withinNestedFunctionWithDef })
                    .addEdge("6", "4", "relates", "always")
                    .addEdge("6", "5", "relates", "always")
                    .addNode({ tag: 'variable-definition', id: "4", name: "x", environment: withinNestedFunctionWithParam, scope: LocalScope, when: 'always' })
                    .addNode({ tag: 'variable-definition', id: "2", name: "x", environment: withinNestedFunctionWithoutParam, scope: LocalScope, when: 'always' })
                    .addEdge("4", "5", "defined-by", "always")
                    .addEdge("2", "4", 'same-def-def', 'always'),
                  environments: withinNestedFunctionWithDef
                }
              })
              .addEdge("10", "1", "read", "always")
              .addEdge("1", "8", "defined-by", "always"),
            environments: withXParameterInOuter
          }
        })
        .addEdge("0", "12", "defined-by", "always")
    )
  })
}))
