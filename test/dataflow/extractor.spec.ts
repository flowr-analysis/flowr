// TODO: get def-usage for every line
import { describeSession, retrieveAst } from '../helper/shell'
import { decorateWithDataFlowInfo } from '../../src/dataflow/extractor'

describe('Extract Dataflow Information', () => {
  describeSession('1. atomic dataflow information', (shell) => {
    it('1.1 def for constant variable assignment', async () => {
      const ast = await retrieveAst(shell, `
        a <- x
        b <- a + c
        d <- a + b
      `)
      const { decoratedAst, dataflowIdMap, dataflowGraph } = decorateWithDataFlowInfo(ast)

      // console.log(JSON.stringify(decoratedAst), dataflowIdMap)
      console.log('flowchart LR')
      /* dataflowGraph.nodes.forEach(node => {
        console.log(`${node.id}([${node.name}])`)
      }) */
      dataflowGraph.edges.forEach((targets, source) => {
        targets.forEach(target => {
          console.log(`${source} --> ${target}`)
        })
      })
    })
  })
})
