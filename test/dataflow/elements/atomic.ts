/**
   * Here we cover dataflow extraction for atomic statements (no expression lists).
   * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
   * This will not include functions!
   */
import { assertDataflow, withShell } from '../../helper/shell'
import { DataflowGraph, GlobalScope, LocalScope } from '../../../src/dataflow'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool, RUnaryOpPool } from '../../helper/provider'

describe("A. Atomic dataflow information",
  withShell((shell) => {
    describe("0. uninteresting leafs", () => {
      for (const input of ["42", '"test"', "TRUE", "NA", "NULL"]) {
        assertDataflow(input, shell, input, new DataflowGraph())
      }
    })

    assertDataflow("1. simple variable", shell,
      "xylophone",
      new DataflowGraph().addNode("0", "xylophone")
    )

    // TODO: clean up numbers
    describe("2. unary operators", () => {
      let idx = 0
      for (const opSuite of RUnaryOpPool) {
        describe(`2.${++idx} ${opSuite.label} operations`, () => {
          for (const op of opSuite.pool) {
            const inputDifferent = `${op.str}x`
            assertDataflow(
              `${op.str}x`,
              shell,
              inputDifferent,
              new DataflowGraph().addNode("0", "x")
            )
          }
        })
      }
    })

    // TODO: these will be more interesting whenever we have more information on the edges (like modification etc.)
    describe("2b. non-assignment binary operators", () => {
      let idx = 0
      for (const opSuite of RNonAssignmentBinaryOpPool) {
        describe(`2.${++idx} ${opSuite.label}`, () => {
          let opIdx = 0
          for (const op of opSuite.pool) {
            describe(`2.${idx}.${++opIdx} ${op.str}`, () => {
              // TODO: some way to automatically retrieve the id if they are unique? || just allow to omit it?
              const inputDifferent = `x ${op.str} y`
              assertDataflow(
                `${inputDifferent} (different variables)`,
                shell,
                inputDifferent,
                new DataflowGraph().addNode("0", "x").addNode("1", "y")
              )

              const inputSame = `x ${op.str} x`
              assertDataflow(
                `${inputSame} (same variables)`,
                shell,
                inputSame,
                new DataflowGraph()
                  .addNode("0", "x")
                  .addNode("1", "x")
                  .addEdge("0", "1", "same-read-read", "always")
              )
            })
          }
        })
      }
    })

    describe("3. assignments", () => {
      let idx = 0
      for (const op of RAssignmentOpPool) {
        describe(`3.${++idx} ${op.str}`, () => {
          const scope = op.str.length > 2 ? GlobalScope : LocalScope // love it
          const swapSourceAndTarget = op.str === "->" || op.str === "->>"

          const constantAssignment = swapSourceAndTarget ? `5 ${op.str} x` : `x ${op.str} 5`
          assertDataflow(
            `${constantAssignment} (constant assignment)`,
            shell,
            constantAssignment,
            new DataflowGraph().addNode(
              swapSourceAndTarget ? "1" : "0",
              "x",
              scope
            )
          )

          const variableAssignment = `x ${op.str} y`
          const dataflowGraph = new DataflowGraph()
          if (swapSourceAndTarget) {
            dataflowGraph
              .addNode("0", "x")
              .addNode("1", "y", scope)
              .addEdge("1", "0", "defined-by", "always")
          } else {
            dataflowGraph
              .addNode("0", "x", scope)
              .addNode("1", "y")
              .addEdge("0", "1", "defined-by", "always")
          }
          assertDataflow(
            `${variableAssignment} (variable assignment)`,
            shell,
            variableAssignment,
            dataflowGraph
          )

          const circularAssignment = `x ${op.str} x`

          const circularGraph = new DataflowGraph()
          if (swapSourceAndTarget) {
            circularGraph
              .addNode("0", "x")
              .addNode("1", "x", scope)
              .addEdge("1", "0", "defined-by", "always")
          } else {
            circularGraph
              .addNode("0", "x", scope)
              .addNode("1", "x")
              .addEdge("0", "1", "defined-by", "always")
          }

          assertDataflow(
            `${circularAssignment} (circular assignment)`,
            shell,
            circularAssignment,
            circularGraph
          )
        })
      }
      describe(`3.${++idx} nested assignments`, () => {
        // TODO: dependency between x and y?
        assertDataflow(
          `3.${idx}.1 "x <- y <- 1"`,
          shell,
          "x <- y <- 1",
          new DataflowGraph()
            .addNode("0", "x", LocalScope)
            .addNode("1", "y", LocalScope)
            .addEdge("0", "1", "defined-by", "always")
        )
        assertDataflow(
          `3.${idx}.2 "1 -> x -> y"`,
          shell,
          "1 -> x -> y",
          new DataflowGraph()
            .addNode("1", "x", LocalScope)
            .addNode("3", "y", LocalScope)
            .addEdge("3", "1", "defined-by", "always")
        )
        // still by indirection (even though y is overwritten?) TODO: discuss that
        assertDataflow(
          `3.${idx}.3 "x <- 1 -> y"`,
          shell,
          "x <- 1 -> y",
          new DataflowGraph()
            .addNode("0", "x", LocalScope)
            .addNode("2", "y", LocalScope)
            .addEdge("0", "2", "defined-by", "always")
        )
        assertDataflow(
          `3.${idx}.1 "x <- y <- z"`,
          shell,
          "x <- y <- z",
          new DataflowGraph()
            .addNode("0", "x", LocalScope)
            .addNode("1", "y", LocalScope)
            .addNode("2", "z")
            .addEdge("0", "1", "defined-by", "always")
            .addEdge("1", "2", "defined-by", "always")
            .addEdge("0", "2", "defined-by", "always")
        )
      })
    })

    describe("4. if-then-else", () => {
      // spacing issues etc. are dealt with within the parser, however, braces are not allowed to introduce scoping artifacts
      let variant = 0
      for (const b of [
        { label: "without braces", func: (x: string) => `${x}` },
        { label: "with braces", func: (x: string) => `{ ${x} }` },
      ]) {
        describe(`4.${++variant} Variant ${b.label}`, () => {
          describe(`4.${variant}.1 if-then, no else`, () => {
            assertDataflow(
              `4.${variant}.1.1 completely constant`,
              shell,
              `if (TRUE) ${b.func("1")}`,
              new DataflowGraph()
            )
            assertDataflow(
              `4.${variant}.1.2 compare cond.`,
              shell,
              `if (x > 5) ${b.func("1")}`,
              new DataflowGraph().addNode("0", "x")
            )
            assertDataflow(
              `4.${variant}.1.3 compare cond. symbol in then`,
              shell,
              `if (x > 5) ${b.func("y")}`,
              new DataflowGraph().addNode("0", "x").addNode("3", "y")
            )
            assertDataflow(
              `4.${variant}.1.4 all variables`,
              shell,
              `if (x > y) ${b.func("z")}`,
              new DataflowGraph()
                .addNode("0", "x")
                .addNode("1", "y")
                .addNode("3", "z")
            )
            assertDataflow(
              `4.${variant}.1.5 all variables, some same`,
              shell,
              `if (x > y) ${b.func("x")}`,
              new DataflowGraph()
                .addNode("0", "x")
                .addNode("1", "y")
                .addNode("3", "x")
                .addEdge("0", "3", "same-read-read", "always")
            )
            assertDataflow(
              `4.${variant}.1.6 all same variables`,
              shell,
              `if (x > x) ${b.func("x")}`,
              new DataflowGraph()
                .addNode("0", "x")
                .addNode("1", "x")
                .addNode("3", "x")
                .addEdge("0", "1", "same-read-read", "always")
                // TODO: theoretically they just have to be connected
                .addEdge("0", "3", "same-read-read", "always")
            )
          })

          describe(`4.${variant}.2 if-then, with else`, () => {
            assertDataflow(
              `4.${variant}.2.1 completely constant`,
              shell,
              "if (TRUE) { 1 } else { 2 }",
              new DataflowGraph()
            )
            assertDataflow(
              `4.${variant}.2.2 compare cond.`,
              shell,
              "if (x > 5) { 1 } else { 42 }",
              new DataflowGraph().addNode("0", "x")
            )
            assertDataflow(
              `4.${variant}.2.3 compare cond. symbol in then`,
              shell,
              "if (x > 5) { y } else { 42 }",
              new DataflowGraph().addNode("0", "x").addNode("3", "y")
            )
            assertDataflow(
              `4.${variant}.2.4 compare cond. symbol in then & else`,
              shell,
              "if (x > 5) { y } else { z }",
              new DataflowGraph()
                .addNode("0", "x")
                .addNode("3", "y")
                .addNode("4", "z")
            )
            assertDataflow(
              `4.${variant}.2.4 all variables`,
              shell,
              "if (x > y) { z } else { a }",
              new DataflowGraph()
                .addNode("0", "x")
                .addNode("1", "y")
                .addNode("3", "z")
                .addNode("4", "a")
            )
            assertDataflow(
              `4.${variant}.2.5 all variables, some same`,
              shell,
              "if (y > x) { x } else { y }",
              new DataflowGraph()
                .addNode("0", "y")
                .addNode("1", "x")
                .addNode("3", "x")
                .addNode("4", "y")
                .addEdge("1", "3", "same-read-read", "always")
                .addEdge("0", "4", "same-read-read", "always")
            )
            assertDataflow(
              `4.${variant}.2.6 all same variables`,
              shell,
              "if (x > x) { x } else { x }",
              new DataflowGraph()
                .addNode("0", "x")
                .addNode("1", "x")
                .addNode("3", "x")
                .addNode("4", "x")
                // TODO: 0 is just hardcoded, they just have to be connected
                .addEdge("0", "1", "same-read-read", "always")
                .addEdge("0", "3", "same-read-read", "always")
                .addEdge("0", "4", "same-read-read", "always")
            )
          })
        })
      }
    })

    describe("5. for", () => {
      // TODO: support for vectors!
      assertDataflow(
        "5.1 simple constant for-loop",
        shell,
        `for(i in 1:10) { 1 }`,
        new DataflowGraph().addNode("0", "i", LocalScope)
      )
      assertDataflow(
        "5.1 using loop variable in body",
        shell,
        `for(i in 1:10) { i }`,
        new DataflowGraph()
          .addNode("0", "i", LocalScope)
          .addNode("4", "i")
          .addEdge("4", "0", "defined-by", "always")
      )
      // TODO: so many other tests... variable in sequence etc.
    })

    describe("6. repeat", () => {
      // TODO: detect that a x <- repeat/while/for/... assignment does not have influence on the lhs as repeat returns NULL?
      assertDataflow(
        "6.1 simple constant repeat",
        shell,
        `repeat 2`,
        new DataflowGraph()
      )
      assertDataflow(
        "6.2 using loop variable in body",
        shell,
        `repeat x`,
        new DataflowGraph().addNode("0", "x")
      )
      assertDataflow(
        "6.3 using loop variable in body",
        shell,
        `repeat { x <- 1 }`,
        new DataflowGraph().addNode("0", "x", LocalScope)
      )
      assertDataflow(
        "6.4 using variable in body",
        shell,
        `repeat { x <- y }`,
        new DataflowGraph()
          .addNode("0", "x", LocalScope)
          .addNode("1", "y")
          // TODO: always until encountered conditional break etc?
          .addEdge("0", "1", "defined-by", "always" /* TODO: maybe ? */)
      )
      // TODO: so many other tests... variable in sequence etc.
    })
    describe("6. while", () => {
      assertDataflow(
        "6.1 simple constant while",
        shell,
        `while (TRUE) 2`,
        new DataflowGraph()
      )
      assertDataflow(
        "6.2 using variable in body",
        shell,
        `while (TRUE) x`,
        new DataflowGraph().addNode("1", "x")
      )
      assertDataflow(
        "6.3 assignment in loop body",
        shell,
        `while (TRUE) { x <- 3 }`,
        new DataflowGraph().addNode("1", "x", LocalScope)
      )
      /* TODO: support
    assertDataflow('6.4 def compare in loop', shell, `while ((x <- x - 1) > 0) { x }`,
      new DataflowGraph().addNode('1', 'x', LOCAL_SCOPE).addNode('2', 'x')
        .addNode('3', 'x')
        // .addEdge('0', '1', 'defined-by', 'always')
    )
    */
    })
  })
)
