import { mapTypeToNormalizedName, NodeId, NoInfo, RNodeWithParent, RoleInParent, visit } from '../r-bridge'
import { SourceRange } from './range'
import {
  BuiltIn,
  DataflowFunctionFlowInformation,
  DataflowGraph,
  DataflowGraphEdgeAttribute,
  DataflowGraphEdgeType,
  DataflowGraphNodeInfo,
  DataflowMap,
  DataflowScopeName,
  FunctionArgument,
  IdentifierReference
} from '../dataflow'
import { guard } from './assert'
import { displayEnvReplacer } from './json'


interface MermaidGraph {
  nodeLines:           string[]
  edgeLines:           string[]
  hasBuiltIn:          boolean
  includeEnvironments: boolean
  mark:                Set<NodeId> | undefined
  /** in the form of from-\>to because I am lazy, see {@link encodeEdge} */
  presentEdges:        Set<string>
  // keep for subflows
  rootGraph:           DataflowGraph
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
  mermaid.nodeLines.push(`\nsubgraph "${subflowId}" [function ${nodeId}]`)
  const subgraph = graphToMermaidGraph(subflow.graph, dataflowIdMap, null, idPrefix, mermaid.mark, mermaid.rootGraph)
  mermaid.nodeLines.push(...subgraph.nodeLines)
  mermaid.edgeLines.push(...subgraph.edgeLines)
  for(const [color, pool] of [['purple', subflow.in], ['green', subflow.out], ['orange', subflow.activeNodes]]) {
    for (const out of pool as IdentifierReference[]) {
      if(!mermaid.mark?.has(out.nodeId)) {
        // in/out/active for unmarked
        mermaid.nodeLines.push(`    style ${idPrefix}${out.nodeId} stroke:${color as string},stroke-width:4px; `)
      }
    }
  }
  for(const exitPoint of exitPoints) {
    if(!subflow.graph.hasNode(exitPoint)) {
      const node = dataflowIdMap?.get(exitPoint)
      guard(node !== undefined, 'exit point not found')
      mermaid.nodeLines.push(` ${idPrefix}${exitPoint}{{"${node.lexeme ?? '??'} (${exitPoint})\n      ${formatRange(dataflowIdMap?.get(exitPoint)?.location)}"}}`)
    }
    mermaid.nodeLines.push(`    style ${idPrefix}${exitPoint} stroke-width:6.5px;`)
  }

  mermaid.nodeLines.push('end')
  mermaid.edgeLines.push(`${idPrefix}${nodeId} -.-|function| ${subflowId}\n`)
}


function printArg(arg: IdentifierReference | '<value>' | 'empty' | undefined): string {
  if(arg === 'empty') {
    return ''
  }
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

  if(mermaid.includeEnvironments) {
    mermaid.nodeLines.push(`    %% ${id}: ${JSON.stringify(info.environment, displayEnvReplacer)}`)
  }
  mermaid.nodeLines.push(`    ${idPrefix}${id}${open}"\`${escapeMarkdown(info.name)} (${id}${defText})\n      *${formatRange(dataflowIdMap?.get(id)?.location)}*${
    fCall ? displayFunctionArgMapping(info.args) : ''
  }\`"${close}`)
  if (mark?.has(id)) {
    mermaid.nodeLines.push(`    style ${idPrefix}${id} stroke:black,stroke-width:7px; `)
  }

  const edges = mermaid.rootGraph.get(id, true)
  guard(edges !== undefined, `node ${id} must be found`)
  for (const [target, edge] of [...edges[1]]) {
    const dotEdge = edge.types.has('same-def-def') || edge.types.has('same-read-read') || edge.types.has('relates')
    const edgeId = encodeEdge(idPrefix + id, idPrefix + target, edge.types, edge.attribute)
    if(!mermaid.presentEdges.has(edgeId)) {
      mermaid.presentEdges.add(edgeId)
      mermaid.edgeLines.push(`    ${idPrefix}${id} ${dotEdge ? '-.-' : '-->'}|"${[...edge.types].join(', ')} (${edge.attribute})"| ${idPrefix}${target}`)
      if (target === BuiltIn) {
        mermaid.hasBuiltIn = true
      }
    }
  }
  if (info.tag === 'function-definition') {
    subflowToMermaid(id, info.exitPoints, info.subflow, dataflowIdMap, mermaid, idPrefix)
  }
}


function graphToMermaidGraph(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix: string | null = 'flowchart TD', idPrefix = '', mark?: Set<NodeId>, rootGraph?: DataflowGraph): MermaidGraph {
  const mermaid: MermaidGraph = { nodeLines: prefix === null ? [] : [prefix], edgeLines: [], presentEdges: new Set<string>(), hasBuiltIn: false, mark, rootGraph: rootGraph ?? graph, includeEnvironments: true }

  for (const [id, info] of graph.entries()) {
    nodeToMermaid(graph, info, mermaid, id, idPrefix, dataflowIdMap, mark)
  }
  if(mermaid.hasBuiltIn) {
    mermaid.nodeLines.push(`    ${idPrefix}${BuiltIn}["Built-in"]`)
  }
  return mermaid
}

export function graphToMermaid(graph: DataflowGraph, dataflowIdMap: DataflowMap<NoInfo> | undefined, prefix: string | null = 'flowchart TD', idPrefix = '', mark?: Set<NodeId>, rootGraph?: DataflowGraph): string {
  const mermaid = graphToMermaidGraph(graph, dataflowIdMap, prefix, idPrefix, mark, rootGraph)
  return `${mermaid.nodeLines.join('\n')}\n${mermaid.edgeLines.join('\n')}`
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
 * @param dataflowIdMap - ID map to use to get access to the graph id mappings
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

export function normalizedAstToMermaid(ast: RNodeWithParent, prefix: string): string {
  let output = prefix + 'flowchart TD\n'
  visit(ast, (n, context) => {
    const name = `${mapTypeToNormalizedName(n.type)} (${n.info.id})\\n${n.lexeme ?? ' '}`
    output += `    n${n.info.id}(["${name}"])\n`
    if (n.info.parent !== undefined) {
      const roleSuffix = context.role === RoleInParent.ExpressionListChild || context.role === RoleInParent.FunctionCallArgument || context.role === RoleInParent.FunctionDefinitionParameter ? `-${context.index}` : ''
      output += `    n${n.info.parent} -->|"${context.role}${roleSuffix}"| n${n.info.id}\n`
    }
    return false
  })
  return output
}

/**
 * Use mermaid to visualize the normalized AST.
 */
export function normalizedAstToMermaidUrl(ast: RNodeWithParent, prefix = ''): string {
  return mermaidCodeToUrl(normalizedAstToMermaid(ast, prefix))
}
