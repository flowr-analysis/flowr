import {
  DataflowGraph,
  GlobalScope, initializeCleanEnvironments,
  LocalScope
} from '../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../helper/shell'
import { appendEnvironments, define } from '../../../../src/dataflow/environments'

describe("Lists with if-then constructs", withShell(shell => {
  for(const assign of [ '<-', '<<-', '=']) {
    const scope = assign === '<<-' ? GlobalScope : LocalScope
    describe(`using ${assign}`, () => {
      describe(`reads within if`, () => {
        for (const b of [
          { label: "without else", text: "" },
          { label: "with else", text: " else { 1 }" },
        ]) {
          describe(`${b.label}`, () => {
            assertDataflow(`read previous def in cond`,
              shell,
              `x ${assign} 2\nif(x) { 1 } ${b.text}`,
              new DataflowGraph()
                .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: scope })
                .addNode( { tag: 'use', id: "3", name: "x", environment: define({ nodeId: "0", name: 'x', scope, kind: 'variable', definedAt: "2", used: 'always' }, scope, initializeCleanEnvironments()) })
                .addEdge("3", "0", "read", "always")
            )
            assertDataflow(`read previous def in then`,
              shell,
              `x ${assign} 2\nif(TRUE) { x } ${b.text}`,
              new DataflowGraph()
                .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: scope })
                .addNode( { tag: 'use', id: "4", name: "x", when: 'always', environment: define({ nodeId: "0", name: 'x', scope, kind: 'variable', definedAt: "2", used: 'always' }, scope, initializeCleanEnvironments()) })
                .addEdge("4", "0", "read", "always")
            )
          })
        }
        assertDataflow(`read previous def in else`,
          shell,
          `x ${assign} 2\nif(FALSE) { 42 } else { x }`,
          new DataflowGraph()
            .addNode( { tag: 'variable-definition', id: "0", name: "x", scope: scope })
            .addNode( { tag: 'use', id: "5", name: "x", when: 'always', environment: define({ nodeId: "0", name: 'x', scope, kind: 'variable', definedAt: "2", used: 'always' }, scope, initializeCleanEnvironments()) })
            .addEdge("5", "0", "read", "always")
        )
      })
      describe(`write within if`, () => {
        for (const b of [
          { label: "without else", text: "" },
          { label: "with else", text: " else { 1 }" },
        ]) {
          assertDataflow(`${b.label} directly together`,
            shell,
            `if(TRUE) { x ${assign} 2 }\nx`,
            new DataflowGraph()
              .addNode( { tag: 'variable-definition', id: "1", name: "x", when: 'always', scope: scope })
              .addNode( { tag: 'use', id: "5", name: "x", environment: define({ nodeId: "1", name: 'x', scope, kind: 'variable', definedAt: "3", used: 'always' /* TODO: fix that...*/ }, scope, initializeCleanEnvironments()) })
              .addEdge("5", "1", "read", "always")
          )
        }
        assertDataflow(`def in else read afterwards`,
          shell,
          `if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
          new DataflowGraph()
            .addNode( { tag: 'variable-definition', id: "2", name: "x", when: 'always', scope: scope })
            .addNode( { tag: 'use', id: "6", name: "x", environment: define({ nodeId: "2", name: 'x', scope, kind: 'variable', definedAt: "4", used: 'always' }, scope, initializeCleanEnvironments()) })
            .addEdge("6", "2", "read", "always")
        )

        const whenEnvironment = define({ nodeId: "1", name: 'x', scope, kind: 'variable', definedAt: "3", used: 'maybe' }, scope, initializeCleanEnvironments())
        const otherwiseEnvironment = define({ nodeId: "4", name: 'x', scope, kind: 'variable', definedAt: "6", used: 'maybe' }, scope, initializeCleanEnvironments())

        assertDataflow(`def in then and else read afterward`,
          shell,
          `if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
          new DataflowGraph()
            .addNode( { tag: 'use', id: "0", name: "z", when: 'always', scope: scope })
            .addNode( { tag: 'variable-definition', id: "1", name: "x", scope: scope, when: 'maybe' })
            .addNode( { tag: 'variable-definition', id: "4", name: "x", scope: scope, when: 'maybe' })
            .addNode( { tag: 'use', id: "8", name: "x", environment: appendEnvironments(whenEnvironment, otherwiseEnvironment) })
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
