import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define, popLocalEnvironment, pushLocalEnvironment } from '../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../src/dataflow/internal/process/functions/argument'
import { UnnamedFunctionCallPrefix } from '../../../../src/dataflow/internal/process/functions/functionCall'

describe('Function Call', withShell(shell => {
  describe('Calling previously defined functions', () => {
    const envWithXParamDefined = define(
      {nodeId: '4', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    const envWithFirstI = define(
      {nodeId: '0', scope: 'local', name: 'i', used: 'always', kind: 'variable', definedAt: '2' },
      LocalScope,
      initializeCleanEnvironments()
    )
    const envWithIA = define(
      {nodeId: '3', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '9' },
      LocalScope,
      envWithFirstI
    )
    assertDataflow(`Calling function a`, shell, `i <- 4; a <- function(x) { x }\na(i)`,
      new DataflowGraph()
        .addNode({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
        .addNode({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
        .addNode({ tag: 'use', id: '11', name: 'i', environment: envWithIA })
        .addNode({ tag: 'use', id: '12', name: `${UnnamedArgumentPrefix}12`, environment: envWithIA })
        .addNode({
          tag:         'function-call',
          id:          '13',
          name:        'a',
          environment: envWithIA,
          args:        [{
            nodeId: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, used: 'always'
          }] })
        .addNode({
          tag:         'function-definition',
          id:          '8',
          name:        '8',
          scope:       LocalScope,
          exitPoints:  [ '6' ],
          environment: popLocalEnvironment(envWithXParamDefined),
          subflow:     {
            out:          [],
            in:           [],
            activeNodes:  [],
            scope:        LocalScope,
            environments: envWithXParamDefined,
            graph:        new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'use', id: '6', name: 'x', environment: envWithXParamDefined})
              .addEdge('6', '4', 'reads', 'always'),
          }})
        .addEdge('11', '0', 'reads', 'always')
        .addEdge('3', '8', 'defined-by', 'always')
        .addEdge('13', '12', 'argument', 'always')
        .addEdge('12', '11', 'reads', 'always')
        .addEdge('13', '3', 'reads', 'always')
        .addEdge('13', '8', 'calls', 'always')
        .addEdge('13', '6', 'returns', 'always')
        .addEdge('12', '4', 'defines-on-call', 'always')
    )
    const envWithIAB = define(
      {nodeId: '10', scope: 'local', name: 'b', used: 'always', kind: 'variable', definedAt: '12' },
      LocalScope,
      envWithIA
    )
    assertDataflow(`Calling function a with an indirection`, shell, `i <- 4; a <- function(x) { x }\nb <- a\nb(i)`,
      new DataflowGraph()
        .addNode({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
        .addNode({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
        .addNode({ tag: 'variable-definition', id: '10', name: 'b', scope: LocalScope, environment: envWithIA })
        .addNode({ tag: 'use', id: '11', name: 'a', scope: LocalScope, environment: envWithIA })
        .addNode({ tag: 'use', id: '14', name: 'i', environment: envWithIAB })
        .addNode({ tag: 'use', id: '15', name: `${UnnamedArgumentPrefix}15`, environment: envWithIAB })
        .addNode({
          tag:         'function-call',
          id:          '16',
          name:        'b',
          environment: envWithIAB,
          args:        [{
            nodeId: '15', name: `${UnnamedArgumentPrefix}15`, scope: LocalScope, used: 'always'
          }] })
        .addNode({
          tag:         'function-definition',
          id:          '8',
          name:        '8',
          scope:       LocalScope,
          exitPoints:  [ '6' ],
          environment: popLocalEnvironment(envWithXParamDefined),
          subflow:     {
            out:          [],
            in:           [],
            activeNodes:  [],
            scope:        LocalScope,
            environments: envWithXParamDefined,
            graph:        new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'use', id: '6', name: 'x', environment: envWithXParamDefined})
              .addEdge('6', '4', 'reads', 'always'),
          }})
        .addEdge('14', '0', 'reads', 'always')
        .addEdge('3', '8', 'defined-by', 'always')
        .addEdge('10', '11', 'defined-by', 'always')
        .addEdge('11', '3', 'reads', 'always')
        .addEdge('16', '15', 'argument', 'always')
        .addEdge('15', '14', 'reads', 'always')
        .addEdge('16', '10', 'reads', 'always')
        .addEdge('16', '8', 'calls', 'always')
        .addEdge('16', '6', 'returns', 'always')
        .addEdge('15', '4', 'defines-on-call', 'always')
    )
    const envWithXConstDefined = define(
      {nodeId: '4', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))

    const envWithXDefinedForFunc = define(
      {nodeId: '6', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '8' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))

    const envWithLastXDefined = define(
      {nodeId: '9', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '11' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    const envWithIAndLargeA = define(
      {nodeId: '3', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '15' },
      LocalScope,
      envWithFirstI
    )
    assertDataflow(`Calling with a constant function`, shell, `i <- 4
a <- function(x) { x <- x; x <- 3; 1 }
a(i)`, new DataflowGraph()
      .addNode({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
      .addNode({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
      .addNode({ tag: 'use', id: '17', name: 'i', environment: envWithIAndLargeA})
      .addNode({ tag: 'use', id: '18', name: `${UnnamedArgumentPrefix}18`, environment: envWithIAndLargeA})
      .addEdge('17', '0', 'reads', 'always')
      .addNode({
        tag:         'function-call',
        id:          '19',
        name:        'a',
        environment: envWithIAndLargeA,
        args:        [{
          nodeId: '18', name: `${UnnamedArgumentPrefix}18`, scope: LocalScope, used: 'always'
        }]})
      .addNode({
        tag:         'function-definition',
        id:          '14',
        name:        '14',
        environment: initializeCleanEnvironments(),
        scope:       LocalScope,
        exitPoints:  [ '12' ],
        subflow:     {
          out:          [],
          in:           [],
          activeNodes:  [],
          scope:        LocalScope,
          environments: envWithLastXDefined,
          graph:        new DataflowGraph()
            .addNode({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) })
            .addNode({ tag: 'variable-definition', id: '6', name: 'x', scope: LocalScope, environment: envWithXConstDefined })
            .addNode({ tag: 'variable-definition', id: '9', name: 'x', scope: LocalScope, environment: envWithXDefinedForFunc })
            .addNode({ tag: 'use', id: '7', name: 'x', environment: envWithXConstDefined })
            .addNode({ tag: 'use', id: '6', name: 'x', environment: envWithXConstDefined})
            .addNode({ tag: 'exit-point', id: '12', name: '1', environment: envWithLastXDefined})
            .addEdge('6', '7', 'defined-by', 'always')
            .addEdge('7', '4', 'reads', 'always')
            .addEdge('6', '9', 'same-def-def', 'always')
            .addEdge('4', '9', 'same-def-def', 'always')
            .addEdge('4', '6', 'same-def-def', 'always')
        }})
      .addEdge('3', '14', 'defined-by', 'always')
      .addEdge('19', '18', 'argument', 'always')
      .addEdge('18', '17', 'reads', 'always')
      .addEdge('19', '3', 'reads', 'always')
      .addEdge('19', '14', 'calls', 'always')
      .addEdge('19', '12', 'returns', 'always')
      .addEdge('18', '4', 'defines-on-call', 'always')
    )
  })

  describe('Directly calling a function', () => {
    const envWithXParameter = define(
      {nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments())
    )
    const outGraph = new DataflowGraph()
      .addNode({
        tag:  'function-call',
        id:   '9',
        name: `${UnnamedFunctionCallPrefix}9`,
        args: [
          { nodeId: '8', name: `${UnnamedArgumentPrefix}8`, scope: LocalScope, used: 'always' }
        ]
      })
      .addNode({
        tag:         'function-definition',
        id:          '6',
        name:        '6',
        environment: initializeCleanEnvironments(),
        scope:       LocalScope,
        exitPoints:  [ '4' ],
        subflow:     {
          out:          [],
          in:           [],
          activeNodes:  [],
          scope:        LocalScope,
          environments: envWithXParameter,
          graph:        new DataflowGraph()
            .addNode({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) })
            .addNode({ tag: 'use', id: '2', name: 'x', environment: envWithXParameter })
            .addNode({ tag: 'exit-point', id: '4', name: '+', environment: envWithXParameter })
            .addEdge('2', '4', 'relates', 'always')
            .addEdge('2', '0', 'reads', 'always')
        }
      })
      .addNode({ tag: 'use', id: '8', name: `${UnnamedArgumentPrefix}8`})
      .addEdge('9', '8', 'argument', 'always')
      .addEdge('9', '6', 'calls', 'always')
      .addEdge('9', '4', 'returns', 'always')
      .addEdge('8', '0', 'defines-on-call', 'always')

    assertDataflow('Calling with constant argument using lambda', shell, `(\\(x) { x + 1 })(2)`,
      outGraph
    )
    assertDataflow('Calling with constant argument', shell, `(function(x) { x + 1 })(2)`,
      outGraph
    )

    const envWithADefined = define(
      {nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '6' },
      LocalScope,
      initializeCleanEnvironments()
    )

    assertDataflow('Calling a function which returns another', shell, `a <- function() { function() { 42 } }
a()()`,
    new DataflowGraph()
      .addNode({
        tag:         'function-call',
        id:          '9',
        name:        `${UnnamedFunctionCallPrefix}9`,
        environment: envWithADefined,
        args:        []
      })
      .addNode({
        tag:         'function-call',
        id:          '8',
        name:        'a',
        environment: envWithADefined,
        args:        []
      })
      .addNode({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
      .addNode({
        tag:         'function-definition',
        id:          '5',
        name:        '5',
        environment: initializeCleanEnvironments(),
        scope:       LocalScope,
        exitPoints:  [ '3' ],
        subflow:     {
          out:          [],
          in:           [],
          activeNodes:  [],
          scope:        LocalScope,
          environments: pushLocalEnvironment(initializeCleanEnvironments()),
          graph:        new DataflowGraph()
            .addNode({
              tag:         'function-definition',
              id:          '3',
              name:        '3',
              environment: pushLocalEnvironment(initializeCleanEnvironments()),
              scope:       LocalScope,
              exitPoints:  [ '1' ],
              subflow:     {
                out:          [],
                in:           [],
                activeNodes:  [],
                scope:        LocalScope,
                environments: pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())),
                graph:        new DataflowGraph()
                  .addNode({ tag: 'exit-point', id: '1', name: '42', environment: pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())) })
              }
            })
        }
      })
      .addEdge('9', '8', 'calls', 'always')
      .addEdge('8', '0', 'reads', 'always')
      .addEdge('0', '5', 'defined-by', 'always')
      .addEdge('8', '5', 'calls', 'always')
      .addEdge('8', '3', 'returns', 'always')
      .addEdge('9', '3', 'calls', 'always')
      .addEdge('9', '1', 'returns', 'always')
    )
  })

  describe('Argument which is expression', () => {
    assertDataflow(`Calling with 1 + x`, shell, `foo(1 + x)`,
      new DataflowGraph()
        .addNode({ tag: 'function-call', id: '5', name: 'foo', environment: initializeCleanEnvironments(), args: [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }]})
        .addNode({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`})
        .addNode({ tag: 'use', id: '2', name: 'x'})
        .addEdge('4', '2', 'reads', 'always')
        .addEdge('5', '4', 'argument', 'always')
    )
  })

  describe('Multiple out refs in arguments', () => {
    assertDataflow(`Calling 'seq'`, shell, `seq(1, length(pkgnames), by = stepsize)`,
      new DataflowGraph()
        .addNode({
          tag:         'function-call',
          id:          '11',
          name:        'seq',
          environment: initializeCleanEnvironments(),
          args:        [
            { nodeId: '2', name: `${UnnamedArgumentPrefix}2`, scope: LocalScope, used: 'always' },
            { nodeId: '7', name: `${UnnamedArgumentPrefix}7`, scope: LocalScope, used: 'always' },
            { nodeId: '10', name: `by`, scope: LocalScope, used: 'always' },
          ]
        })
        .addNode({ tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2`})
        .addNode({ tag: 'use', id: '7', name: `${UnnamedArgumentPrefix}7`})
        .addNode({ tag: 'use', id: '10', name: `by`})
        .addEdge('11', '2', 'argument', 'always')
        .addEdge('11', '7', 'argument', 'always')
        .addEdge('11', '10', 'argument', 'always')
        .addNode({ tag: 'use', id: '9', name: 'stepsize' })
        .addEdge('10', '9', 'reads', 'always')
        .addNode({
          tag:         'function-call',
          id:          '6',
          name:        'length',
          environment: initializeCleanEnvironments(),
          args:        [
            { nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' }
          ]
        })
        .addEdge('7', '6', 'reads', 'always')
        .addNode({ tag: 'use', id: '5', name: `${UnnamedArgumentPrefix}5`})
        .addEdge('6', '5', 'argument', 'always')
        .addNode({ tag: 'use', id: '4', name: 'pkgnames' })
        .addEdge('5', '4', 'reads', 'always')

    )
  })

  describe('Late function bindings', () => {
    const innerEnv = pushLocalEnvironment(initializeCleanEnvironments())
    const defWithA = define(
      { nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '4' },
      LocalScope,
      initializeCleanEnvironments()
    )
    const defWithAY = define(
      { nodeId: '5', scope: 'local', name: 'y', used: 'always', kind: 'variable', definedAt: '7' },
      LocalScope,
      defWithA
    )

    assertDataflow(`Late binding of y`, shell, `a <- function() { y }\ny <- 12\na()`,
      new DataflowGraph()
        .addNode({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
        .addNode({
          tag:         'variable-definition',
          id:          '5',
          name:        'y',
          scope:       LocalScope,
          environment: defWithA})
        .addNode({
          tag:         'function-call',
          id:          '9',
          name:        'a',
          environment: defWithAY,
          args:        []
        })
        .addNode({
          tag:        'function-definition',
          id:         '3',
          name:       '3',
          scope:      LocalScope,
          exitPoints: [ '1' ],
          subflow:    {
            out:          [],
            in:           [{ nodeId: '1', name: 'y', scope: LocalScope, used: 'always' }],
            activeNodes:  [],
            scope:        LocalScope,
            environments: innerEnv,
            graph:        new DataflowGraph()
              .addNode({ tag: 'use', id: '1', name: 'y', scope: LocalScope, environment: innerEnv })
          }})
        .addEdge('0', '3', 'defined-by', 'always')
        .addEdge('9', '3', 'calls', 'always')
        .addEdge('9', '0', 'reads', 'always')
        .addEdge('9', '1', 'returns', 'always')
    )
  })

  describe('Deal with empty calls', () => {
    const withXParameter = define(
      { nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '3' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments())
    )
    const withXYParameter = define(
      { nodeId: '4', scope: 'local', name: 'y', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      withXParameter
    )
    const withADefined = define(
      { nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '9' },
      LocalScope,
      initializeCleanEnvironments()
    )
    assertDataflow(`Not giving first parameter`, shell, `a <- function(x=3,y) { y }
a(,3)`, new DataflowGraph()
      .addNode({
        tag:         'function-call',
        id:          '13',
        name:        'a',
        environment: withADefined,
        args:        [
          'empty',
          { nodeId: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, used: 'always' }
        ]
      })
      .addNode({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
      .addNode({
        tag:         'function-definition',
        id:          '8',
        scope:       LocalScope,
        name:        '8',
        exitPoints:  [ '6' ],
        environment: popLocalEnvironment(withXYParameter),
        subflow:     {
          out:          [],
          in:           [],
          activeNodes:  [],
          scope:        LocalScope,
          environments: withXYParameter,
          graph:        new DataflowGraph()
            .addNode({ tag: 'variable-definition', id: '1', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) })
            .addNode({ tag: 'variable-definition', id: '4', name: 'y', scope: LocalScope, environment: withXParameter })
            .addNode({ tag: 'use', id: '6', name: 'y', scope: LocalScope, environment: withXYParameter })
            .addEdge('6', '4', 'reads', 'always')
        }
      })
      .addNode({ tag: 'use', id: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, environment: withADefined })
      .addEdge('13', '0', 'reads', 'always')
      .addEdge('13', '8', 'calls', 'always')
      .addEdge('0', '8', 'defined-by', 'always')
      .addEdge('13', '12', 'argument', 'always')
      .addEdge('13', '6', 'returns', 'always')
      .addEdge('12', '4', 'defines-on-call', 'always')
    )
  })
  describe('Reuse parameters in call', () => {
    const envWithX = define(
      { nodeId: '3', scope: 'local', name: 'x', used: 'always', kind: 'argument', definedAt: '3' },
      LocalScope,
      initializeCleanEnvironments()
    )
    assertDataflow(`Not giving first argument`, shell, `a(x=3, x)`, new DataflowGraph()
      .addNode({
        tag:  'function-call',
        id:   '6',
        name: 'a',
        args: [
          { nodeId: '3', name: 'x', scope: LocalScope, used: 'always' },
          { nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' },
        ]
      })
      .addNode({ tag: 'use', id: '3', name: 'x', scope: LocalScope })
      .addNode({
        tag:         'use',
        id:          '5',
        name:        `${UnnamedArgumentPrefix}5`,
        scope:       LocalScope,
        environment: envWithX
      })
      .addNode({ tag: 'use', id: '4', name: 'x', environment: envWithX })
      .addEdge('6', '3', 'argument', 'always')
      .addEdge('6', '5', 'argument', 'always')
      .addEdge('5', '4', 'reads', 'always')
      .addEdge('4', '3', 'reads', 'always')
    )
  })
  describe('Define in parameters', () => {
    assertDataflow(`Support assignments in function calls`, shell, `foo(x <- 3); x`, new DataflowGraph()
      .addNode({
        tag:   'function-call',
        id:    '5',
        name:  'foo',
        scope: LocalScope,
        args:  [
          { nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }
        ]
      })
      .addNode({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope })
      .addNode({ tag: 'variable-definition', id: '1', name: 'x', scope: LocalScope })
      .addNode({
        tag:         'use',
        id:          '6',
        name:        'x',
        scope:       LocalScope,
        environment: define(
          { nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '3' },
          LocalScope,
          initializeCleanEnvironments()
        ) })
      .addEdge('5', '4', 'argument', 'always')
      .addEdge('4', '1', 'reads', 'always')
      .addEdge('6', '1', 'reads', 'always')
    )
  })
}))
