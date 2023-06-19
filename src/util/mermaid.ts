import { NodeId, NoInfo } from '../r-bridge'
import { SourceRange } from './range'
import {
  DataflowFunctionFlowInformation,
  DataflowGraph,
  DataflowGraphEdgeAttribute,
  DataflowMap,
  DataflowScopeName, FunctionArgument, IdentifierReference
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

function stylesForDefinitionKindsInEnvironment(_subflow: DataflowFunctionFlowInformation, _lines: string[], _idPrefix: string) {
  // TODO: highlight seems to be often wrong
}

function subflowToMermaid(nodeId: NodeId, subflow: DataflowFunctionFlowInformation | undefined, dataflowIdMap: DataflowMap<NoInfo> | undefined, lines: string[], idPrefix = ''): void {
  if(subflow === undefined) {
    return
  }
  const subflowId = `${idPrefix}flow-${nodeId}`
  lines.push(`\nsubgraph "${subflowId}" [function ${nodeId}]`)
  lines.push(graphToMermaid(subflow.graph, dataflowIdMap, null, idPrefix))
  for(const out of [...subflow.in, ...subflow.out, ...subflow.activeNodes]) {
    // in/out/active
    lines.push(`    style ${idPrefix}${out.nodeId} stroke:purple,stroke-width:4px; `)
  }
  stylesForDefinitionKindsInEnvironment(subflow, lines, idPrefix)
  lines.push('end')
  lines.push(`${idPrefix}${nodeId} -.-|function| ${subflowId}\n`)
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayEnvReplacer(key: any, value: any): any {
  if(value instanceof Map) {
    return [...value]
  } else {
    return value
  }
}

function printArg(arg: IdentifierReference | '<value>'): string {
  return arg === '<value>' ? '<value>' : `${arg.nodeId}:${arg.name}`
}
function displayFunctionArgMapping(argMapping: FunctionArgument[]): string {
  let result = ''
  for(const arg of argMapping) {
    result += Array.isArray(arg) ? `${arg[0]} -> ${printArg(arg[1])}\n` : `${printArg(arg)}\n`
  }
  return result.length === 0 ? '' : `\n    ${result}`
}

export function graphToMermaid(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix: string | null = 'flowchart TD', idPrefix = ''): string {
  const lines = prefix === null ? [] : [prefix]
  for (const [id, info] of graph.entries()) {
    const def = info.definedAtPosition !== false
    const fCall = info.functionCall !== undefined && info.functionCall !== false
    const defText = definedAtPositionToMermaid(info.definedAtPosition, info.when)
    let open: string
    let close: string
    if(def) { open = '['; close = ']' }
    else if(fCall) { open = '[['; close = ']]' }
    else { open = '(['; close = '])' }

    lines.push(`    %% ${id}: ${JSON.stringify(info.environment, displayEnvReplacer)}`)
    lines.push(`    ${idPrefix}${id}${open}"\`${info.name} (${id}${defText})\n      *${formatRange(dataflowIdMap?.get(id)?.location)}*${
      info.functionCall ? displayFunctionArgMapping(info.functionCall) : ''
    }\`"${close}`)
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
    mermaid:       {},
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
