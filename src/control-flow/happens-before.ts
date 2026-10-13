import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../util/logic';
import { type ControlFlowGraph, CfgEdge } from './control-flow-graph';

/** Walks back from `b`, handing each node the vertex its outermost open branch scope joins on, until `stop` says so. */
function walkBack(cfg: ControlFlowGraph, b: NodeId, stop: (current: NodeId, cd: NodeId | undefined) => boolean): boolean {
	const visited = new Set<NodeId>();
	/* the first is the id we are currently at, the second one the vertex the current largest cd scope joins on */
	const stack: [NodeId, NodeId | undefined][] = [[b, undefined]];
	while(stack.length > 0) {
		const [current, cd] = stack.pop() as [NodeId, NodeId | undefined];
		if(stop(current, cd)) {
			return true;
		} else if(visited.has(current)) {
			continue;
		}
		const useCd = cd && (current === cd || visited.has(cd)) ? undefined : cd;
		visited.add(current);
		for(const [id, t] of cfg.ingoingEdges(current) ?? []) {
			/* the vertex that caused the branch is where its arms join again, so it closes the scope */
			const joinsAt = CfgEdge.isControlDependency(t) ? CfgEdge.unpackCause(t) : undefined;
			stack.push([id, useCd ?? joinsAt]);
		}
	}
	return false;
}

/**
 * Determines if node `a` happens before node `b` in the control flow graph.
 */
export function happensBefore(cfg: ControlFlowGraph, a: NodeId, b: NodeId): Ternary {
	let result = Ternary.Never;
	walkBack(cfg, b, (current, cd) => {
		if(current === a) {
			result = cd ? Ternary.Maybe : Ternary.Always;
		}
		return current === a;
	});
	return result;
}

/** Whether one of the `candidates` always happens before `b`; one walk back from `b` settles all candidates at once. */
export function someAlwaysBefore(cfg: ControlFlowGraph, candidates: ReadonlySet<NodeId>, b: NodeId): boolean {
	const met = new Set<NodeId>();
	return walkBack(cfg, b, (current, cd) => {
		if(current === b || !candidates.has(current) || met.has(current)) {
			return false;
		}
		met.add(current);
		return !cd;
	});
}

/**
 * The `candidates` none of the others always happens before, i.e. those some path reaches without passing another.
 * With `within` (a function's body) the walk stays among those nodes; a region that is one cycle keeps every candidate.
 */
export function firstOnSomePath(cfg: ControlFlowGraph, candidates: ReadonlySet<NodeId>, within?: ReadonlySet<NodeId>): ReadonlySet<NodeId> {
	const inside = (id: NodeId) => within === undefined || within.has(id);
	const predecessors = (id: NodeId) => [...cfg.ingoingEdges(id)?.keys() ?? []].filter(inside);
	const region = closure(candidates, predecessors);
	const starts = [...region].filter(id => predecessors(id).length === 0);
	if(starts.length === 0) {
		return candidates;
	}
	const first = new Set<NodeId>();
	closure(starts, id => {
		if(candidates.has(id)) {
			first.add(id);
			return [];
		}
		return [...cfg.outgoingEdges(id)?.keys() ?? []].filter(next => region.has(next));
	});
	return first;
}

function closure(seeds: Iterable<NodeId>, step: (id: NodeId) => Iterable<NodeId>): ReadonlySet<NodeId> {
	const seen = new Set<NodeId>(seeds);
	const stack = [...seen];
	while(stack.length > 0) {
		for(const next of step(stack.pop() as NodeId)) {
			if(!seen.has(next)) {
				seen.add(next);
				stack.push(next);
			}
		}
	}
	return seen;
}

/** Every node reachable from one of `from`, the seeds included: `happensBefore(cfg, from_i, to)` is not {@link Ternary#Never} for some seed exactly when `to` is in here. */
export function reachableFrom(cfg: ControlFlowGraph, from: Iterable<NodeId>): ReadonlySet<NodeId> {
	return closure(from, id => cfg.successors(id));
}

/** @see {@link reachableFrom} - the other direction */
export function reachableTo(cfg: ControlFlowGraph, to: Iterable<NodeId>): ReadonlySet<NodeId> {
	return closure(to, id => cfg.predecessors(id));
}
