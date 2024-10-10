import type { AstIdMap } from './decorate';
import type { DataflowGraph } from '../../../../../dataflow/graph/graph';
import { VertexType } from '../../../../../dataflow/graph/vertex';
import { removeRQuotes } from '../../../../retriever';

/** The type of the id assigned to each node. Branded to avoid problematic usages with other string or numeric types. */
export type NodeId<T extends string | number = string | number> = T & { __brand?: 'node-id' };
const numIdRegex = /^\d+$/;

/** used so that we do not have to store strings for the default numeric ids */
export function normalizeIdToNumberIfPossible(id: NodeId): NodeId {
	// check if string is number
	if(typeof id === 'string' && numIdRegex.test(id)) {
		return Number(id);
	}
	return id;
}

/**
 * Recovers the lexeme of a node from its id in the idmap.
 */
export function recoverName(id: NodeId, idMap?: AstIdMap): string | undefined {
	return idMap?.get(id)?.lexeme;
}

export function recoverContent(id: NodeId, graph: DataflowGraph): string | undefined {
	const vertex = graph.getVertex(id);
	if(vertex === undefined) {
		return undefined;
	}
	if(vertex.tag === VertexType.FunctionCall && vertex.name) {
		return vertex.name;
	}
	const node = graph.idMap?.get(id);
	if(node === undefined) {
		return undefined;
	}
	const lexeme = node.lexeme ?? node.info.fullLexeme ?? '';
	if(vertex.tag === VertexType.Use) {
		return removeRQuotes(lexeme);
	}
	return lexeme;
}
