import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { type ControlDependency, ExitPointType } from '../info';
import { BuiltInProcName } from '../environments/built-in-proc-name';
import type { CallGraph } from '../graph/call-graph';
import { type DataflowGraphVertexArgument, DfgVertex } from '../graph/vertex';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RFunctionDefinition } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-definition';
import { ArgProp } from '../environments/built-in-props';
import { builtInLookup } from '../environments/query-fn-props';
import type { BuiltInLookup } from './frame-reflection';
import { namesAnErrorHandler } from './condition-handlers';
import { memoize } from '../../util/collections/defaultmap';
import { ReachSummaries } from '../../util/fixpoint';

export interface ExceptionPoint {
	id:   NodeId;
	cds?: readonly ControlDependency[];
}

/** The exceptions each function may raise, keyed by the id of its definition. */
export type ExceptionsByFunction = Record<NodeId, ExceptionPoint[]>;

/** Whether the vertex catches an error raised below it, which ends the walk. */
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

/** Whether the call is written in the block of a construct catching what it raises, which keeps an error its callee raises from reaching the function around it. */
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

type Raised = ReadonlyMap<NodeId, ExceptionPoint>;
const RaisesNothing: Raised = new Map();

function joinRaised(a: Raised, b: Raised): Raised {
	if(b.size === 0 || b.keys().every(k => a.has(k))) {
		return a;
	} else if(a.size === 0) {
		return b;
	}
	const joined = new Map(a);
	for(const [at, point] of b) {
		if(!joined.has(at)) {
			joined.set(at, point);
		}
	}
	return joined;
}

/** What to ask for beyond the definition itself, see {@link exceptionsOfFunction}. */
export interface FunctionExceptionsOptions {
	/** seeds additional throwers, e.g. the result of an earlier call, so their callees are counted too */
	readonly knownThrower?: ExceptionsByFunction
}

/**
 * The `NodeId`s of functions that may throw exceptions when called by `id`, restricted to functions known by flowR.
 * @useInstead {@link FunctionSemantics.exceptions}
 */
export function exceptionsOfFunction(this: void, id: NodeId, graph: CallGraph, { knownThrower = {} }: FunctionExceptionsOptions = {}): ExceptionsByFunction {
	return exceptionsOfFunctions([id], graph, { knownThrower });
}

/**
 * {@link exceptionsOfFunction} for several definitions of one call graph at once: what a call raises is summarized once and
 * shared by every definition reaching it, rather than walked again per definition. Answers for the `ids` and every
 * definition the walk passed.
 * @useInstead {@link FunctionSemantics.exceptionsOfAll}
 */
export function exceptionsOfFunctions(this: void, ids: Iterable<NodeId>, graph: CallGraph, { knownThrower = {} }: FunctionExceptionsOptions = {}): ExceptionsByFunction {
	const info = builtInLookup();
	const isGuarded = memoize((n: NodeId) => guarded(n, graph, info));
	const own = new Map<NodeId, Raised>();
	const defs: NodeId[] = [];
	const raised = new ReachSummaries<NodeId, Raised>(current => {
		const known = knownThrower[current];
		if(known !== undefined) {
			own.set(current, new Map(known.map(e => [e.id, e])));
			return [];
		}
		const vertex = graph.getVertex(current);
		if(vertex === undefined || NodeId.isBuiltIn(current)) {
			return [];
		}
		if(DfgVertex.isFunctionDefinition(vertex)) {
			defs.push(current);
			own.set(current, new Map(vertex.exitPoints.filter(e => e.type === ExitPointType.Error).map(e => [e.nodeId, { id: e.nodeId, cds: e.cds }])));
		}
		/* a guarded call is only ever reached through the construct guarding it, which ends the walk of its own */
		return graph.edgesFrom(current).keys().filter(n => !isGuarded(n));
	}, n => own.get(n), { empty: RaisesNothing, concat: joinRaised });
	const result: ExceptionsByFunction = {};
	for(const id of ids) {
		result[id] = [...raised.of(id).values()];
	}
	for(const def of defs) {
		result[def] ??= [...raised.of(def).values()];
	}
	return result;
}
