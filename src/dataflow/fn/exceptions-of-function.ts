import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlDependency } from '../info';
import { ExitPointType } from '../info';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import type { CallGraph } from '../graph/call-graph';
import type { DataflowGraphVertexArgument } from '../graph/vertex';
import { DfgVertex } from '../graph/vertex';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { ArgProp } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import type { BuiltInLookup } from './frame-reflection';
import { namesAnErrorHandler } from './condition-handlers';
import { memoize } from '../../util/collections/defaultmap';

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
	if(!DfgVertex.isFunctionCall(vertex) || !DfgVertex.hasOrigin(vertex, BuiltInProcName.Try)) {
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
	let node = idMap?.get(id);
	while(idMap !== undefined && node !== undefined && !RFunctionDefinition.is(node)) {
		const parent = RNode.directParent(node, idMap);
		if(RArgument.isUnnamed(node) && RFunctionCall.is(parent) && catches(graph.getVertex(parent.info.id), graph, info)) {
			return true;
		}
		node = parent;
	}
	return false;
}

function reach(id: NodeId, graph: CallGraph, knownThrower: ExceptionsByFunction): ReachedFunctions {
	const info = builtInLookup();
	const isGuarded = memoize((n: NodeId) => guarded(n, graph, info));
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
		if(DfgVertex.isFunctionDefinition(vertex)) {
			defs.add(current);
			own.set(current, vertex.exitPoints.filter(e => e.type === ExitPointType.Error).map(e => ({ id: e.nodeId, cds: e.cds })));
		}
		/* a guarded call is only ever reached through the construct guarding it, which ends the walk of its own */
		const next = [...graph.edgesFrom(current).keys()].filter(n => !isGuarded(n));
		calls.set(current, next);
		toVisit.push(...next);
	}
	return { calls, own, defs };
}

/** What each node may raise, its callees included; Tarjan yields the call cycles callees first, so each is settled once. */
function raisedPerNode(calls: ReadonlyMap<NodeId, readonly NodeId[]>, own: ReadonlyMap<NodeId, readonly ExceptionPoint[]>): ReadonlyMap<NodeId, ReadonlyMap<NodeId, ExceptionPoint>> {
	const raised = new Map<NodeId, Map<NodeId, ExceptionPoint>>();
	const index = new Map<NodeId, number>();
	const low = new Map<NodeId, number>();
	const stack: NodeId[] = [];
	const onStack = new Set<NodeId>();
	const lower = (node: NodeId, to: number) => low.set(node, Math.min(low.get(node) as number, to));
	for(const root of calls.keys()) {
		if(index.has(root)) {
			continue;
		}
		/* each frame is a node and how many of its callees have been looked at */
		const frames: [NodeId, number][] = [[root, 0]];
		while(frames.length > 0) {
			const frame = frames[frames.length - 1];
			const [node, at] = frame;
			if(at === 0) {
				low.set(node, index.size);
				index.set(node, index.size);
				stack.push(node);
				onStack.add(node);
			}
			const callee = calls.get(node)?.[at];
			if(callee !== undefined) {
				frame[1]++;
				if(!index.has(callee)) {
					frames.push([callee, 0]);
				} else if(onStack.has(callee)) {
					lower(node, index.get(callee) as number);
				}
				continue;
			}
			frames.pop();
			if(frames.length > 0) {
				lower(frames[frames.length - 1][0], low.get(node) as number);
			}
			if(low.get(node) === index.get(node)) {
				/* the node roots a component: its members are what lies on the stack above it, taken off top first */
				const members = stack.splice(stack.lastIndexOf(node)).reverse();
				const points = new Map<NodeId, ExceptionPoint>();
				for(const m of members) {
					for(const e of own.get(m) ?? []) {
						points.set(e.id, e);
					}
					for(const callee of calls.get(m) ?? []) {
						for(const [at, point] of raised.get(callee) ?? []) {
							points.set(at, point);
						}
					}
				}
				for(const m of members) {
					onStack.delete(m);
					raised.set(m, points);
				}
			}
		}
	}
	return raised;
}

/** What to ask for beyond the definition itself, see {@link exceptionsOfFunction}. */
export interface FunctionExceptionsOptions {
	/** seeds additional throwers, e.g. the result of an earlier call, so their callees are counted too */
	readonly knownThrower?: ExceptionsByFunction
}

/**
 * The `NodeId`s of functions that may throw exceptions when called by `id`, restricted to functions known by
 * flowR. `knownThrower` seeds additional throwers, e.g. the result of an earlier call, counting its callees.
 * @useInstead {@link FunctionSemantics.exceptions}
 */
export function exceptionsOfFunction(this: void, id: NodeId, graph: CallGraph, { knownThrower = {} }: FunctionExceptionsOptions = {}): ExceptionsByFunction {
	const { calls, own, defs } = reach(id, graph, knownThrower);
	const result: ExceptionsByFunction = {};
	for(const [node, points] of raisedPerNode(calls, own)) {
		if(defs.has(node) || node === id) {
			result[node] = [...points.values()];
		}
	}
	return result;
}
