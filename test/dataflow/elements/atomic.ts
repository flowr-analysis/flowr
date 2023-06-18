/**
 * Here we cover dataflow extraction for atomic statements (no expression lists).
 * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
 * This will not include functions!
 */
import { assertDataflow, withShell } from '../../helper/shell'
import { DataflowGraph, GlobalScope, initializeCleanEnvironments, LocalScope } from '../../../src/dataflow'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool, RUnaryOpPool } from '../../helper/provider'

describe("Atomic dataflow information", withShell((shell) => {
  describe("uninteresting leafs", () => {
    for (const input of ["42", '"test"', "TRUE", "NA", "NULL"]) {
      assertDataflow(input, shell, input, new DataflowGraph())
    }
  })

  assertDataflow("simple variable", shell,
    "xylophone",
    new DataflowGraph().addNode("0", "xylophone",  initializeCleanEnvironments())
  )

  describe("unary operators", () => {
    for (const opSuite of RUnaryOpPool) {
      describe(`${opSuite.label} operations`, () => {
        for (const op of opSuite.pool) {
          const inputDifferent = `${op.str}x`
          assertDataflow(`${op.str}x`, shell,
            inputDifferent,
            new DataflowGraph().addNode("0", "x",  initializeCleanEnvironments())
          )
        }
      })
    }
  })

  // TODO: these will be more interesting whenever we have more information on the edges (like modification etc.)
  describe("non-assignment binary operators", () => {
    for (const opSuite of RNonAssignmentBinaryOpPool) {
      describe(`${opSuite.label}`, () => {
        for (const op of opSuite.pool) {
          describe(`${op.str}`, () => {
            // TODO: some way to automatically retrieve the id if they are unique? || just allow to omit it?
            const inputDifferent = `x ${op.str} y`
            assertDataflow(`${inputDifferent} (different variables)`,
              shell,
              inputDifferent,
              new DataflowGraph().addNode("0", "x",  initializeCleanEnvironments()).addNode("1", "y",  initializeCleanEnvironments())
            )

            const inputSame = `x ${op.str} x`
            assertDataflow(`${inputSame} (same variables)`,
              shell,
              inputSame,
              new DataflowGraph()
                .addNode("0", "x",  initializeCleanEnvironments())
                .addNode("1", "x",  initializeCleanEnvironments())
                .addEdge("0", "1", "same-read-read", "always")
            )
          })
        }
      })
    }
  })

  describe("assignments", () => {
    for (const op of RAssignmentOpPool) {
      describe(`${op.str}`, () => {
        const scope = op.str.length > 2 ? GlobalScope : LocalScope // love it
        const swapSourceAndTarget = op.str === "->" || op.str === "->>"

        const constantAssignment = swapSourceAndTarget ? `5 ${op.str} x` : `x ${op.str} 5`
        assertDataflow(`${constantAssignment} (constant assignment)`,
          shell,
          constantAssignment,
          new DataflowGraph().addNode(
            swapSourceAndTarget ? "1" : "0",
            "x",  initializeCleanEnvironments(),
            scope
          )
        )

        const variableAssignment = `x ${op.str} y`
        const dataflowGraph = new DataflowGraph()
        if (swapSourceAndTarget) {
          dataflowGraph
            .addNode("0", "x",  initializeCleanEnvironments())
            .addNode("1", "y",  initializeCleanEnvironments(), scope)
            .addEdge("1", "0", "defined-by", "always")
        } else {
          dataflowGraph
            .addNode("0", "x",  initializeCleanEnvironments(), scope)
            .addNode("1", "y",  initializeCleanEnvironments())
            .addEdge("0", "1", "defined-by", "always")
        }
        assertDataflow(`${variableAssignment} (variable assignment)`,
          shell,
          variableAssignment,
          dataflowGraph
        )

        const circularAssignment = `x ${op.str} x`

        const circularGraph = new DataflowGraph()
        if (swapSourceAndTarget) {
          circularGraph
            .addNode("0", "x", initializeCleanEnvironments())
            .addNode("1", "x", initializeCleanEnvironments(), scope)
            .addEdge("1", "0", "defined-by", "always")
        } else {
          circularGraph
            .addNode("0", "x", initializeCleanEnvironments(), scope)
            .addNode("1", "x", initializeCleanEnvironments())
            .addEdge("0", "1", "defined-by", "always")
        }

        assertDataflow(`${circularAssignment} (circular assignment)`,
          shell,
          circularAssignment,
          circularGraph
        )
      })
    }
    describe(`nested assignments`, () => {
      // TODO: dependency between x and y?
      assertDataflow(`"x <- y <- 1"`, shell,
        "x <- y <- 1",
        new DataflowGraph()
          .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
          .addNode("1", "y", initializeCleanEnvironments(), LocalScope)
          .addEdge("0", "1", "defined-by", "always")
      )
      assertDataflow(`"1 -> x -> y"`, shell,
        "1 -> x -> y",
        new DataflowGraph()
          .addNode("1", "x", initializeCleanEnvironments(), LocalScope)
          .addNode("3", "y", initializeCleanEnvironments(), LocalScope)
          .addEdge("3", "1", "defined-by", "always")
      )
      // still by indirection (even though y is overwritten?) TODO: discuss that
      assertDataflow(`"x <- 1 -> y"`, shell,
        "x <- 1 -> y",
        new DataflowGraph()
          .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
          .addNode("2", "y", initializeCleanEnvironments(), LocalScope)
          .addEdge("0", "2", "defined-by", "always")
      )
      assertDataflow(`"x <- y <- z"`, shell,
        "x <- y <- z",
        new DataflowGraph()
          .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
          .addNode("1", "y", initializeCleanEnvironments(), LocalScope)
          .addNode("2", "z", initializeCleanEnvironments())
          .addEdge("0", "1", "defined-by", "always")
          .addEdge("1", "2", "defined-by", "always")
          .addEdge("0", "2", "defined-by", "always")
      )
    })

    describe(`known impact assignments`, () => {
      describe('Loops return invisible null', () => {
        for (const assignment of [ { str: '<-', defId: ['0','0','0'], readId: ['1','1','1'], swap: false },
          { str: '<<-', defId: ['0','0','0'], readId: ['1','1','1'], swap: false }, { str: '=', defId: ['0','0','0'], readId: ['1','1','1'], swap: false },
          /* two for parenthesis necessary for precedence */
          { str: '->', defId: ['2', '3', '6'], readId: ['0','0','0'], swap: true }, { str: '->>', defId: ['2', '3', '6'], readId: ['0','0','0'], swap: true }] ) {
          describe(`${assignment.str}`, () => {
            const scope = assignment.str.length > 2 ? GlobalScope : LocalScope

            for (const wrapper of [(x: string) => x, (x: string) => `{ ${x} }`]) {
              const build = (a: string, b: string) => assignment.swap ? `(${wrapper(b)}) ${assignment.str} ${a}` : `${a} ${assignment.str} ${wrapper(b)}`

              const repeatCode = build('x', 'repeat x')
              assertDataflow(`"${repeatCode}"`, shell, repeatCode, new DataflowGraph()
                .addNode(assignment.defId[0], "x", initializeCleanEnvironments(), scope)
                .addNode(assignment.readId[0], "x", initializeCleanEnvironments())
              )

              const whileCode = build('x', 'while (x) 3')
              assertDataflow(`"${whileCode}"`, shell, whileCode, new DataflowGraph()
                .addNode(assignment.defId[1], "x", initializeCleanEnvironments(), scope)
                .addNode(assignment.readId[1], "x", initializeCleanEnvironments()))

              const forCode = build('x', 'for (x in 1:4) 3')
              assertDataflow(`"${forCode}"`, shell, forCode,
                new DataflowGraph()
                  .addNode(assignment.defId[2], "x", initializeCleanEnvironments(), scope)
                  .addNode(assignment.readId[2], "x", initializeCleanEnvironments(), LocalScope /* for variable */)
              )
            }
          })
        }
      })
    })
  })

  describe("if-then-else", () => {
    // spacing issues etc. are dealt with within the parser, however, braces are not allowed to introduce scoping artifacts
    for (const b of [
      { label: "without braces", func: (x: string) => `${x}` },
      { label: "with braces", func: (x: string) => `{ ${x} }` },
    ]) {
      describe(`Variant ${b.label}`, () => {
        describe(`if-then, no else`, () => {
          assertDataflow(`completely constant`, shell,
            `if (TRUE) ${b.func("1")}`,
            new DataflowGraph()
          )
          assertDataflow(`compare cond.`, shell,
            `if (x > 5) ${b.func("1")}`,
            new DataflowGraph().addNode("0", "x", initializeCleanEnvironments())
          )
          assertDataflow(`compare cond. symbol in then`, shell,
            `if (x > 5) ${b.func("y")}`,
            new DataflowGraph().addNode("0", "x", initializeCleanEnvironments())
              .addNode("3", "y", initializeCleanEnvironments())
          )
          assertDataflow(`all variables`, shell,
            `if (x > y) ${b.func("z")}`,
            new DataflowGraph()
              .addNode("0", "x", initializeCleanEnvironments())
              .addNode("1", "y", initializeCleanEnvironments())
              .addNode("3", "z", initializeCleanEnvironments())
          )
          assertDataflow(`all variables, some same`, shell,
            `if (x > y) ${b.func("x")}`,
            new DataflowGraph()
              .addNode("0", "x", initializeCleanEnvironments())
              .addNode("1", "y", initializeCleanEnvironments())
              .addNode("3", "x", initializeCleanEnvironments())
              .addEdge("0", "3", "same-read-read", "always")
          )
          assertDataflow(`all same variables`, shell,
            `if (x > x) ${b.func("x")}`,
            new DataflowGraph()
              .addNode("0", "x", initializeCleanEnvironments())
              .addNode("1", "x", initializeCleanEnvironments())
              .addNode("3", "x", initializeCleanEnvironments())
              .addEdge("0", "1", "same-read-read", "always")
            // TODO: theoretically they just have to be connected
              .addEdge("0", "3", "same-read-read", "always")
          )
        })

        describe(`if-then, with else`, () => {
          assertDataflow(`completely constant`, shell,
            "if (TRUE) { 1 } else { 2 }",
            new DataflowGraph()
          )
          assertDataflow(`compare cond.`, shell,
            "if (x > 5) { 1 } else { 42 }",
            new DataflowGraph().addNode("0", "x", initializeCleanEnvironments())
          )
          assertDataflow(`compare cond. symbol in then`, shell,
            "if (x > 5) { y } else { 42 }",
            new DataflowGraph().addNode("0", "x", initializeCleanEnvironments()).addNode("3", "y", initializeCleanEnvironments())
          )
          assertDataflow(`compare cond. symbol in then & else`, shell,
            "if (x > 5) { y } else { z }",
            new DataflowGraph()
              .addNode("0", "x", initializeCleanEnvironments())
              .addNode("3", "y", initializeCleanEnvironments())
              .addNode("4", "z", initializeCleanEnvironments())
          )
          assertDataflow(`all variables`, shell,
            "if (x > y) { z } else { a }",
            new DataflowGraph()
              .addNode("0", "x", initializeCleanEnvironments())
              .addNode("1", "y", initializeCleanEnvironments())
              .addNode("3", "z", initializeCleanEnvironments())
              .addNode("4", "a", initializeCleanEnvironments())
          )
          assertDataflow(`all variables, some same`, shell,
            "if (y > x) { x } else { y }",
            new DataflowGraph()
              .addNode("0", "y", initializeCleanEnvironments())
              .addNode("1", "x", initializeCleanEnvironments())
              .addNode("3", "x", initializeCleanEnvironments())
              .addNode("4", "y", initializeCleanEnvironments())
              .addEdge("1", "3", "same-read-read", "always")
              .addEdge("0", "4", "same-read-read", "always")
          )
          assertDataflow(`all same variables`, shell,
            "if (x > x) { x } else { x }",
            new DataflowGraph()
              .addNode("0", "x", initializeCleanEnvironments())
              .addNode("1", "x", initializeCleanEnvironments())
              .addNode("3", "x", initializeCleanEnvironments())
              .addNode("4", "x", initializeCleanEnvironments())
            // TODO: 0 is just hardcoded, they just have to be connected
              .addEdge("0", "1", "same-read-read", "always")
              .addEdge("0", "3", "same-read-read", "always")
              .addEdge("0", "4", "same-read-read", "always")
          )
        })
      })
    }
  })

  describe('loops', () => {
    describe("for", () => {
    // TODO: support for vectors!
      assertDataflow("simple constant for-loop", shell,
        `for(i in 1:10) { 1 }`,
        new DataflowGraph().addNode("0", "i", initializeCleanEnvironments(), LocalScope)
      )
      assertDataflow("using loop variable in body", shell,
        `for(i in 1:10) { i }`,
        new DataflowGraph()
          .addNode("0", "i", initializeCleanEnvironments(), LocalScope)
          .addNode("4", "i", initializeCleanEnvironments())
          .addEdge("4", "0", "read", "always")
      )
    // TODO: so many other tests... variable in sequence etc.
    })

    describe("repeat", () => {
    // TODO: detect that a x <- repeat/while/for/... assignment does not have influence on the lhs as repeat returns NULL?
      assertDataflow("simple constant repeat", shell,
        `repeat 2`,
        new DataflowGraph()
      )
      assertDataflow("using loop variable in body", shell,
        `repeat x`,
        new DataflowGraph().addNode("0", "x", initializeCleanEnvironments())
      )
      assertDataflow("using loop variable in body", shell,
        `repeat { x <- 1 }`,
        new DataflowGraph().addNode("0", "x", initializeCleanEnvironments(), LocalScope)
      )
      assertDataflow("using variable in body", shell,
        `repeat { x <- y }`,
        new DataflowGraph()
          .addNode("0", "x", initializeCleanEnvironments(), LocalScope)
          .addNode("1", "y", initializeCleanEnvironments())
        // TODO: always until encountered conditional break etc?
          .addEdge("0", "1", "defined-by", "always" /* TODO: maybe ? */)
      )
    // TODO: so many other tests... variable in sequence etc.
    })

    describe("while", () => {
      assertDataflow("simple constant while", shell,
        `while (TRUE) 2`,
        new DataflowGraph()
      )
      assertDataflow("using variable in body", shell,
        `while (TRUE) x`,
        new DataflowGraph().addNode("1", "x", initializeCleanEnvironments())
      )
      assertDataflow("assignment in loop body", shell,
        `while (TRUE) { x <- 3 }`,
        new DataflowGraph().addNode("1", "x", initializeCleanEnvironments(), LocalScope)
      )
      assertDataflow('def compare in loop', shell, `while ((x <- x - 1) > 0) { x }`,
        new DataflowGraph()
          .addNode('0', 'x', initializeCleanEnvironments(), LocalScope)
          .addNode('1', 'x', initializeCleanEnvironments())
          .addNode('7', 'x', initializeCleanEnvironments())
          .addEdge('7', '0', 'read', 'always')
          .addEdge('0', '1', 'defined-by', 'always')
      )
    })
  })
}))
