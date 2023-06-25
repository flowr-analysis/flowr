import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { appendEnvironments, define } from '../../../../src/dataflow/environments'

describe('for', withShell(shell => {
  const envWithX = () => define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
  assertDataflow(`Read in for Loop`,
    shell,
    `x <- 12\nfor(i in 1:10) x `,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithX() })
      .addNode( { tag: 'use', id: "7", name: "x", when: 'maybe', environment: define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "8", used: 'always' }, LocalScope, envWithX()) })
      .addEdge("7", "0", "read", "maybe")
  )
  const envWithI = () => define({ nodeId: "0", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "7", used: 'always' }, LocalScope, initializeCleanEnvironments())
  assertDataflow(`Read after for loop`,
    shell,
    `for(i in 1:10) { x <- 12 }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "4", name: "x", scope: LocalScope, when: 'maybe', environment: envWithI() })
      .addNode( { tag: 'use', id: "8", name: "x", environment: define({ nodeId: "4", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "6", used: 'always' }, LocalScope, envWithI()) })
      .addEdge("8", "4", "read", "maybe")
  )


  const envWithFirstX = () => define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
  const envInFor = () => define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "10", used: 'always' }, LocalScope,
    envWithFirstX()
  )

  const envOutFor = () => define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "10", used: 'always' }, LocalScope,
    define({ nodeId: "0", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "2", used: 'always' }, LocalScope, initializeCleanEnvironments())
  )

  const envWithSecondX = () => define({ nodeId: "7", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'always' }, LocalScope,
    initializeCleanEnvironments()
  )

  assertDataflow(`Read after for loop with outer def`,
    shell,
    `x <- 9\nfor(i in 1:10) { x <- 12 }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithFirstX() })
      .addNode( { tag: 'variable-definition', id: "7", name: "x", when: 'maybe', scope: LocalScope, environment: envInFor() })
      .addNode( { tag: 'use', id: "11", name: "x", environment: appendEnvironments(envOutFor(), envWithSecondX()) })
      .addEdge("11", "0", "read", "always")
      .addEdge("11", "7", "read", "maybe")
      .addEdge("0", "7", "same-def-def", "maybe")
  )
  assertDataflow(`Redefinition within loop`,
    shell,
    `x <- 9\nfor(i in 1:10) { x <- x }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithFirstX()})
      .addNode( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope, when: 'maybe', environment: envInFor() })
      .addNode( { tag: 'use', id: "8", name: "x", when: 'maybe', environment: envInFor() })
      .addNode( { tag: 'use', id: "11", name: "x", environment: appendEnvironments(envOutFor(), envWithSecondX()) })
      .addEdge("11", "0", "read", "always")
      .addEdge("11", "7", "read", "maybe")
      .addEdge("8", "0", "read", "maybe")
      .addEdge("8", "7", "read", "maybe")
      .addEdge("7", "8", "defined-by", "always")
      .addEdge("0", "7", "same-def-def", "maybe")
  )

  const envInLargeFor = () => define({ nodeId: "3", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "14", used: 'always' }, LocalScope,
    envWithFirstX()
  )

  const envInLargeFor2 = () => define({ nodeId: "7", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'always' }, LocalScope,
    envInLargeFor()
  )

  const envOutLargeFor = () => define({ nodeId: "10", name: 'x', scope: LocalScope, kind: 'variable', definedAt: "12", used: 'always' }, LocalScope,
    envInLargeFor()
  )

  assertDataflow(`Redefinition within loop`,
    shell,
    `x <- 9\nfor(i in 1:10) { x <- x; x <- x }\n x`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "3", name: "i", scope: LocalScope, environment: envWithFirstX() })
      .addNode( { tag: 'variable-definition', id: "7", name: "x", when: 'maybe', scope: LocalScope, environment: envInLargeFor() })
      .addNode( { tag: 'use', id: "8", name: "x", when: 'maybe', environment: envInLargeFor() })
      .addNode( { tag: 'variable-definition', id: "10", name: "x", when: 'maybe', scope: LocalScope, environment: envInLargeFor2() })
      .addNode( { tag: 'use', id: "11", name: "x", when: 'always' /* TODO: this is wrong, but uncertainty is not fully supported in the impl atm.*/, environment: envInLargeFor2() })
      .addNode( { tag: 'use', id: "15", name: "x", environment: appendEnvironments(envWithFirstX(), envOutLargeFor()) })
      .addEdge("11", "7", "read", "always")// second x <- *x* always reads first *x* <- x
      .addEdge("8", "0", "read", "maybe")
      .addEdge("8", "10", "read", "maybe")
      .addEdge("15", "0", "read", "always")
      .addEdge("15", "10", "read", "maybe")
      .addEdge("7", "8", "defined-by", "always")
      .addEdge("10", "11", "defined-by", "always")
      .addEdge("0", "7", "same-def-def", "maybe")
      .addEdge("0", "10", "same-def-def", "maybe")
      .addEdge("7", "10", "same-def-def", "always") // both in same loop execution
  )

  const forLoopWithI = () => define({ nodeId: "0", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "9", used: 'always' }, LocalScope,
    initializeCleanEnvironments()
  )
  const forLoopAfterI = () => define({ nodeId: "5", name: 'i', scope: LocalScope, kind: 'variable', definedAt: "7", used: 'always' }, LocalScope,
    initializeCleanEnvironments()
  )
  assertDataflow(`Redefinition within loop`,
    shell,
    `for(i in 1:10) { i; i <- 12 }\n i`,
    new DataflowGraph()
      .addNode( { tag: 'variable-definition', id: "0", name: "i", scope: LocalScope })
      .addNode( { tag: 'variable-definition', id: "5", name: "i", scope: LocalScope, when: 'maybe', environment: forLoopWithI() })
      .addNode( { tag: 'use', id: "4", name: "i", when: 'maybe', environment: forLoopWithI() })
      .addNode( { tag: 'use', id: "10", name: "i", environment: appendEnvironments(forLoopWithI(), forLoopAfterI()) })
      .addEdge("4", "0", "read", "maybe")
      .addEdge("10", "5", "read", "maybe")
      .addEdge("10", "0", "read", "always")
  )
}))
