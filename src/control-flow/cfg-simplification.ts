import type { ControlFlowInformation } from './control-flow-graph';
import { convertCfgToBasicBlocks } from './cfg-to-basic-blocks';
import type { NormalizedAst } from '../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { DataflowGraph } from '../dataflow/graph/graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { visitCfgInOrder } from './simple-visitor';
import { cfgAnalyzeDeadCode } from './cfg-dead-code';
import type { FlowrConfigOptions } from '../config';

export interface CfgPassInfo {
	ast?:   NormalizedAst,
	dfg?:   DataflowGraph,
	config: FlowrConfigOptions
}
export type CfgSimplificationPass = (cfg: ControlFlowInformation, info: CfgPassInfo) => ControlFlowInformation;

export const CfgSimplificationPasses = {
	'unique-cf-sets':    uniqueControlFlowSets,
	'analyze-dead-code': cfgAnalyzeDeadCode,
	'remove-dead-code':  cfgRemoveDeadCode,
	'to-basic-blocks':   toBasicBlocks
} as const satisfies Record<string, CfgSimplificationPass>;

export type CfgSimplificationPassName = keyof typeof CfgSimplificationPasses;

export const DefaultCfgSimplificationOrder = [
	'unique-cf-sets',
	// 'remove-dead-code' // way too expensive for conventional use!
	// basic blocks must be requested
] as const satisfies CfgSimplificationPassName[];

/**
 * Simplify the control flow information by applying the given passes.
 * This may reduce the vertex count, in- and outgoing edges, entry and exit points, etc.
 */
export function simplifyControlFlowInformation(
	cfg: ControlFlowInformation,
	info: CfgPassInfo,
	passes: readonly CfgSimplificationPassName[] = DefaultCfgSimplificationOrder
): ControlFlowInformation {
	for(const pass of passes) {
		const passFn = CfgSimplificationPasses[pass];
		cfg = passFn(cfg, info);
	}
	return cfg;
}

/**
 * removes dead vertices and edges from the control flow graph.
 */
function cfgRemoveDeadCode(cfg: ControlFlowInformation, _info?: CfgPassInfo): ControlFlowInformation {
	// remove every root level node and accompanying vertices that can not be reached from the entry points
	const reachable = cfgFindAllReachable(cfg);
	for(const id of cfg.graph.rootIds()) {
		if(!reachable.has(id)) {
			cfg.graph.removeVertex(id);
		}
	}
	return cfg;
}

function uniqueControlFlowSets(cfg: ControlFlowInformation, _info?: CfgPassInfo): ControlFlowInformation {
	return {
		returns:     [...new Set(cfg.returns)],
		entryPoints: [...new Set(cfg.entryPoints)],
		exitPoints:  [...new Set(cfg.exitPoints)],
		breaks:      [...new Set(cfg.breaks)],
		nexts:       [...new Set(cfg.nexts)],
		graph:       cfg.graph
	};
}

function toBasicBlocks(cfg: ControlFlowInformation, _info?: CfgPassInfo): ControlFlowInformation {
	return convertCfgToBasicBlocks(cfg);
}

export function cfgFindAllReachable(cfg: ControlFlowInformation): Set<NodeId> {
	const reachable = new Set<NodeId>();
	visitCfgInOrder(cfg.graph, cfg.entryPoints, node => {
		reachable.add(node);
	});
	return reachable;
}
