import { retrieveAst, withShell } from '../../helper/shell'
import { decorateAst, NodeId } from '../../../src/r-bridge'
import {
  DataflowGraphNodeInfo,
  formatRange,
  graphToMermaidUrl,
  LocalScope,
  produceDataFlowGraph
} from '../../../src/dataflow'
import { naiveLineBasedSlicing } from '../../../src/slicing/static'
import { SourceRange } from '../../../src/util/range'

describe("Others",
  withShell((shell) => {
    it("def for constant variable assignment", async() => {
      const ast = await retrieveAst(
        shell,
        `
        a <- 3
        a <- x * m
        if(m > 3) {
          a <- 5
        }

        m <- 5
        b <- a + c
        d <- a + b
      `
      )
      const decorated = decorateAst(ast)

      const { graph } = produceDataFlowGraph(decorated, LocalScope)
      // console.log(JSON.stringify(decoratedAst), dataflowIdMap)
      console.log(graphToMermaidUrl(graph, decorated.idMap))
    })

    it("the classic", async() => {
      const code = `
          sum <- 0
          product <- 1
          w <- 7
          N <- 10
          
          for (i in 1:(N-1)) {
            sum <- sum + i + w
            product <- product * i
          }
          
          cat("Sum:", sum, "\\n")
          cat("Product:", product, "\\n")
      `
      const ast = await retrieveAst(shell, code)
      const decorated = decorateAst(ast)
      const { graph } = produceDataFlowGraph(decorated, LocalScope)

      // console.log(JSON.stringify(decoratedAst), dataflowIdMap)
      console.log(graphToMermaidUrl(graph, decorated.idMap))

      // I know we do not want to slice, but let's try as a quick demo:

      const print = (id: NodeId): void => {
        const nodeInfo = graph.get(id) as DataflowGraphNodeInfo
        const nodePosition = decorated.idMap.get(id)?.location as SourceRange
        console.log(
          `Static backward slice for id ${id}: ${
            nodeInfo.name
          } (${formatRange(nodePosition)})`
        )
        const lines = [
          ...naiveLineBasedSlicing(graph, decorated.idMap, id),
        ].sort()
        code.split("\n").map((line, index) => {
          if (lines.includes(index + 1)) {
            console.log(`[${index + 1}]\t ${line}`)
          }
        })
        console.log(
          "=====================================================\n"
        )
      }

      print("18")
      print("25")
      // TODO: 34
    })
  })
)
