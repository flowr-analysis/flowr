// TODO: get def-usage for every line
import { assertDataflow, describeSession, retrieveAst } from '../helper/shell'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateWithIds } from '../../src/dataflow/id'
import { decorateWithParentInformation } from '../../src/dataflow/parents'
import { DataflowGraph, graphToMermaidUrl } from '../../src/dataflow/graph'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool } from "../helper/provider"


describe('Extract Dataflow Information', () => {
  describeSession('1. atomic dataflow information', (shell) => {
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
          const constantAssignment = `x ${op.str} 5`
          assertDataflow(`${constantAssignment} (constant assignment)`, shell, constantAssignment,
            new DataflowGraph().addNode('0', 'x')
          )

          const variableAssignment = `x ${op.str} y`
          const dataflowGraph = new DataflowGraph().addNode('0', 'x').addNode('1', 'y')
          if(op.str === '->' || op.str === '->>') {
            dataflowGraph.addEdge('1', '0', 'defined-by', 'always')
          } else {
            dataflowGraph.addEdge('0', '1', 'defined-by', 'always')
          }
          assertDataflow(`${variableAssignment} (variable assignment)`, shell, variableAssignment, dataflowGraph)

          const circularAssignment = `x ${op.str} x`

          const circularGraph = new DataflowGraph().addNode('0', 'x').addNode('1', 'x')
            .addEdge('0', '1', 'same-read-read', 'always')
          if(op.str === '->' || op.str === '->>') {
            circularGraph.addEdge('1', '0', 'defined-by', 'always')
          } else {
            circularGraph.addEdge('0', '1', 'defined-by', 'always')
          }
          assertDataflow(`${circularAssignment} (circular assignment)`, shell, circularAssignment, circularGraph)
        })
      }
    })

    // if then else
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
  })
})
