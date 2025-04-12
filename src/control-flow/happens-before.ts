import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { Ternary } from '../util/logic';
import type { ControlFlowGraph } from './control-flow-graph';

/**
 * Determines if node `a` happens before node `b` in the control flow graph.
 */
export function happensBefore(cfg: ControlFlowGraph, a: NodeId, b: NodeId): Ternary {
	const visited = new Set<NodeId>();
	/* the first is the id we are currently at, the second one the exit marker of the current largest cd scope */
	const stack: [NodeId, string | undefined][] = [[b, undefined]];
	while(stack.length > 0) {
		const [current, cd] = stack.pop() as [NodeId, string | undefined];
		let useCd = cd;
		if(current === a) {
			return cd ? Ternary.Maybe : Ternary.Always;
		} else if(visited.has(current)) {
			continue;
		} else if(cd && (current === cd || visited.has(cd))) {
			useCd = undefined;
		}
		visited.add(current);
		for(const [id, t] of cfg.outgoing(current) ?? []) {
			const marker = t.label === 'CD' ? `${t.caused}-exit` : useCd;
			stack.push([id, useCd ?? marker]);
		}
	}
	return Ternary.Never;
}
