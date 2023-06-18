import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'

describe('for', withShell(shell => {
  assertDataflow(`Read in for Loop`,
    shell,
    `x <- 12\nfor(i in 1:10) x `,
    new DataflowGraph()
      .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
      .addNode("7", "x", initializeCleanEnvironments())
      .addNode("3", "i", initializeCleanEnvironments(), LocalScope)
      .addEdge("7", "0", "read", "maybe")
  )
  assertDataflow(`Read after for loop`,
    shell,
    `for(i in 1:10) { x <- 12 }\n x`,
    new DataflowGraph()
      .addNode("4", "x", initializeCleanEnvironments(), LocalScope)
      .addNode("8", "x", initializeCleanEnvironments())
      .addNode("0", "i", initializeCleanEnvironments(), LocalScope)
      .addEdge("8", "4", "read", "maybe")
  )
}))
