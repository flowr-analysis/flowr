import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define, pushLocalEnvironment } from '../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../src/dataflow/internal/process/functions/argument'

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
      {nodeId: '3', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '8' },
      LocalScope,
      envWithFirstI
    )
    assertDataflow(`Calling function a`, shell, `i <- 4; a <- function(x) { x }\na(i)`,
      new DataflowGraph()
        .addNode({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
        .addNode({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
        .addNode({ tag: 'use', id: '10', name: 'i', environment: envWithIA })
        .addNode({ tag: 'use', id: '11', name: `${UnnamedArgumentPrefix}11`, environment: envWithIA })
        .addNode({
          tag:         'function-call',
          id:          '12',
          name:        'a',
          environment: envWithIA,
          args:        [{
            nodeId: '11', name: `${UnnamedArgumentPrefix}11`, scope: LocalScope, used: 'always'
          }] })
        .addNode({
          tag:        'function-definition',
          id:         '7',
          name:       '7',
          scope:      LocalScope,
          exitPoints: [ '6' ],
          subflow:    {
            out:          [],
            in:           [],
            activeNodes:  [],
            scope:        LocalScope,
            environments: envWithXParamDefined,
            graph:        new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) })
              .addNode({ tag: 'use', id: '6', name: 'x', environment: envWithXParamDefined})
              .addEdge('6', '4', 'read', 'always'),
          }})
        .addEdge('10', '0', 'read', 'always')
        .addEdge('3', '7', 'defined-by', 'always')
        .addEdge('12', '11', 'argument', 'always')
        .addEdge('11', '10', 'read', 'always')
        .addEdge('12', '3', 'read', 'always')
        .addEdge('12', '7', 'calls', 'always')
        .addEdge('12', '6', 'returns', 'always')
        .addEdge('11', '4', 'defines-on-call', 'always')
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
      .addEdge('17', '0', 'read', 'always')
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
            .addEdge('7', '4', 'read', 'always')
            .addEdge('6', '9', 'same-def-def', 'always')
            .addEdge('4', '9', 'same-def-def', 'always')
            .addEdge('4', '6', 'same-def-def', 'always')
        }})
      .addEdge('3', '14', 'defined-by', 'always')
      .addEdge('19', '18', 'argument', 'always')
      .addEdge('18', '17', 'read', 'always')
      .addEdge('19', '3', 'read', 'always')
      .addEdge('19', '14', 'calls', 'always')
      .addEdge('19', '12', 'returns', 'always')
      .addEdge('18', '4', 'defines-on-call', 'always')
    )
  })

  /*
  describe('Directly calling a function', () => {
    assertDataflow('Calling with constant argument', shell, `(function(x) { x + 1 })(2)`,
      new DataflowGraph()
        .addNode({ tag: 'function-call', id: '5', name: 'foo', environment: initializeCleanEnvironments(), args: [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }]})
        .addNode({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`})
        .addNode({ tag: 'use', id: '2', name: 'x'})
        .addEdge('4', '2', 'read', 'always')
        .addEdge('5', '4', 'argument', 'always')
    )
  })
*/


  describe('Argument which is expression', () => {
    assertDataflow(`Calling with 1 + x`, shell, `foo(1 + x)`,
      new DataflowGraph()
        .addNode({ tag: 'function-call', id: '5', name: 'foo', environment: initializeCleanEnvironments(), args: [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }]})
        .addNode({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`})
        .addNode({ tag: 'use', id: '2', name: 'x'})
        .addEdge('4', '2', 'read', 'always')
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
            { nodeId: '10', name: `by-10`, scope: LocalScope, used: 'always' },
          ]
        })
        .addNode({ tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2`})
        .addNode({ tag: 'use', id: '7', name: `${UnnamedArgumentPrefix}7`})
        .addNode({ tag: 'use', id: '10', name: `by-10`})
        .addEdge('11', '2', 'argument', 'always')
        .addEdge('11', '7', 'argument', 'always')
        .addEdge('11', '10', 'argument', 'always')
        .addNode({ tag: 'use', id: '9', name: 'stepsize' })
        .addEdge('10', '9', 'read', 'always')
        .addNode({
          tag:         'function-call',
          id:          '6',
          name:        'length',
          environment: initializeCleanEnvironments(),
          args:        [
            { nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' }
          ]
        })
        .addEdge('7', '6', 'read', 'always')
        .addNode({ tag: 'use', id: '5', name: `${UnnamedArgumentPrefix}5`})
        .addEdge('6', '5', 'argument', 'always')
        .addNode({ tag: 'use', id: '4', name: 'pkgnames' })
        .addEdge('5', '4', 'read', 'always')

    )
  })

  describe('Late function bindings', () => {
    const innerEnv = pushLocalEnvironment(initializeCleanEnvironments())
    const defWithA = define(
      { nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '3' },
      LocalScope,
      initializeCleanEnvironments()
    )
    const defWithAY = define(
      { nodeId: '4', scope: 'local', name: 'y', used: 'always', kind: 'variable', definedAt: '6' },
      LocalScope,
      defWithA
    )

    assertDataflow(`Late binding of y`, shell, `a <- function() { y }\ny <- 12\na()`,
      new DataflowGraph()
        .addNode({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
        .addNode({
          tag:         'variable-definition',
          id:          '4',
          name:        'y',
          scope:       LocalScope,
          environment: defWithA})
        .addNode({
          tag:         'function-call',
          id:          '8',
          name:        'a',
          environment: defWithAY,
          args:        []
        })
        .addNode({
          tag:        'function-definition',
          id:         '2',
          name:       '2',
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
        .addEdge('0', '2', 'defined-by', 'always')
        .addEdge('8', '2', 'calls', 'always')
        .addEdge('8', '0', 'read', 'always')
        .addEdge('8', '1', 'returns', 'always')
        // TODO: functions must store the *final* environments with all definitions they produce
        // TODO: on call the current environments should be used, joined with the def-environment!
    )
    // a <- function() { x <- function() { y }; y <- 12; return(x) }; a()
    // a <- function(y) { y }; y <- 12; a()
  })
}))
