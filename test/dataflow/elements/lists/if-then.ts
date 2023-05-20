import { DataflowGraph, GlobalScope, LocalScope } from '../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../helper/shell'

describe("2. Lists with if-then constructs", withShell(shell => {
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
            assertDataflow(`2.1.${idx}.1 read previous def in cond`,
              shell,
              `x ${assign} 2\nif(x) { 1 } ${b.text}`,
              new DataflowGraph()
                .addNode("0", "x", scope)
                .addNode("3", "x")
                .addEdge("3", "0", "read", "always")
            )
            assertDataflow(`2.1.${idx}.2 read previous def in then`,
              shell,
              `x ${assign} 2\nif(TRUE) { x } ${b.text}`,
              new DataflowGraph()
                .addNode("0", "x", scope)
                .addNode("4", "x")
                .addEdge("4", "0", "read", "maybe")
            )
          })
        }
        assertDataflow(`2.1.${++idx}. read previous def in else`,
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
          assertDataflow(`2.2.${++idx} ${b.label} directly together`,
            shell,
            `if(TRUE) { x ${assign} 2 }\nx`,
            new DataflowGraph()
              .addNode("1", "x", scope)
              .addNode("5", "x")
              .addEdge("5", "1", "read", "maybe")
          )
        }
        assertDataflow(`2.2.${++idx} def in else read afterwards`,
          shell,
          `if(TRUE) { 42 } else { x ${assign} 5 }\nx`,
          new DataflowGraph()
            .addNode("2", "x", scope)
            .addNode("6", "x")
            .addEdge("6", "2", "read", "maybe")
        )
        assertDataflow(    `2.2.${++idx} def in then and else read afterward`,
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
}))
