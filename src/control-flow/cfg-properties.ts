import { CfgEdgeType, type ControlFlowGraph, type ControlFlowInformation } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { setMinus } from '../util/set';
import { log } from '../util/log';
import { visitCfgInOrder, visitCfgInReverseOrder } from './simple-visitor';

const CfgProperties = {
	'single-entry-and-exit': checkSingleEntryAndExit,
	'has-entry-and-exit':    hasEntryAndExit,
	'entry-reaches-all':     checkEntryReachesAll,
	'exit-reaches-all':      checkExitIsReachedByAll,
	/* currently not satisfied for function calls
    'at-most-one-in-fd':     c => checkFdIOCount(c, 'in', 'at-most', 1),
    'exactly-one-in-fd':     c => checkFdIOCount(c, 'in', 'exact', 1),
    'at-most-one-out-fd':    c => checkFdIOCount(c, 'out', 'at-most', 1),
    'exactly-one-out-fd':    c => checkFdIOCount(c, 'out', 'exact', 1),
    */
	'no-direct-fd-cycles':   c => checkNoDirectCycles(c, CfgEdgeType.Fd),
	'no-direct-cd-cycles':   c => checkNoDirectCycles(c, CfgEdgeType.Cd),
} as const satisfies Record<string, (cfg: ControlFlowInformation) => boolean>;

export type CfgProperty = keyof typeof CfgProperties;

function checkSingleEntryAndExit(cfg: ControlFlowInformation): boolean {
	return new Set(cfg.entryPoints).size === 1 && new Set(cfg.exitPoints).size === 1 && new Set(cfg.breaks).size === 0 &&
        new Set(cfg.returns).size === 0 && new Set(cfg.nexts).size === 0;
}

function hasEntryAndExit(cfg: ControlFlowInformation): boolean {
	return cfg.entryPoints.every(e => cfg.graph.hasVertex(e)) && cfg.exitPoints.every(e => cfg.graph.hasVertex(e));
}

function checkReachFrom(label: string, cfg: ControlFlowInformation, start: NodeId | undefined, collect: (graph: ControlFlowGraph, starts: NodeId[], fn: (node: NodeId) => void) => void): boolean {
	if(start === undefined) {
		return false;
	}
	const collected = new Set();
	collect(cfg.graph, [start], node => {
		collected.add(node);
	});

	// we only require the roots to be there
	const allVertices = cfg.graph.rootVertexIds();
	const diff = setMinus(allVertices, collected);
	if(diff.size > 0) {
		log.error(`Unreachable vertices from ${label}:`, diff);
		return false;
	}
	return true;
}

function checkExitIsReachedByAll(cfg: ControlFlowInformation): boolean {
	return checkReachFrom('exit', cfg, cfg.exitPoints[0], visitCfgInReverseOrder);
}

function checkEntryReachesAll(cfg: ControlFlowInformation): boolean {
	return checkReachFrom('entry', cfg, cfg.entryPoints[0], visitCfgInOrder);
}

function _checkFdIOCount(cfg: ControlFlowInformation, dir: 'in' | 'out', type: 'at-most' | 'exact', limit: number) {
	const counts = new Map<NodeId, number>();
	for(const [from, targets] of cfg.graph.edges()) {
		for(const [to, edge] of targets) {
			const important = dir === 'in' ? to : from;
			if(edge.label === CfgEdgeType.Fd) {
				counts.set(important, (counts.get(important) ?? 0) + 1);
			}
		}
	}
	const check = type === 'exact' ? (a: number) => a === limit : (a: number) => a <= limit;
	for(const [node, count] of counts) {
		if(type === 'exact' && (cfg.entryPoints.includes(node) || cfg.exitPoints.includes(node) || !cfg.graph.rootVertexIds().has(node))) {
			continue; // skip entry and exit points, they do not have to satisfy this
		}
		if(!check(count)) {
			log.error(`Node ${node} has ${count} ${dir} edges, expected ${type} ${limit}`);
			return false;
		}
	}
	return true;
}

function checkNoDirectCycles(cfg: ControlFlowInformation, type: CfgEdgeType): boolean {
	for(const [from, targets] of cfg.graph.edges()) {
		for(const [to, edge] of targets) {
			if(edge.label === type && to === from) {
				log.error(`Node ${from} has a direct cycle with ${to}`);
				return false;
			}
		}
	}
	return true;
}


/** either returns true or the name of the property that is not satisfied */
export type PropertyReport = true | CfgProperty;


/**
 * Check if the given CFG satisfies all properties.
 * @param cfg                 - The control flow graph to check.
 * @param excludeProperties   - If provided, exclude the given properties, otherwise this checks all properties.
 */
export function assertCfgSatisfiesProperties(cfg: ControlFlowInformation, excludeProperties?: readonly CfgProperty[]): PropertyReport {
	for(const [propName, prop] of Object.entries(CfgProperties)) {
		if((!excludeProperties || !excludeProperties.includes(propName as CfgProperty)) && !prop(cfg)) {
			return propName as PropertyReport;
		}
	}
	return true;
}