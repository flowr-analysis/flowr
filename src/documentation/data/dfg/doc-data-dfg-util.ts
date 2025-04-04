import type { RShell } from '../../../r-bridge/shell';
import { VertexType } from '../../../dataflow/graph/vertex';
import { EdgeType } from '../../../dataflow/graph/edge';
import type { DataflowGraph } from '../../../dataflow/graph/graph';

export interface SubExplanationParameters {
	readonly name:             string,
	readonly description:      string,
	readonly code:             string,
	readonly expectedSubgraph: DataflowGraph
}

export interface ExplanationParameters {
	readonly shell:            RShell,
	readonly name:             string,
	readonly type:             VertexType | EdgeType,
	readonly description:      string,
	readonly code:             string,
	readonly expectedSubgraph: DataflowGraph
}

export function getAllVertices(): [string, VertexType][] {
	return Object.entries(VertexType) as [string, VertexType][];
}

export function getAllEdges(): [string, EdgeType][] {
	return Object.entries(EdgeType).filter(([, v]) => Number.isInteger(v)) as [string, EdgeType][];
}
