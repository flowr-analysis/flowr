import { NodeId, NoInfo } from '../r-bridge'
import { SourceRange } from './range'
import {
  BuiltIn,
  DataflowFunctionFlowInformation,
  DataflowGraph,
  DataflowGraphEdgeAttribute, DataflowGraphEdgeType, DataflowGraphNodeInfo,
  DataflowMap,
  DataflowScopeName, FunctionArgument, IdentifierReference
} from '../dataflow'
import { guard } from './assert'


interface MermaidGraph {
  lines:        string[]
  hasBuiltIn:   boolean
  mark:         Set<NodeId> | undefined
  /** in the form of from-\>to because I am lazy, see {@link encodeEdge} */
  presentEdges: Set<string>
  // keep for subflows
  rootGraph:    DataflowGraph
}

export function formatRange(range: SourceRange | undefined): string {
  if (range === undefined) {
    return '??'
  }

  return `${range.start.line}.${range.start.column}-${range.end.line}.${range.end.column}`
}

function scopeToMermaid(scope: DataflowScopeName, when: DataflowGraphEdgeAttribute): string {
  const whenText = when === 'always' ? '' : `, ${when}`
  return `, *${scope.replace('<', '#lt;')}${whenText}*`
}

function subflowToMermaid(nodeId: NodeId, exitPoints: NodeId[], subflow: DataflowFunctionFlowInformation | undefined, dataflowIdMap: DataflowMap<NoInfo> | undefined, mermaid: MermaidGraph, idPrefix = ''): void {
  if(subflow === undefined) {
    return
  }
  const subflowId = `${idPrefix}flow-${nodeId}`
  mermaid.lines.push(`\nsubgraph "${subflowId}" [function ${nodeId}]`)
  mermaid.lines.push(graphToMermaid(subflow.graph, dataflowIdMap, null, idPrefix, mermaid.mark, mermaid.rootGraph))
  for(const [color, pool] of [['purple', subflow.in], ['green', subflow.out], ['orange', subflow.activeNodes]]) {
    for (const out of pool as IdentifierReference[]) {
      if(!mermaid.mark?.has(out.nodeId)) {
        // in/out/active for unmarked
        mermaid.lines.push(`    style ${idPrefix}${out.nodeId} stroke:${color as string},stroke-width:4px; `)
      }
    }
  }
  for(const exitPoint of exitPoints) {
    if(!subflow.graph.hasNode(exitPoint)) {
      const node = dataflowIdMap?.get(exitPoint)
      guard(node !== undefined, 'exit point not found')
      mermaid.lines.push(` ${idPrefix}${exitPoint}{{"${node.lexeme ?? '??'} (${exitPoint})\n      ${formatRange(dataflowIdMap?.get(exitPoint)?.location)}"}}`)
    }
    mermaid.lines.push(`    style ${idPrefix}${exitPoint} stroke-width:6.5px;`)
  }

  mermaid.lines.push('end')
  mermaid.lines.push(`${idPrefix}${nodeId} -.-|function| ${subflowId}\n`)
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function displayEnvReplacer(key: any, value: any): any {
  if(value instanceof Map || value instanceof Set) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return [...value]
  } else {
    return value
  }
}

function printArg(arg: IdentifierReference | '<value>' | undefined): string {
  if(arg === undefined || arg === '<value>') {
    return '??'
  }
  return `${arg.nodeId}`
}
function displayFunctionArgMapping(argMapping: FunctionArgument[]): string {
  const result = []
  for(const arg of argMapping) {
    result.push(Array.isArray(arg) ? `${arg[0]} -> ${printArg(arg[1])}` : `${printArg(arg)}`)
  }
  return result.length === 0 ? '' : `\n    (${result.join(', ')})`
}

function escapeMarkdown(text: string): string {
  return text.replace(/([+\-*])/g, '\\$1')
}

function encodeEdge(from: string, to: string, types: Set<DataflowGraphEdgeType>, attribute: string): string {
  // sort from and to for same edges and relates be order independent
  if(types.has('same-read-read') || types.has('same-def-def') || types.has('relates')) {
    if(from > to) {
      ({from, to} = {from: to, to: from})
    }
  }
  return `${from}->${to}["${[...types].join(':')} (${attribute})"]`
}


function mermaidNodeBrackets(def: boolean, fCall: boolean) {
  let open: string
  let close: string
  if (def) {
    open = '['
    close = ']'
  } else if (fCall) {
    open = '[['
    close = ']]'
  } else {
    open = '(['
    close = '])'
  }
  return { open, close }
}

function nodeToMermaid(graph: DataflowGraph, info: DataflowGraphNodeInfo, mermaid: MermaidGraph, id: NodeId, idPrefix: string, dataflowIdMap: DataflowMap<NoInfo> | undefined, mark: Set<NodeId> | undefined): void {
  const def = info.tag === 'variable-definition' || info.tag === 'function-definition'
  const fCall = info.tag === 'function-call'
  const defText = def ? scopeToMermaid(info.scope, info.when) : ''
  const { open, close } = mermaidNodeBrackets(def, fCall)

  mermaid.lines.push(`    %% ${id}: ${JSON.stringify(info.environment, displayEnvReplacer)}`)
  mermaid.lines.push(`    ${idPrefix}${id}${open}"\`${escapeMarkdown(info.name)} (${id}${defText})\n      *${formatRange(dataflowIdMap?.get(id)?.location)}*${
    fCall ? displayFunctionArgMapping(info.args) : ''
  }\`"${close}`)
  if (mark?.has(id)) {
    mermaid.lines.push(`    style ${idPrefix}${id} stroke:black,stroke-width:7px; `)
  }

  const edges = mermaid.rootGraph.get(id, true)
  guard(edges !== undefined, `node ${id} must be found`)
  for (const [target, edge] of [...edges[1]]) {
    const dotEdge = edge.types.has('same-def-def') || edge.types.has('same-read-read') || edge.types.has('relates')
    const edgeId = encodeEdge(idPrefix + id, idPrefix + target, edge.types, edge.attribute)
    if(!mermaid.presentEdges.has(edgeId)) {
      mermaid.presentEdges.add(edgeId)
      mermaid.lines.push(`    ${idPrefix}${id} ${dotEdge ? '-.-' : '-->'}|"${[...edge.types].join(', ')} (${edge.attribute})"| ${idPrefix}${target}`)
      if (target === BuiltIn) {
        mermaid.hasBuiltIn = true
      }
    }
  }
  if (info.tag === 'function-definition') {
    subflowToMermaid(id, info.exitPoints, info.subflow, dataflowIdMap, mermaid, idPrefix)
  }
}

export function graphToMermaid(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix: string | null = 'flowchart TD', idPrefix = '', mark?: Set<NodeId>, rootGraph?: DataflowGraph): string {
  const mermaid: MermaidGraph = { lines: prefix === null ? [] : [prefix], presentEdges: new Set<string>(), hasBuiltIn: false, mark, rootGraph: rootGraph ?? graph }

  for (const [id, info] of graph.entries()) {
    nodeToMermaid(graph, info, mermaid, id, idPrefix, dataflowIdMap, mark)
  }
  if(mermaid.hasBuiltIn) {
    mermaid.lines.push(`    ${idPrefix}${BuiltIn}["Built-in"]`)
  }
  return mermaid.lines.join('\n')
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

/**
 * Converts a dataflow graph to a mermaid url that visualizes the graph.
 *
 * @param graph         - The graph to convert
 * @param dataflowIdMap - Id map to use to get access to the graph id mappings
 * @param mark          - Special nodes to mark (e.g. those included in the slice)
 */
export function graphToMermaidUrl(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo>, mark?: Set<NodeId>): string {
  return mermaidCodeToUrl(graphToMermaid(graph, dataflowIdMap, undefined, undefined, mark))
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
