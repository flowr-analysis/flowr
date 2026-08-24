import { CfgEdge, CfgEdgeType, type ControlFlowGraph, type ControlFlowInformation } from './control-flow-graph';
import type { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import { setMinus } from '../util/collections/set';
import { log } from '../util/log';
import { visitCfgInOrder, visitCfgInReverseOrder } from './simple-visitor';

/**
 * The collection of properties that can be checked on a control flow graph.
 */
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
	'no-direct-fd-cycles':   c => checkNoDirectCycles(c, CfgEdgeType.Flow),
	'no-direct-cd-cycles':   c => checkNoDirectCycles(c, CfgEdgeType.Control),
} as const satisfies Record<string, (cfg: ControlFlowInformation) => boolean>;

export type CfgProperty = keyof typeof CfgProperties;

function checkSingleEntryAndExit(cfg: ControlFlowInformation): boolean {
	return new Set(cfg.entryPoints).size === 1 && new Set(cfg.exitPoints).size === 1 && new Set(cfg.breaks).size === 0 &&
        new Set(cfg.returns).size === 0 && new Set(cfg.nexts).size === 0;
}

function hasEntryAndExit(cfg: ControlFlowInformation): boolean {
	return cfg.entryPoints.every(e => cfg.graph.hasVertex(e)) && cfg.exitPoints.every(e => cfg.graph.hasVertex(e));
}

function checkReachFrom(label: string, cfg: ControlFlowInformation, starts: readonly NodeId[], collect: (graph: ControlFlowGraph, starts: NodeId[], fn: (node: NodeId) => void) => void): boolean {
	// we only require the roots to be there
	const allVertices = cfg.graph.rootIds();
	if(allVertices.size === 0) {
		/* an empty file, one holding nothing but comments, and one that does not parse all yield an empty graph,
		   for which every vertex trivially satisfies the property */
		return true;
	}
	if(starts.length === 0) {
		return false;
	}
	const collected = new Set();
	collect(cfg.graph, [...starts], node => {
		collected.add(node);
	});

	const diff = setMinus(allVertices, collected);
	if(diff.size > 0) {
		log.error(`Unreachable vertices from ${label}:`, diff);
		return false;
	}
	return true;
}

/**
 * Every vertex reaches somewhere control stops, so the walk back starts at all of those: the exits the analysis
 * names, and every vertex control reaches and never leaves again. An argument after one that raises ends at such
 * a vertex, since a call whose parameter is never forced carries on to the call itself.
 */
function checkExitIsReachedByAll(cfg: ControlFlowInformation): boolean {
	const ends = new Set<NodeId>(cfg.exitPoints);
	if(cfg.entryPoints.length > 0) {
		visitCfgInOrder(cfg.graph, [...cfg.entryPoints], node => {
			if((cfg.graph.outgoingEdges(node)?.size ?? 0) === 0) {
				ends.add(node);
			}
		});
	}
	return checkReachFrom('exit', cfg, [...ends], visitCfgInReverseOrder);
}

function checkEntryReachesAll(cfg: ControlFlowInformation): boolean {
	return checkReachFrom('entry', cfg, cfg.entryPoints, visitCfgInOrder);
}

function _checkFdIOCount(cfg: ControlFlowInformation, dir: 'in' | 'out', type: 'at-most' | 'exact', limit: number) {
	const counts = new Map<NodeId, number>();
	for(const [from, targets] of cfg.graph.edges()) {
		for(const [to, edge] of targets) {
			const important = dir === 'in' ? to : from;
			if(CfgEdge.isFlowDependency(edge)) {
				counts.set(important, (counts.get(important) ?? 0) + 1);
			}
		}
	}
	const check = type === 'exact' ? (a: number) => a === limit : (a: number) => a <= limit;
	for(const [node, count] of counts) {
		if(type === 'exact' && (cfg.entryPoints.includes(node) || cfg.exitPoints.includes(node) || !cfg.graph.rootIds().has(node))) {
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
			if(CfgEdge.isOfType(edge, type) && to === from) {
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
