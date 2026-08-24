import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import { ExitPointType } from '../info';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import type { CallGraph } from '../graph/call-graph';
import type { DataflowGraphVertexArgument } from '../graph/vertex';
import { FunctionCallVertex, FunctionDefinitionVertex } from '../graph/vertex';
import { NoEdges } from '../graph/graph';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { ArgProp } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import type { BuiltInLookup } from './frame-reflection';
import { namesAnErrorHandler } from './condition-handlers';

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

/**
 * Whether the vertex catches an error raised below it, which ends the walk. A construct declaring no condition
 * handler of its own (`try`) catches whatever arrives; one that matches handlers by condition class
 * (`tryCatch`) catches only what the names written for it say.
 */
function catches(vertex: DataflowGraphVertexArgument | undefined, graph: CallGraph, info: BuiltInLookup): boolean {
	if(!FunctionCallVertex.is(vertex) || vertex.origin === 'unnamed' || !vertex.origin.some(c => CatchHandlers.has(c))) {
		return false;
	}
	const sig = info(vertex.name)?.sig;
	if(sig === undefined || !sig.some(([, props]) => (props & ArgProp.Callee) !== 0)) {
		return true;
	}
	const node = graph.idMap?.get(vertex.id);
	return RFunctionCall.is(node) && namesAnErrorHandler(node.arguments);
}

/**
 * Whether the call is written in the block of a construct catching what it raises, which keeps an error its
 * callee raises from reaching the function around it. Only the block is guarded, as a handler runs after the
 * error was raised, and the walk ends at the definition the call is written in, as a function defined in the
 * block is not run there.
 */
function guarded(id: NodeId, graph: CallGraph, info: BuiltInLookup): boolean {
	const idMap = graph.idMap;
	let node = idMap === undefined ? undefined : idMap.get(id);
	while(node !== undefined && !RFunctionDefinition.is(node)) {
		const parent = RNode.directParent(node, idMap as NonNullable<typeof idMap>);
		if(RArgument.isUnnamed(node) && RFunctionCall.is(parent) && catches(graph.getVertex(parent.info.id), graph, info)) {
			return true;
		}
		node = parent;
	}
	return false;
}

function reach(id: NodeId, graph: CallGraph, knownThrower: ExceptionsByFunction): ReachedFunctions {
	const info = builtInLookup();
	const isGuarded = new Map<NodeId, boolean>();
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
		}
		/* a guarded call is only ever reached through the construct guarding it, which ends the walk of its own */
		const next = [...(graph.outgoingEdges(current) ?? NoEdges).keys()].filter(n => {
			let known = isGuarded.get(n);
			if(known === undefined) {
				known = guarded(n, graph, info);
				isGuarded.set(n, known);
			}
			return !known;
		});
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
 * What a `try` and its relatives guard ends the search, their handlers do not.
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
