import type { ControlFlowInformation } from './control-flow-graph';
import { visitCfgInOrder } from './simple-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';

export type CfgSimplificationPass = (cfg: ControlFlowInformation) => ControlFlowInformation;

const CfgSimplificationPasses = {
	'unique-cf-sets':   uniqueControlFlowSets,
	'remove-dead-code': cfgRemoveDeadCode,
} as const satisfies Record<string, CfgSimplificationPass>;

/**
 * Simplify the control flow information by applying the given passes.
 * This may reduce the vertex count, in- and outgoing edges, entry and exit points, etc.
 */
export function simplifyControlFlowInformation(
	cfg: ControlFlowInformation,
	passes: readonly CfgSimplificationPass[] = Object.values(CfgSimplificationPasses)
): ControlFlowInformation {
	for(const pass of passes) {
		cfg = pass(cfg);
	}
	return cfg;
}

function uniqueControlFlowSets(cfg: ControlFlowInformation): ControlFlowInformation {
	return {
		returns:     [...new Set(cfg.returns)],
		entryPoints: [...new Set(cfg.entryPoints)],
		exitPoints:  [...new Set(cfg.exitPoints)],
		breaks:      [...new Set(cfg.breaks)],
		nexts:       [...new Set(cfg.nexts)],
		graph:       cfg.graph
	};
}

/* currently this does not do work on function definitions */
function cfgRemoveDeadCode(cfg: ControlFlowInformation): ControlFlowInformation {
	// remove every root level node and accompanying vertices that can not be reached from the entry points
	const reachable = new Set<NodeId>();
	visitCfgInOrder(cfg.graph, cfg.entryPoints, node => {
		reachable.add(node);
	});
	for(const id of cfg.graph.rootVertexIds()) {
		if(!reachable.has(id)) {
			cfg.graph.removeVertex(id);
		}
	}
	return cfg;
}