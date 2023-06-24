import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { define } from '../../../../src/dataflow/environments'

describe('for', withShell(shell => {
  const envWithX = () => define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
  assertDataflow(`Read in for Loop`,
    shell,
    `x <- 12\nfor(i in 1:10) x `,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithX() })
      .addNode( { tag: 'use', id: "7", name: "x", environment: define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "5", used: 'always' }, LocalScope, envWithX()) })
      .addEdge("7", "0", "read", "maybe")
  )
  assertDataflow(`Read after for loop`,
    shell,
    `for(i in 1:10) { x <- 12 }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "4", name: "x", scope: LocalScope })
      .addNode( { tag: 'use', id: "8", name: "x" })
      .addNode( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
      .addEdge("8", "4", "read", "maybe")
  )
  assertDataflow(`Read after for loop with outer def`,
    shell,
    `x <- 9\nfor(i in 1:10) { x <- 12 }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope })
      .addNode( { tag: 'use', id: "11", name: "x" })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope })
      .addEdge("11", "0", "read", "maybe")
      .addEdge("11", "7", "read", "maybe")
      .addEdge("0", "7", "same-def-def", "maybe")
  )
  assertDataflow(`Redefinition within loop`,
    shell,
    `x <- 9\nfor(i in 1:10) { x <- x }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope })
      .addNode( { tag: 'use', id: "8", name: "x" })
      .addNode( { tag: 'use', id: "11", name: "x" })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope })
      .addEdge("11", "0", "read", "maybe")
      .addEdge("11", "7", "read", "maybe")
      .addEdge("8", "0", "read", "maybe")
      .addEdge("8", "7", "read", "maybe")
      .addEdge("7", "8", "defined-by", "always")
      .addEdge("0", "7", "same-def-def", "maybe")
  )

  assertDataflow(`Redefinition within loop`,
    shell,
    `x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "10", name: "x", scope: LocalScope })
      .addNode( { tag: 'use', id: "8", name: "x" })
      .addNode( { tag: 'use', id: "11", name: "x" })
      .addNode( { tag: 'use', id: "15", name: "x" })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope })
      .addEdge("11", "7", "read", "always")// second x <- *x* always reads first *x* <- x
      .addEdge("8", "0", "read", "maybe")
      .addEdge("8", "10", "read", "maybe")
      .addEdge("15", "0", "read", "maybe")
      .addEdge("15", "10", "read", "maybe")
      .addEdge("7", "8", "defined-by", "always")
      .addEdge("10", "11", "defined-by", "always")
      .addEdge("0", "7", "same-def-def", "maybe")
      .addEdge("0", "10", "same-def-def", "maybe")
      .addEdge("7", "10", "same-def-def", "always") // both in same loop execution
  )
  assertDataflow(`Redefinition within loop`,
    shell,
    `for(i in 1:10) { i; i <- 12 }\n i`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "5", name: "i", scope: LocalScope })
      .addNode( { tag: 'use', id: "4", name: "i" })
      .addNode( { tag: 'use', id: "10", name: "i" })
      .addEdge("4", "0", "read", "always")
      .addEdge("10", "5", "read", "maybe")
  )
}))
