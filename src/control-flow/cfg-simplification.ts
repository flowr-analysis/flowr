import type { ControlFlowInformation } from './control-flow-graph';
import { visitCfgInOrder } from './simple-visitor';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { convertCfgToBasicBlocks } from './cfg-to-basic-blocks';

export type CfgSimplificationPass = (cfg: ControlFlowInformation) => ControlFlowInformation;

const CfgSimplificationPasses = {
	'unique-cf-sets':   uniqueControlFlowSets,
	'remove-dead-code': cfgRemoveDeadCode,
	'to-basic-blocks':  toBasicBlocks
} as const satisfies Record<string, CfgSimplificationPass>;

export type CfgSimplificationPassName = keyof typeof CfgSimplificationPasses;

export const DefaultCfgSimplificationOrder = [
	'unique-cf-sets',
	'remove-dead-code'
	// basic blocks must be requested
] as const satisfies CfgSimplificationPassName[];

/**
 * Simplify the control flow information by applying the given passes.
 * This may reduce the vertex count, in- and outgoing edges, entry and exit points, etc.
 */
export function simplifyControlFlowInformation(
	cfg: ControlFlowInformation,
	passes: readonly CfgSimplificationPassName[] = DefaultCfgSimplificationOrder
): ControlFlowInformation {
	for(const pass of passes) {
		const passFn = CfgSimplificationPasses[pass];
		cfg = passFn(cfg);
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

function toBasicBlocks(cfg: ControlFlowInformation): ControlFlowInformation {
	return convertCfgToBasicBlocks(cfg);
}
