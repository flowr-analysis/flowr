// TODO: get def-usage for every line
import { assertDataflow, describeSession, retrieveAst } from '../helper/shell'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateWithIds, deterministicCountingIdGenerator, IdType } from '../../src/dataflow/id'
import type * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { decorateWithParentInformation } from '../../src/dataflow/parents'
import { DataflowGraph, DataflowGraphEdge, graphToMermaidUrl } from '../../src/dataflow/graph'
import { assert } from 'chai'
import { RNonAssignmentBinaryOpPool } from "../helper/provider"


describe('Extract Dataflow Information', () => {
  describeSession('1. atomic dataflow information', (shell) => {
    assertDataflow('1. simple variable', shell, 'x',
      new DataflowGraph().addNode('0', 'x')
    )

    // TODO: these will be more interesting whenever we have more information on the edges (like modification etc.)
    describe('2. binary operators', () => {
      let idx = 0
      for(const opSuite of RNonAssignmentBinaryOpPool) {
        describe(`2.${++idx} ${opSuite.label}`, () => {
          let opIdx = 0
          for(const op of opSuite.pool) {
            describe(`2.${idx}.${++opIdx} ${op.str}`, () => {
              // TODO: some way to automatically retrieve the id if they are unique? || just allow to omit it?
              assertDataflow('different variables', shell, `x ${op.str} y`,
                new DataflowGraph().addNode('0', 'x').addNode('1', 'y'))

              assertDataflow('same variables', shell, `x ${op.str} x`,
                new DataflowGraph().addNode('0', 'x').addNode('1', 'x')
                  .addEdge('0', '1', 'same-read-read', 'always')
              )
            })
          }
        })
      }
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
  })
})
