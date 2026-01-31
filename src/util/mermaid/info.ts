import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';


type MarkVertex = NodeId
type MarkEdge = `${string}->${string}`

export type MermaidMarkdownMark = MarkVertex | MarkEdge

export interface MermaidMarkStyle {
	readonly vertex: string
	readonly edge:   string
}


export interface MermaidGraphPrinterInfo {
    includeOnlyIds?: ReadonlySet<NodeId>,
    mark?:           ReadonlySet<MermaidMarkdownMark>,
    markStyle?:      MermaidMarkStyle,
    prefix?:         string,
    simplify?:       boolean
}

export const MermaidDefaultMarkStyle: MermaidMarkStyle = { vertex: 'stroke:teal,stroke-width:7px,stroke-opacity:.8;', edge: 'stroke:teal,stroke-width:4.2px,stroke-opacity:.8' };