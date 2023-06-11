import { NodeId, NoInfo } from '../r-bridge'
import { SourceRange } from './range'
import {
  DataflowFunctionFlowInformation,
  DataflowGraph,
  DataflowGraphEdgeAttribute,
  DataflowMap,
  DataflowScopeName, IEnvironment
} from '../dataflow'

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
  return `, *${definedAtPosition.replace('<', '#lt;')}${whenText}*`
}

function stylesForDefinitionKindsInEnvironment(subflow: DataflowFunctionFlowInformation, lines: string[], idPrefix: string) {
  // TODO: highlight seems to be often wrong
  let current: IEnvironment | undefined = subflow.environments.current
  while (current !== undefined) {
    console.log("At environment", current)
    for (const definitions of current.memory.values()) {
      for (const definition of definitions) {
        if (definition.kind === 'argument') {
          // parameters
          lines.push(`style ${idPrefix}${definition.nodeId} fill:#CDCDCD,stroke:#242424\n `)
        } else if (definition.kind === 'function') {
          // functions
          lines.push(`style ${idPrefix}${definition.nodeId} fill:#FFF,stroke:#9370DB\n `)
        }
      }
    }
    current = current.parent
  }
}

function subflowToMermaid(nodeId: NodeId, subflow: DataflowFunctionFlowInformation | undefined, dataflowIdMap: DataflowMap<NoInfo> | undefined, lines: string[], idPrefix = ''): void {
  if(subflow === undefined) {
    return
  }
  const subflowId = `${idPrefix}flow-${nodeId}`
  lines.push(`subgraph "${subflowId}" [function ${nodeId}]\n`)
  lines.push(graphToMermaid(subflow.graph, dataflowIdMap, '', idPrefix))
  for(const out of [...subflow.in, ...subflow.out, ...subflow.activeNodes]) {
    // in/out/active
    lines.push(`style ${idPrefix}${out.nodeId} fill:#94C2FF,stroke:#4CB0DB\n `)
  }
  stylesForDefinitionKindsInEnvironment(subflow, lines, idPrefix)
  lines.push('end')
  lines.push(`${idPrefix}${nodeId} ---|function| ${subflowId}\n`)
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
    subflowToMermaid(id, info.subflow, dataflowIdMap, lines, idPrefix)
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
