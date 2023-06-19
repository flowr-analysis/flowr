import { NodeId } from '../../../../src/r-bridge'
import { DataflowGraph, initializeCleanEnvironments, LocalScope } from '../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../helper/shell'

describe("Lists with variable references", withShell(shell => {
  describe(`read-read same variable`, () => {
    const sameGraph = (id1: NodeId, id2: NodeId) =>
      new DataflowGraph()
        .addNode( { tag: 'use', id: id1, name: "x" })
        .addNode( { tag: 'use', id: id2, name: "x" })
        .addEdge(id1, id2, "same-read-read", "always")
    assertDataflow(`directly together`, shell,
      "x\nx",
      sameGraph("0", "1")
    )
    assertDataflow(`surrounded by uninteresting elements`, shell,
      "3\nx\n1\nx\n2",
      sameGraph("1", "3")
    )
    assertDataflow(`using braces`, shell,
      "{ x }\n{{ x }}",
      sameGraph("0", "1")
    )
    assertDataflow(`using braces and uninteresting elements`, shell,
      "{ x + 2 }; 4 - { x }",
      sameGraph("0", "4")
    )

    assertDataflow(`multiple occurrences of same variable`, shell,
      "x\nx\n3\nx",
      new DataflowGraph()
        .addNode( { tag: 'use', id: "0", name: "x" })
        .addNode( { tag: 'use', id: "1", name: "x" })
        .addNode( { tag: 'use', id: "3", name: "x" })
        .addEdge("0", "1", "same-read-read", "always")
        .addEdge("0", "3", "same-read-read", "always")
    )
  })
  describe("def-def same variable", () => {
    const sameGraph = (id1: NodeId, id2: NodeId) =>
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: id1, name: "x", scope: LocalScope })
        .addNode( { tag: 'variable-definition', id: id2, name: "x", scope: LocalScope })
        .addEdge(id1, id2, "same-def-def", "always")
    assertDataflow(`directly together`, shell,
      "x <- 1\nx <- 2",
      sameGraph("0", "3")
    )
    assertDataflow(`directly together with mixed sides`, shell,
      "1 -> x\nx <- 2",
      sameGraph("1", "3")
    )
    assertDataflow(`surrounded by uninteresting elements`, shell,
      "3\nx <- 1\n1\nx <- 3\n2",
      sameGraph("1", "5")
    )
    assertDataflow(`using braces`, shell,
      "{ x <- 42 }\n{{ x <- 50 }}",
      sameGraph("0", "3")
    )
    assertDataflow(`using braces and uninteresting elements`, shell,
      "5; { x <- 2 }; 17; 4 -> x; 9",
      sameGraph("1", "6")
    )

    assertDataflow(`multiple occurrences of same variable`, shell,
      "x <- 1\nx <- 3\n3\nx <- 9",
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode( { tag: 'variable-definition', id: "3", name: "x", scope: LocalScope })
        .addNode( { tag: 'variable-definition', id: "7", name: "x", scope: LocalScope })
        .addEdge("0", "3", "same-def-def", "always")
        .addEdge("3", "7", "same-def-def", "always")
    )
  })
  describe("def followed by read", () => {
    const sameGraph = (id1: NodeId, id2: NodeId) =>
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: id1, name: "x", scope: LocalScope })
        .addNode( { tag: 'use', id: id2, name: "x" })
        .addEdge(id2, id1, "read", "always")
    assertDataflow(`directly together`, shell,
      "x <- 1\nx",
      sameGraph("0", "3")
    )
    assertDataflow(`surrounded by uninteresting elements`, shell,
      "3\nx <- 1\n1\nx\n2",
      sameGraph("1", "5")
    )
    assertDataflow(`using braces`, shell,
      "{ x <- 1 }\n{{ x }}",
      sameGraph("0", "3")
    )
    assertDataflow(`using braces and uninteresting elements`, shell,
      "{ x <- 2 }; 5; x",
      sameGraph("0", "4")
    )
    assertDataflow(`redefinition links correctly`, shell,
      "x <- 2; x <- 3; x",
      sameGraph("3", "6")
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addEdge("0", "3", "same-def-def", "always")
    )
    assertDataflow(`multiple redefinition with circular definition`, shell,
      "x <- 2; x <- x; x",
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode( { tag: 'variable-definition', id: "3", name: "x", scope: LocalScope })
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addNode( { tag: 'use', id: "6", name: "x" })
        .addEdge("4", "0", "read", "always")
        .addEdge("3", "4", "defined-by", "always")
        .addEdge("0", "3", "same-def-def", "always")
        .addEdge("6", "3", "read", "always")
    )
    assertDataflow(`duplicate circular definition`, shell,
      "x <- x; x <- x;",
      new DataflowGraph()
        .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: LocalScope })
        .addNode( { tag: 'use', id: "1", name: "x" })
        .addNode( { tag: 'variable-definition', id: "3", name: "x", scope: LocalScope })
        .addNode( { tag: 'use', id: "4", name: "x" })
        .addEdge("0", "1", "defined-by", "always")
        .addEdge("3", "4", "defined-by", "always")
        .addEdge("4", "0", "read", "always")
        .addEdge("0", "3", "same-def-def", "always")
    )
  })
}))
