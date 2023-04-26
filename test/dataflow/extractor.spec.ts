// TODO: get def-usage for every line
import { assertDataflow, describeSession, retrieveAst } from '../helper/shell'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateWithIds, IdType } from '../../src/dataflow/id'
import { decorateWithParentInformation, RNodeWithParent } from '../../src/dataflow/parents'
import {
  DataflowGraph,
  DataflowGraphNodeInfo,
  formatRange,
  GLOBAL_SCOPE,
  graphToMermaidUrl,
  LOCAL_SCOPE
} from '../../src/dataflow/graph'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool } from '../helper/provider'
import { naiveLineBasedSlicing } from '../../src/slicing/static/static-slicer'
import { NoInfo } from '../../src/r-bridge/lang:4.x/ast/model'

describe('Extract Dataflow Information', () => {
  /**
   * Here we cover dataflow extraction for atomic statements (no expression lists).
   * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
   * This will not include functions!
   */
  describeSession('A. atomic dataflow information', shell => {
    describe('0. uninteresting leafs', () => {
      for(const input of ['42', '"test"', 'TRUE', 'NA', 'NULL']) {
        assertDataflow(input, shell, input, new DataflowGraph())
      }
    })

    assertDataflow('1. simple variable', shell, 'xylophone', new DataflowGraph().addNode('0', 'xylophone'))

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
              assertDataflow(`${inputDifferent} (different variables)`, shell, inputDifferent,
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
      let idx = 0
      for(const op of RAssignmentOpPool) {
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
      describe(`3.${++idx} nested assignments`, () => {
        // TODO: dependency between x and y?
        assertDataflow(`3.${idx}.1 "x <- y <- 1"`, shell, 'x <- y <- 1',
          new DataflowGraph().addNode('0', 'x', LOCAL_SCOPE).addNode('1', 'y', LOCAL_SCOPE)
            .addEdge('0', '1', 'defined-by', 'always')
        )
        assertDataflow(`3.${idx}.2 "1 -> x -> y"`, shell, '1 -> x -> y',
          new DataflowGraph().addNode('1', 'x', LOCAL_SCOPE).addNode('3', 'y', LOCAL_SCOPE)
            .addEdge('3', '1', 'defined-by', 'always')
        )
        // still by indirection (even though y is overwritten?) TODO: discuss that
        assertDataflow(`3.${idx}.3 "x <- 1 -> y"`, shell, 'x <- 1 -> y',
          new DataflowGraph().addNode('0', 'x', LOCAL_SCOPE).addNode('2', 'y', LOCAL_SCOPE)
            .addEdge('0', '2', 'defined-by', 'always')
        )
        assertDataflow(`3.${idx}.1 "x <- y <- z"`, shell, 'x <- y <- z',
          new DataflowGraph().addNode('0', 'x', LOCAL_SCOPE).addNode('1', 'y', LOCAL_SCOPE).addNode('2', 'z')
            .addEdge('0', '1', 'defined-by', 'always').addEdge('1', '2', 'defined-by', 'always')
            .addEdge('0', '2', 'defined-by', 'always')
        )
      })
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
  })

  describeSession('B. Working with expression lists', shell => {
    describe('0. Lists without variable references ', () => {
      let idx = 0
      for(const b of ['1\n2\n3', '1;2;3', '{ 1 + 2 }\n{ 3 * 4 }']) {
        assertDataflow(`0.${idx++} ${JSON.stringify(b)}`, shell, b, new DataflowGraph() )
      }
    })

    describe('1. Lists with variable references', () => {
      describe(`1.1 read-read same variable`, () => {
        const sameGraph = (id1: IdType, id2: IdType) => new DataflowGraph()
          .addNode(id1, 'x').addNode(id2, 'x').addEdge(id1, id2, 'same-read-read', 'always')
        assertDataflow(`1.1.1 directly together`, shell, 'x\nx', sameGraph('0', '1'))
        assertDataflow(`1.1.2 surrounded by uninteresting elements`, shell, '3\nx\n1\nx\n2', sameGraph('1', '3'))
        assertDataflow(`1.1.3 using braces`, shell, '{ x }\n{{ x }}', sameGraph('0', '1'))
        assertDataflow(`1.1.4 using braces and uninteresting elements`, shell, '{ x + 2 }; 4 - { x }', sameGraph('0', '4'))

        assertDataflow(`1.1.5 multiple occurrences of same variable`, shell, 'x\nx\n3\nx', new DataflowGraph()
          .addNode('0', 'x').addNode('1', 'x').addNode('3', 'x')
          .addEdge('0', '1', 'same-read-read', 'always')
          .addEdge('0', '3', 'same-read-read', 'always'))
      })
      describe('1.2 def-def same variable', () => {
        const sameGraph = (id1: IdType, id2: IdType) => new DataflowGraph()
          .addNode(id1, 'x', LOCAL_SCOPE).addNode(id2, 'x', LOCAL_SCOPE).addEdge(id1, id2, 'same-def-def', 'always')
        assertDataflow(`1.2.1 directly together`, shell, 'x <- 1\nx <- 2', sameGraph('0', '3'))
        assertDataflow(`1.2.2 directly together with mixed sides`, shell, '1 -> x\nx <- 2', sameGraph('1', '3'))
        assertDataflow(`1.2.3 surrounded by uninteresting elements`, shell, '3\nx <- 1\n1\nx <- 3\n2', sameGraph('1', '5'))
        assertDataflow(`1.2.4 using braces`, shell, '{ x <- 42 }\n{{ x <- 50 }}', sameGraph('0', '3'))
        assertDataflow(`1.2.5 using braces and uninteresting elements`, shell, '5; { x <- 2 }; 17; 4 -> x; 9', sameGraph('1', '6'))

        assertDataflow(`1.2.6 multiple occurrences of same variable`, shell, 'x <- 1\nx <- 3\n3\nx <- 9', new DataflowGraph()
          .addNode('0', 'x', LOCAL_SCOPE).addNode('3', 'x', LOCAL_SCOPE).addNode('7', 'x', LOCAL_SCOPE)
          .addEdge('0', '3', 'same-def-def', 'always')
          .addEdge('3', '7', 'same-def-def', 'always'))
      })
      describe('1.3 def followed by read', () => {
        const sameGraph = (id1: IdType, id2: IdType) => new DataflowGraph()
          .addNode(id1, 'x', LOCAL_SCOPE).addNode(id2, 'x').addEdge(id2, id1, 'read', 'always')
        assertDataflow(`1.3.1 directly together`, shell, 'x <- 1\nx', sameGraph('0', '3'))
        assertDataflow(`1.3.2 surrounded by uninteresting elements`, shell, '3\nx <- 1\n1\nx\n2', sameGraph('1', '5'))
        assertDataflow(`1.3.3 using braces`, shell, '{ x <- 1 }\n{{ x }}', sameGraph('0', '3'))
        assertDataflow(`1.3.4 using braces and uninteresting elements`, shell, '{ x <- 2 }; 5; x', sameGraph('0', '4'))
        assertDataflow(`1.3.5 redefinition links correctly`, shell, 'x <- 2; x <- 3; x', sameGraph('3', '6').addNode('0', 'x', LOCAL_SCOPE)
          .addEdge('0', '3', 'same-def-def', 'always'))
        assertDataflow(`1.3.6 multiple redefinition with circular definition`, shell, 'x <- 2; x <- x; x', new DataflowGraph()
          .addNode('0', 'x', LOCAL_SCOPE).addNode('3', 'x', LOCAL_SCOPE)
          .addNode('4', 'x').addNode('6', 'x')
          .addEdge('4', '0', 'read', 'always')
          .addEdge('3', '4', 'defined-by', 'always')
          .addEdge('0', '3', 'same-def-def', 'always')
          .addEdge('6', '3', 'read', 'always')
        )
      })
    })

    describe('2. Lists with if-then constructs', () => {
      describe(`2.1 reads within if`, () => {
        let idx = 0
        for(const b of [{ label: 'without else', text: ''}, {label: 'with else', text: ' else { 1 }'}]) {
          describe(`2.1.${++idx} ${b.label}`, () => {
            assertDataflow(`2.1.${idx}.1 read previous def in cond`, shell, `x <- 2\n if(x) { 1 } ${b.text}`,
              new DataflowGraph().addNode('0', 'x', LOCAL_SCOPE).addNode('3', 'x')
                .addEdge('3', '0', 'read', 'always')
            )
            assertDataflow(`2.1.${idx}.2 read previous def in then`, shell, `x <- 2\n if(TRUE) { x } ${b.text}`,
              new DataflowGraph().addNode('0', 'x', LOCAL_SCOPE).addNode('4', 'x')
                .addEdge('4', '0', 'read', 'maybe')
            )
          })
        }
        assertDataflow(`2.1.${++idx}. read previous def in else`, shell, 'x <- 2\n if(TRUE) { 42 } else { x }',
          new DataflowGraph().addNode('0', 'x', LOCAL_SCOPE).addNode('5', 'x')
            .addEdge('5', '0', 'read', 'maybe')
        )
        // TODO: others like same-read-read?
      })
      describe('2.2 write within if', () => {
        let idx = 0
        for(const b of [{ label: 'without else', text: ''}, {label: 'with else', text: ' else { 1 }'}]) {
          describe(`2.1.${++idx} ${b.label}`, () => {
            assertDataflow(`2.2.1 directly together`, shell, 'if(TRUE) { x <- 2 }\n x',
              new DataflowGraph().addNode('1', 'x', LOCAL_SCOPE).addNode('5', 'x')
                .addEdge('5', '1', 'read', 'maybe')
            )
          })
        }
      })
    })
  })

  describeSession('others', shell => {

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
      const code = `
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
      `
      const ast = await retrieveAst(shell, code)
      const astWithId = decorateWithIds(ast)
      const astWithParentIds = decorateWithParentInformation(astWithId.decoratedAst)
      const {dataflowIdMap, dataflowGraph} = produceDataFlowGraph(astWithParentIds)

      // console.log(JSON.stringify(decoratedAst), dataflowIdMap)
      console.log(graphToMermaidUrl(dataflowGraph, dataflowIdMap))

      // I know we do not want to slice, but let's try as a quick demo:

      const print = (id: IdType): void => {
        const nodeInfo = dataflowGraph.get(id) as DataflowGraphNodeInfo
        const nodePosition = (dataflowIdMap.get(id) as RNodeWithParent<NoInfo>).location
        console.log(`Static backward slice for id ${id}: ${nodeInfo.name} (${formatRange(nodePosition)})`)
        const lines = [...naiveLineBasedSlicing(dataflowGraph, dataflowIdMap,id)].sort()
        code.split('\n').map((line, index) => {
          if (lines.includes(index+1)) {
            console.log(`${[index+1]}\t ${line}`)
          }
        })
        console.log('=====================================================\n')
      }

      print('18')
      print('25')
    })
  })
})
