import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import { ExitPointType } from '../info';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import type { CallGraph } from '../graph/call-graph';
import type { DataflowGraphVertexArgument } from '../graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../graph/vertex';
import { NoEdges } from '../graph/graph';

const CatchHandlers: ReadonlySet<string> = new Set<BuiltInProcName>([BuiltInProcName.Try]);
export interface ExceptionPoint {
	id:   NodeId;
	cds?: readonly ControlDependency[];
}

/** The reachable part of the call graph, the vertices ending the walk carrying no calls of their own. */
interface ReachedFunctions {
	readonly calls: Map<NodeId, readonly NodeId[]>
	/** what a vertex raises itself, before its callees are taken into account */
	readonly own:   Map<NodeId, readonly ExceptionPoint[]>
	/** the function definitions among them, which are the ones to report on */
	readonly defs:  Set<NodeId>
}

/** The exceptions each function may raise, keyed by the id of its definition. */
export type ExceptionsByFunction = Record<NodeId, ExceptionPoint[]>;

/** Whether the vertex catches what is raised below it, which ends the walk. */
function catches(vertex: DataflowGraphVertexArgument | undefined): boolean {
	return FunctionCallVertex.is(vertex) && vertex.origin !== 'unnamed' && vertex.origin.some(c => CatchHandlers.has(c));
}

function reach(id: NodeId, graph: CallGraph, knownThrower: ExceptionsByFunction): ReachedFunctions {
	const calls = new Map<NodeId, readonly NodeId[]>();
	const own = new Map<NodeId, readonly ExceptionPoint[]>();
	const defs = new Set<NodeId>();
	const toVisit: NodeId[] = [id];

	while(toVisit.length > 0) {
		const current = toVisit.pop() as NodeId;
		if(calls.has(current)) {
			continue;
		}
		const known = knownThrower[current];
		if(known !== undefined) {
			own.set(current, known);
			calls.set(current, []);
			continue;
		}
		const vertex = graph.getVertex(current);
		if(vertex === undefined || NodeId.isBuiltIn(current)) {
			calls.set(current, []);
			continue;
		}
		if(FunctionDefinitionVertex.is(vertex)) {
			defs.add(current);
			own.set(current, vertex.exitPoints.filter(e => e.type === ExitPointType.Error).map(e => ({ id: e.nodeId, cds: e.cds })));
		} else if(catches(vertex)) {
			calls.set(current, []);
			continue;
		}
		const next = [...(graph.outgoingEdges(current) ?? NoEdges).keys()];
		calls.set(current, next);
		for(const n of next) {
			if(!calls.has(n)) {
				toVisit.push(n);
			}
		}
	}
	return { calls, own, defs };
}

/**
 * Collect exception sources of a function in the call graph.
 * This returns the `NodeId`s of functions that may throw exceptions when called by the given function.
 * Please be aware, that these are restricted to functions known by flowR.
 * With `knownThrower` you can provide additional functions that are known to throw exceptions; the result of
 * an earlier call serves as one, as every definition it passes gets an answer counting its callees.
 * A `try` and its relatives end the search.
 * @returns A record mapping all `NodeId`s of functions that may throw exceptions to their exception points.
 */
export function calculateExceptionsOfFunction(id: NodeId, graph: CallGraph, knownThrower: ExceptionsByFunction = {}): ExceptionsByFunction {
	const { calls, own, defs } = reach(id, graph, knownThrower);

	const raised = new Map<NodeId, Map<NodeId, ExceptionPoint>>();
	for(const node of calls.keys()) {
		raised.set(node, new Map((own.get(node) ?? []).map(e => [e.id, e])));
	}
	const callers = new Map<NodeId, NodeId[]>();
	for(const [node, next] of calls) {
		for(const call of next) {
			const known = callers.get(call);
			if(known === undefined) {
				callers.set(call, [node]);
			} else {
				known.push(node);
			}
		}
	}
	const pending = [...calls.keys()];
	const queued = new Set<NodeId>(pending);
	while(pending.length > 0) {
		const node = pending.pop() as NodeId;
		queued.delete(node);
		const into = raised.get(node) as Map<NodeId, ExceptionPoint>;
		let grew = false;
		for(const call of calls.get(node) ?? []) {
			for(const [at, point] of raised.get(call) ?? NoPoints) {
				if(!into.has(at)) {
					into.set(at, point);
					grew = true;
				}
			}
		}
		if(!grew) {
			continue;
		}
		for(const caller of callers.get(node) ?? []) {
			if(!queued.has(caller)) {
				queued.add(caller);
				pending.push(caller);
			}
		}
	}

	const result: ExceptionsByFunction = {};
	for(const [node, points] of raised) {
		if(defs.has(node) || node === id) {
			result[node] = [...points.values()];
		}
	}
	return result;
}

const NoPoints: ReadonlyMap<NodeId, ExceptionPoint> = new Map();
