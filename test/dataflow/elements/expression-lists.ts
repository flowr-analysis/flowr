import { assertDataflow, withShell } from '../../helper/shell'
import { DataflowGraph, GlobalScope, LocalScope } from '../../../src/dataflow'
import { NodeId } from '../../../src/r-bridge'

describe(
  "B. Working with expression lists",
  withShell((shell) => {
    describe("0. Lists without variable references ", () => {
      let idx = 0
      for (const b of ["1\n2\n3", "1;2;3", "{ 1 + 2 }\n{ 3 * 4 }"]) {
        assertDataflow(
          `0.${idx++} ${JSON.stringify(b)}`,
          shell,
          b,
          new DataflowGraph()
        )
      }
    })

    describe("1. Lists with variable references", () => {
      describe(`1.1 read-read same variable`, () => {
        const sameGraph = (id1: NodeId, id2: NodeId) =>
          new DataflowGraph()
            .addNode(id1, "x")
            .addNode(id2, "x")
            .addEdge(id1, id2, "same-read-read", "always")
        assertDataflow(
          `1.1.1 directly together`,
          shell,
          "x\nx",
          sameGraph("0", "1")
        )
        assertDataflow(
          `1.1.2 surrounded by uninteresting elements`,
          shell,
          "3\nx\n1\nx\n2",
          sameGraph("1", "3")
        )
        assertDataflow(
          `1.1.3 using braces`,
          shell,
          "{ x }\n{{ x }}",
          sameGraph("0", "1")
        )
        assertDataflow(
          `1.1.4 using braces and uninteresting elements`,
          shell,
          "{ x + 2 }; 4 - { x }",
          sameGraph("0", "4")
        )

        assertDataflow(
          `1.1.5 multiple occurrences of same variable`,
          shell,
          "x\nx\n3\nx",
          new DataflowGraph()
            .addNode("0", "x")
            .addNode("1", "x")
            .addNode("3", "x")
            .addEdge("0", "1", "same-read-read", "always")
            .addEdge("0", "3", "same-read-read", "always")
        )
      })
      describe("1.2 def-def same variable", () => {
        const sameGraph = (id1: NodeId, id2: NodeId) =>
          new DataflowGraph()
            .addNode(id1, "x", LocalScope)
            .addNode(id2, "x", LocalScope)
            .addEdge(id1, id2, "same-def-def", "always")
        assertDataflow(
          `1.2.1 directly together`,
          shell,
          "x <- 1\nx <- 2",
          sameGraph("0", "3")
        )
        assertDataflow(
          `1.2.2 directly together with mixed sides`,
          shell,
          "1 -> x\nx <- 2",
          sameGraph("1", "3")
        )
        assertDataflow(
          `1.2.3 surrounded by uninteresting elements`,
          shell,
          "3\nx <- 1\n1\nx <- 3\n2",
          sameGraph("1", "5")
        )
        assertDataflow(
          `1.2.4 using braces`,
          shell,
          "{ x <- 42 }\n{{ x <- 50 }}",
          sameGraph("0", "3")
        )
        assertDataflow(
          `1.2.5 using braces and uninteresting elements`,
          shell,
          "5; { x <- 2 }; 17; 4 -> x; 9",
          sameGraph("1", "6")
        )

        assertDataflow(
          `1.2.6 multiple occurrences of same variable`,
          shell,
          "x <- 1\nx <- 3\n3\nx <- 9",
          new DataflowGraph()
            .addNode("0", "x", LocalScope)
            .addNode("3", "x", LocalScope)
            .addNode("7", "x", LocalScope)
            .addEdge("0", "3", "same-def-def", "always")
            .addEdge("3", "7", "same-def-def", "always")
        )
      })
      describe("1.3 def followed by read", () => {
        const sameGraph = (id1: NodeId, id2: NodeId) =>
          new DataflowGraph()
            .addNode(id1, "x", LocalScope)
            .addNode(id2, "x")
            .addEdge(id2, id1, "read", "always")
        assertDataflow(
          `1.3.1 directly together`,
          shell,
          "x <- 1\nx",
          sameGraph("0", "3")
        )
        assertDataflow(
          `1.3.2 surrounded by uninteresting elements`,
          shell,
          "3\nx <- 1\n1\nx\n2",
          sameGraph("1", "5")
        )
        assertDataflow(
          `1.3.3 using braces`,
          shell,
          "{ x <- 1 }\n{{ x }}",
          sameGraph("0", "3")
        )
        assertDataflow(
          `1.3.4 using braces and uninteresting elements`,
          shell,
          "{ x <- 2 }; 5; x",
          sameGraph("0", "4")
        )
        assertDataflow(
          `1.3.5 redefinition links correctly`,
          shell,
          "x <- 2; x <- 3; x",
          sameGraph("3", "6")
            .addNode("0", "x", LocalScope)
            .addEdge("0", "3", "same-def-def", "always")
        )
        assertDataflow(
          `1.3.6 multiple redefinition with circular definition`,
          shell,
          "x <- 2; x <- x; x",
          new DataflowGraph()
            .addNode("0", "x", LocalScope)
            .addNode("3", "x", LocalScope)
            .addNode("4", "x")
            .addNode("6", "x")
            .addEdge("4", "0", "read", "always")
            .addEdge("3", "4", "defined-by", "always")
            .addEdge("0", "3", "same-def-def", "always")
            .addEdge("6", "3", "read", "always")
        )
      })
    })

    describe("2. Lists with if-then constructs", () => {
      let idx = 0
      for(const assign of [ '<-', '<<-', '=']) {
        const scope = assign === '<<-' ? GlobalScope : LocalScope
        describe(`2.${++idx} using ${assign}`, () => {
          describe(`2.${idx}.1 reads within if`, () => {
            let idx = 0
            for (const b of [
              { label: "without else", text: "" },
              { label: "with else", text: " else { 1 }" },
            ]) {
              describe(`2.1.${++idx} ${b.label}`, () => {
                assertDataflow(
                  `2.1.${idx}.1 read previous def in cond`,
                  shell,
                  `x ${assign} 2\nif(x) { 1 } ${b.text}`,
                  new DataflowGraph()
                    .addNode("0", "x", scope)
                    .addNode("3", "x")
                    .addEdge("3", "0", "read", "always")
                )
                assertDataflow(
                  `2.1.${idx}.2 read previous def in then`,
                  shell,
                  `x ${assign} 2\nif(TRUE) { x } ${b.text}`,
                  new DataflowGraph()
                    .addNode("0", "x", scope)
                    .addNode("4", "x")
                    .addEdge("4", "0", "read", "maybe")
                )
              })
            }
            assertDataflow(
              `2.1.${++idx}. read previous def in else`,
              shell,
              `x ${assign} 2\nif(TRUE) { 42 } else { x }`,
              new DataflowGraph()
                .addNode("0", "x", scope)
                .addNode("5", "x")
                .addEdge("5", "0", "read", "maybe")
            )
          })
          describe(`2.${idx}.2 write within if`, () => {
            let idx = 0
            for (const b of [
              { label: "without else", text: "" },
              { label: "with else", text: " else { 1 }" },
            ]) {
              assertDataflow(
                `2.2.${++idx} ${b.label} directly together`,
                shell,
                `if(TRUE) { x ${assign} 2 }\nx`,
                new DataflowGraph()
                  .addNode("1", "x", scope)
                  .addNode("5", "x")
                  .addEdge("5", "1", "read", "maybe")
              )
            }
            assertDataflow(
              `2.2.${++idx} def in else read afterwards`,
              shell,
              `if(TRUE) { 42 } else { x ${assign} 5 }\nx`,
              new DataflowGraph()
                .addNode("2", "x", scope)
                .addNode("6", "x")
                .addEdge("6", "2", "read", "maybe")
            )
            assertDataflow(
              `2.2.${++idx} def in then and else read afterward`,
              shell,
              `if(TRUE) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
              new DataflowGraph()
                .addNode("1", "x", scope)
                .addNode("4", "x", scope)
                .addNode("8", "x")
                .addEdge("8", "1", "read", "maybe")
                .addEdge("8", "4", "read", "maybe")
              // TODO: .addEdge('4', '1', 'same-def-def', 'always')
            )
          })
        })
      }
      // TODO: others like same-read-read?
      // TODO: write-write if
    })
  })
)
