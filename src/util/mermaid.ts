import { NoInfo } from '../r-bridge'
import { SourceRange } from './range'
import { DataflowGraph, DataflowGraphEdgeAttribute, DataflowMap, DataflowScopeName } from '../dataflow'

export function formatRange(range: SourceRange | undefined): string {
  if (range === undefined) {
    return '??'
  }

  return `${range.start.line}.${range.start.column}-${range.end.line}.${range.end.column}`
}

function definedAtPositionToMermaid(definedAtPosition: DataflowScopeName | false, when: DataflowGraphEdgeAttribute): string {
  const whenText = when === 'always' ? '' : `, ${when}`
  if (definedAtPosition === false) {
    return whenText
  }
  return `, <i>${definedAtPosition.replace('<', '&lt;')}${whenText}</i>`
}

// TODO: sub-graphs for functions etc.?
export function graphToMermaid(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix = 'flowchart TD', idPrefix = ''): string {
  const lines = [prefix]
  for (const [id, info] of graph.entries()) {
    const def = info.definedAtPosition !== false
    const defText = definedAtPositionToMermaid(info.definedAtPosition, info.when)
    const open = def ? '[' : '(['
    const close = def ? ']' : '])'
    lines.push(`    ${idPrefix}${id}${open}"\`${info.name} (${id}${defText})\n      *${formatRange(dataflowIdMap?.get(id)?.location)}*\`"${close}`)
    for (const edge of info.edges) {
      const sameEdge = edge.type === 'same-def-def' || edge.type === 'same-read-read'
      lines.push(`    ${idPrefix}${id} ${sameEdge ? '-.-' : '-->'}|"${edge.type} (${edge.attribute})"| ${idPrefix}${edge.target}`)
    }
  }
  return lines.join('\n')
}

/**
 * Converts mermaid code (potentially produced by {@link graphToMermaid}) to an url that presents the graph in the mermaid editor.
 *
 * @param code - code to convert
 */
export function mermaidCodeToUrl(code: string): string {
  const obj = {
    code,
    mermaid: {
      'theme': 'default'
    },
    updateEditor:  false,
    autoSync:      true,
    updateDiagram: false
  }
  return `https://mermaid.live/edit#base64:${Buffer.from(JSON.stringify(obj)).toString('base64')}`
}

// graphToMermaidUrl
export function graphToMermaidUrl(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo>): string {
  return mermaidCodeToUrl(graphToMermaid(graph, dataflowIdMap))
}

export interface LabeledDiffGraph {
  label: string
  graph: DataflowGraph
}

/** uses same id map but ensures, it is different from the rhs so that mermaid can work with that */
export function diffGraphsToMermaid(left: LabeledDiffGraph, right: LabeledDiffGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix: string): string {
  // we add the prefix ourselves
  const leftGraph = graphToMermaid(left.graph, dataflowIdMap, '', `l-${left.label}`)
  const rightGraph = graphToMermaid(right.graph, dataflowIdMap, '', `r-${right.label}`)

  return `${prefix}flowchart TD\nsubgraph "${left.label}"\n${leftGraph}\nend\nsubgraph "${right.label}"\n${rightGraph}\nend`
}

export function diffGraphsToMermaidUrl(left: LabeledDiffGraph, right: LabeledDiffGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix: string): string {
  return mermaidCodeToUrl(diffGraphsToMermaid(left, right, dataflowIdMap, prefix))
}
