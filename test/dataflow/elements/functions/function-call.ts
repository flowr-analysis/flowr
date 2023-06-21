import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define, pushLocalEnvironment } from '../../../../src/dataflow/environments'

describe('Function Call', withShell(shell => {
  describe('Calling previously defined functions', () => {
    const envWithXDefined = define(
      {nodeId: '4', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`Calling function a`, shell, `i <- 4; a <- function(x) { x }\na(i)`,
      new DataflowGraph()
        .addNode({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
        .addNode({ tag: 'use', id: '10', name: 'i'})
        .addNode({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope })
        .addNode({ tag:  'function-call', id:   '9', name: 'a', args: [{
          nodeId: '10', name: 'i', scope: LocalScope, used: 'always'
        }] })
        .addNode({
          tag:     'function-definition',
          id:      '7',
          name:    '7',
          scope:   LocalScope,
          subflow: {
            out:          [],
            in:           [],
            activeNodes:  [],
            scope:        LocalScope,
            environments: envWithXDefined,
            graph:        new DataflowGraph()
              .addNode({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: envWithXDefined })
              .addNode({ tag: 'use', id: '6', name: 'x', environment: envWithXDefined})
              .addEdge('6', '4', 'read', 'always')
          }})
        .addEdge('10', '0', 'read', 'always')
        .addEdge('3', '7', 'defined-by', 'always')
        .addEdge('9', '10', 'parameter', 'always')
        .addEdge('9', '3', 'read', 'always')
    )
    const envWithXConstDefined = define(
      {nodeId: '4', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '5' },
      LocalScope,
      pushLocalEnvironment(initializeCleanEnvironments()))
    assertDataflow(`Calling with a constant function`, shell, `i <- 4
a <- function(x) { x <- x; x <- 3; 1 }
a(i)`, new DataflowGraph()
      .addNode({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
      .addNode({ tag: 'use', id: '17', name: 'i'})
      .addEdge('17', '0', 'read', 'always')
      .addNode({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope })
      .addNode({ tag:  'function-call', id:   '16', name: 'a', args: [{
        nodeId: '17', name: 'i', scope: LocalScope, used: 'always'
      }]})
      .addNode({
        tag:     'function-definition',
        id:      '14',
        name:    '14',
        scope:   LocalScope,
        subflow: {
          out:          [],
          in:           [],
          activeNodes:  [],
          scope:        LocalScope,
          environments: envWithXConstDefined,
          graph:        new DataflowGraph()
            .addNode({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: envWithXConstDefined })
            .addNode({ tag: 'variable-definition', id: '6', name: 'x', scope: LocalScope, environment: envWithXConstDefined })
            .addNode({ tag: 'variable-definition', id: '9', name: 'x', scope: LocalScope, environment: envWithXConstDefined })
            .addNode({ tag: 'use', id: '7', name: 'x', environment: envWithXConstDefined })
            .addNode({ tag: 'use', id: '6', name: 'x', environment: envWithXConstDefined})
            .addEdge('6', '7', 'defined-by', 'always')
            .addEdge('7', '4', 'read', 'always')
            .addEdge('6', '9', 'same-def-def', 'always')
            .addEdge('4', '9', 'same-def-def', 'always')
            .addEdge('4', '6', 'same-def-def', 'always')
        }})
      .addEdge('3', '14', 'defined-by', 'always')
      .addEdge('16', '3', 'read', 'always')
      .addEdge('16', '17', 'parameter', 'always')
    )
  })
}))
