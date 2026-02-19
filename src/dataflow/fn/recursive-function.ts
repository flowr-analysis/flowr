import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import {
	isFunctionDefinitionVertex
} from '../graph/vertex';
import type { CallGraph } from '../graph/call-graph';

/**
 * Determines whether the function with the given ID is recursive.
 */
export function isFunctionRecursive(id: NodeId, graph: CallGraph): boolean {
	const vert = graph.getVertex(id);
	if(!isFunctionDefinitionVertex(vert)) {
		return false;
	}

	const seen = new Set<NodeId>();
	const toVisit: NodeId[] = [id];
	let gotStart = 0;

	while(toVisit.length > 0) {
		const currentId = toVisit.pop() as NodeId;
		if(currentId === id && gotStart++ > 0) {
			return true;
		}
		if(seen.has(currentId)) {
			continue;
		}
		seen.add(currentId);
		const out = graph.outgoingEdges(currentId)?.keys() ?? [];
		for(const nextId of out) {
			toVisit.push(nextId);
		}
	}

	return false;
}