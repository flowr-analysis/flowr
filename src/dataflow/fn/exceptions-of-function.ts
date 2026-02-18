import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { CallGraph } from '../graph/call-graph';
import { VertexType } from '../graph/vertex';
import type { ControlDependency } from '../info';
import { ExitPointType } from '../info';
import { BuiltInProcName } from '../environments/built-in';

const CatchHandlers: ReadonlySet<string> = new Set<BuiltInProcName>([BuiltInProcName.Try]);
export interface ExceptionPoint {
	id:   NodeId;
	cds?: readonly ControlDependency[];
}
/**
 * Collect exception sources of a function in the call graph.
 * This returns the `NodeId`s of functions that may throw exceptions when called by the given function.
 * Please be aware, that these are restricted to functions known by flowR.
 * With `knownThrower` you can provide additional functions that are known to throw exceptions.
 * @returns A record mapping all `NodeId`s of functions that may throw exceptions to their exception points.
 */
export function calculateExceptionsOfFunction(id: NodeId, graph: CallGraph, knownThrower: Record<NodeId, ExceptionPoint[]> = {}): Record<NodeId, ExceptionPoint[]> {
	const collectedExceptions: Record<NodeId, ExceptionPoint[]> = {};
	const mine: ExceptionPoint[] = [];
	const visited = new Set<NodeId>();
	const toVisit: NodeId[] = [id];

	while(toVisit.length > 0) {
		const currentId = toVisit.pop() as NodeId;
		if(visited.has(currentId)) {
			continue;
		}
		visited.add(currentId);
		const kt = knownThrower[currentId];
		if(kt) {
			for(const e of kt) {
				if(!mine.includes(e)) {
					mine.push(e);
				}
			}
			continue;
		}

		const vtx = graph.getVertex(currentId);
		if(!vtx) {
			continue;
		}

		if(NodeId.isBuiltIn(currentId)) {
			continue;
		}

		if(vtx.tag === VertexType.FunctionDefinition) {
			const es = vtx.exitPoints.filter(e => e.type === ExitPointType.Error).map(e => ({ id: e.nodeId, cds: e.cds }));
			for(const e of es) {
				if(!mine.includes(e)) {
					mine.push(e);
				}
			}
			collectedExceptions[vtx.id] = es;
		} else if(vtx.tag === VertexType.FunctionCall && vtx.origin !== 'unnamed' && vtx.origin.some(c => CatchHandlers.has(c))) {
			// skip the try-catch handlers as they catch all exceptions within their body
			continue;
		}

		const outEdges = graph.outgoingEdges(currentId) ?? [];
		for(const [out] of outEdges) {
			if(!visited.has(out)) {
				toVisit.push(out);
			}
		}
	}

	collectedExceptions[id] = mine;
	return collectedExceptions;
}