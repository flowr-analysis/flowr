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
