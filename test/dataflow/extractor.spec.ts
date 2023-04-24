// TODO: get def-usage for every line
import { assertDataflow, describeSession, retrieveAst } from '../helper/shell'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateWithIds, deterministicCountingIdGenerator, IdType } from '../../src/dataflow/id'
import type * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { decorateWithParentInformation } from '../../src/dataflow/parents'
import { DataflowGraphEdge, graphToMermaidUrl } from '../../src/dataflow/graph'
import { assert } from 'chai'


describe('Extract Dataflow Information', () => {
  describeSession('1. atomic dataflow information', (shell) => {
    assertDataflow('1. simple variable', shell, 'x', {
      nodes: [ { id: '0', name: 'x' } ],
      edges: new Map<IdType, DataflowGraphEdge[]>()
    })

    // TODO: these will be more interesting whenever we have more information on the edges (like modification etc.)
    describe('2. binary operators', () => {
      describe('2.1. addition', () => {
        // TODO: some way to automatically retrieve the id if they are unique? || just allow to omit it?
        assertDataflow('2.1. different variables', shell, 'x + y', {
          nodes: [{
            id:   '0',
            name: 'x'
          }, {
            id:   '1',
            name: 'y'
          }],
          edges: new Map<IdType, DataflowGraphEdge[]>()
        })

        assertDataflow('2.2. same variables', shell, 'x + x', {
          nodes: [{
            id:   '0',
            name: 'x'
          }, {
            id:   '1',
            name: 'x'
          }],
          // TODO: allow to specify same edges etc. independent of their direction
          edges: new Map<IdType, DataflowGraphEdge[]>()
        })
      })
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
