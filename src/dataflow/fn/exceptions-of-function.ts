import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../graph/call-graph';
import { VertexType } from '../graph/vertex';
import type { ControlDependency } from '../info';
import { ExitPointType } from '../info';
import type { BuiltInMappingName } from '../environments/built-in';
import { isBuiltIn } from '../environments/built-in';

const CatchHandlers: ReadonlySet<string> = new Set<BuiltInMappingName>(['builtin:try']);
export interface ExceptionPoint {
	id:   NodeId;
	cds?: readonly ControlDependency[] | undefined;
}
/**
 * Collect exception sources of a function in the call graph.
 * This returns the `NodeId`s of functions that may throw exceptions when called by the given function.
 * Please be aware, that these are restricted to functions known by flowR.
 */
export function calculateExceptionsOfFunction(id: NodeId, graph: CallGraph): ExceptionPoint[] {
	const collectedExceptions:  ExceptionPoint[] = [];
	const visited = new Set<NodeId>();
	const toVisit: NodeId[] = [id];

	while(toVisit.length > 0) {
		const currentId = toVisit.pop() as NodeId;
		if(visited.has(currentId)) {
			continue;
		}
		visited.add(currentId);

		const vtx = graph.getVertex(currentId);
		if(!vtx) {
			continue;
		}

		if(isBuiltIn(currentId)) {
			continue;
		}

		if(vtx.tag === VertexType.FunctionDefinition) {
			for(const e of vtx.exitPoints.filter(e => e.type === ExitPointType.Error)) {
				if(!collectedExceptions.find(x => x.id === e.nodeId)) {
					collectedExceptions.push({ id: e.nodeId, cds: e.controlDependencies });
				}
			}
		} else if(vtx.tag === VertexType.FunctionCall && vtx.origin !== 'unnamed' && vtx.origin.some(c => CatchHandlers.has(c))) {
			// skip the try-catch handlers as they catch all exceptions within their body
			continue;
		}

		const outEdges = graph.outgoingEdges(currentId) ?? [];
		for(const [out] of outEdges) {
			toVisit.push(out);
		}
	}

	return collectedExceptions;
}