// TODO: get def-usage for every line
import { describeSession, retrieveAst } from '../helper/shell'
import { produceDataFlowGraph } from '../../src/dataflow/extractor'
import { decorateWithIds } from '../../src/dataflow/id'
import type * as Lang from '../../src/r-bridge/lang:4.x/ast/model'
import { decorateWithParentInformation } from '../../src/dataflow/parents'

function formatRange(range: Lang.Range | undefined): string {
  if (range === undefined) {
    return '??'
  }

  return `${range.start.line}.${range.start.column}-${range.end.line}.${range.end.column}`
}

describe('Extract Dataflow Information', () => {
  describeSession('1. atomic dataflow information', (shell) => {
    it('1.1 def for constant variable assignment', async () => {
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
      // TODO: subgraphs?
      console.log('flowchart LR')
      dataflowGraph.nodes.forEach(node => {
        console.log(`    ${node.id}(["\`${node.name}\n      *${formatRange(dataflowIdMap.get(node.id)?.location)}*\`"])`)
      })
      dataflowGraph.edges.forEach((targets, source) => {
        targets.forEach(to => {
          console.log(`    ${source} ${to.type === 'same-def-def' || to.type === 'same-read-read' ? '-.-' : '-->'}|"${to.type} (${to.attribute})"| ${to.target}`)
        })
      })
    })
  })
})
