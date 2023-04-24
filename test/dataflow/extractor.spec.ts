// TODO: get def-usage for every line
import { assertDataflow, describeSession, retrieveAst } from '../helper/shell'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateWithIds } from '../../src/dataflow/id'
import { decorateWithParentInformation } from '../../src/dataflow/parents'
import { DataflowGraph, GLOBAL_SCOPE, graphToMermaidUrl, LOCAL_SCOPE } from '../../src/dataflow/graph'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool } from "../helper/provider"
import { naiveLineBasedSlicing } from "../../src/slicing/static/static-slicer"


describe('Extract Dataflow Information', () => {
  describeSession('A. atomic dataflow information', (shell) => {
    describe('0. uninteresting leafs', () => {
      for(const input of ['42', '"test"', 'TRUE', 'NA', 'NULL']) {
        assertDataflow(input, shell, input, new DataflowGraph())
      }
    })

    assertDataflow('1. simple variable', shell, 'xylophon', new DataflowGraph().addNode('0', 'xylophon'))

    // TODO: these will be more interesting whenever we have more information on the edges (like modification etc.)
    describe('2. non-assignment binary operators', () => {
      let idx = 0
      for(const opSuite of RNonAssignmentBinaryOpPool) {
        describe(`2.${++idx} ${opSuite.label}`, () => {
          let opIdx = 0
          for(const op of opSuite.pool) {
            describe(`2.${idx}.${++opIdx} ${op.str}`, () => {
              // TODO: some way to automatically retrieve the id if they are unique? || just allow to omit it?
              const inputDifferent = `x ${op.str} y`
              assertDataflow(`${inputDifferent} (diff. variables)`, shell, inputDifferent,
                new DataflowGraph().addNode('0', 'x').addNode('1', 'y'))

              const inputSame = `x ${op.str} x`
              assertDataflow(`${inputSame} (same variables)`, shell, inputSame,
                new DataflowGraph().addNode('0', 'x').addNode('1', 'x')
                  .addEdge('0', '1', 'same-read-read', 'always')
              )
            })
          }
        })
      }
    })

    describe('3. assignments', () => {
      // TODO: for all assignment ops!
      for(const op of RAssignmentOpPool) {
        let idx = 0
        describe(`3.${++idx} ${op.str}`, () => {
          const scope = op.str.length > 2 ? GLOBAL_SCOPE : LOCAL_SCOPE // love it
          const swapSourceAndTarget = op.str === '->' || op.str === '->>'

          const constantAssignment = swapSourceAndTarget ? `5 ${op.str} x` : `x ${op.str} 5`
          assertDataflow(`${constantAssignment} (constant assignment)`, shell, constantAssignment,
            new DataflowGraph().addNode(swapSourceAndTarget ? '1' : '0', 'x', scope)
          )

          const variableAssignment = `x ${op.str} y`
          const dataflowGraph = new DataflowGraph()
          if(swapSourceAndTarget) {
            dataflowGraph.addNode('0', 'x').addNode('1', 'y', scope)
              .addEdge('1', '0', 'defined-by', 'always')
          } else {
            dataflowGraph.addNode('0', 'x',scope).addNode('1', 'y')
              .addEdge('0', '1', 'defined-by', 'always')
          }
          assertDataflow(`${variableAssignment} (variable assignment)`, shell, variableAssignment, dataflowGraph)

          const circularAssignment = `x ${op.str} x`

          const circularGraph = new DataflowGraph()
          if(swapSourceAndTarget) {
            circularGraph.addNode('0', 'x').addNode('1', 'x', scope)
              .addEdge('1', '0', 'defined-by', 'always')
          } else {
            circularGraph.addNode('0', 'x', scope).addNode('1', 'x')
              .addEdge('0', '1', 'defined-by', 'always')
          }

          assertDataflow(`${circularAssignment} (circular assignment)`, shell, circularAssignment, circularGraph)
        })
      }
    })

    describe('4. if-then-else', () => {
      // spacing issues etc. are dealt with within the parser, however, braces are not allowed to introduce scoping artifacts
      let variant = 0
      for(const b of [ { label: 'without braces', func: (x: string) => `${x}` }, { label: 'with braces', func: (x: string) => `{ ${x} }` }]) {
        describe(`4.${++variant} Variant ${b.label}`, () => {
          describe(`4.${variant}.1 if-then, no else`, () => {
            assertDataflow(`4.${variant}.1.1 completely constant`, shell, `if (TRUE) ${b.func('1')}`,
              new DataflowGraph()
            )
            assertDataflow(`4.${variant}.1.2 compare cond.`, shell, `if (x > 5) ${b.func('1')}`,
              new DataflowGraph().addNode('0', 'x')
            )
            assertDataflow(`4.${variant}.1.3 compare cond. symbol in then`, shell, `if (x > 5) ${b.func('y')}`,
              new DataflowGraph().addNode('0', 'x').addNode('3', 'y')
            )
            assertDataflow(`4.${variant}.1.4 all variables`, shell, `if (x > y) ${b.func('z')}`,
              new DataflowGraph().addNode('0', 'x').addNode('1', 'y').addNode('3', 'z')
            )
            assertDataflow(`4.${variant}.1.5 all variables, some same`, shell, `if (x > y) ${b.func('x')}`,
              new DataflowGraph().addNode('0', 'x').addNode('1', 'y').addNode('3', 'x')
                .addEdge('0', '3', 'same-read-read', 'always')
            )
            assertDataflow(`4.${variant}.1.6 all same variables`, shell, `if (x > x) ${b.func('x')}`,
              new DataflowGraph().addNode('0', 'x').addNode('1', 'x').addNode('3', 'x')
                .addEdge('0', '1', 'same-read-read', 'always')
              // TODO: theoretically they just have to be connected
                .addEdge('0', '3', 'same-read-read', 'always')
            )
          })

          describe(`4.${variant}.2 if-then, with else`, () => {
            assertDataflow(`4.${variant}.2.1 completely constant`, shell, 'if (TRUE) { 1 } else { 2 }',
              new DataflowGraph()
            )
            assertDataflow(`4.${variant}.2.2 compare cond.`, shell, 'if (x > 5) { 1 } else { 42 }',
              new DataflowGraph().addNode('0', 'x')
            )
            assertDataflow(`4.${variant}.2.3 compare cond. symbol in then`, shell, 'if (x > 5) { y } else { 42 }',
              new DataflowGraph().addNode('0', 'x').addNode('3', 'y')
            )
            assertDataflow(`4.${variant}.2.4 compare cond. symbol in then & else`, shell, 'if (x > 5) { y } else { z }',
              new DataflowGraph().addNode('0', 'x').addNode('3', 'y').addNode('4', 'z')
            )
            assertDataflow(`4.${variant}.2.4 all variables`, shell, 'if (x > y) { z } else { a }',
              new DataflowGraph().addNode('0', 'x').addNode('1', 'y').addNode('3', 'z').addNode('4', 'a')
            )
            assertDataflow(`4.${variant}.2.5 all variables, some same`, shell, 'if (y > x) { x } else { y }',
              new DataflowGraph().addNode('0', 'y').addNode('1', 'x').addNode('3', 'x').addNode('4', 'y')
                .addEdge('1', '3', 'same-read-read', 'always')
                .addEdge('0', '4', 'same-read-read', 'always')
            )
            assertDataflow(`4.${variant}.2.6 all same variables`, shell, 'if (x > x) { x } else { x }',
              new DataflowGraph().addNode('0', 'x').addNode('1', 'x').addNode('3', 'x').addNode('4', 'x')
              // TODO: 0 is just hardcoded, they just have to be connected
                .addEdge('0', '1', 'same-read-read', 'always')
                .addEdge('0', '3', 'same-read-read', 'always')
                .addEdge('0', '4', 'same-read-read', 'always')
            )
          })
        })
      }
    })

    describe('5. for', () => {
      // TODO: support for vectors!
      assertDataflow('5.1 simple constant for-loop', shell, `for(i in 1:10) { 1 }`,
        new DataflowGraph().addNode('0', 'i', LOCAL_SCOPE)
      )
      assertDataflow('5.1 using loop variable in body', shell, `for(i in 1:10) { i }`,
        new DataflowGraph().addNode('0', 'i', LOCAL_SCOPE).addNode('4', 'i')
          .addEdge('4', '0', 'defined-by', 'always')
      )
      // TODO: so many other tests... variable in sequence etc.
    })

    it('99. def for constant variable assignment', async () => {
      const ast = await retrieveAst(shell, `
        a <- 3
        a <- x * m
        if(m > 3) {
          a <- 5
        }

        m <- 5
        b <- a + c
        d <- a + b
      `)
      const astWithId = decorateWithIds(ast)
      const astWithParentIds = decorateWithParentInformation(astWithId.decoratedAst)
      const { dataflowIdMap, dataflowGraph } = produceDataFlowGraph(astWithParentIds)

      // console.log(JSON.stringify(decoratedAst), dataflowIdMap)
      console.log(graphToMermaidUrl(dataflowGraph, dataflowIdMap))
    })

    it('100. the classic', async () => {
      const ast = await retrieveAst(shell, `
          sum <- 0
          product <- 1
          w <- 7
          N <- 10
          
          for (i in 1:(N-1)) {
            sum <- sum + i + w
            product <- product * i
          }
          
          # TODO: currently not available :/
          # cat("Sum:", sum, "\\n")
          # cat("Product:", product, "\\n")
      `)
      const astWithId = decorateWithIds(ast)
      const astWithParentIds = decorateWithParentInformation(astWithId.decoratedAst)
      const {dataflowIdMap, dataflowGraph} = produceDataFlowGraph(astWithParentIds)

      // console.log(JSON.stringify(decoratedAst), dataflowIdMap)
      console.log(graphToMermaidUrl(dataflowGraph, dataflowIdMap))

      // i know we do not want to slice, but let's try as a quick demo:
      console.log([...naiveLineBasedSlicing(dataflowGraph, dataflowIdMap,'18')].sort().join(','))
      console.log([...naiveLineBasedSlicing(dataflowGraph, dataflowIdMap,'25')].sort().join(','))
    })
  })
})
