import { assert, test } from 'vitest';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import type { KnownParser } from '../../../src/r-bridge/parser';
import type { NodeId } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { normalizeIdToNumberIfPossible } from '../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import { diffOfControlFlowGraphs } from '../../../src/control-flow/diff-cfg';
import type { GraphDifferenceReport } from '../../../src/util/diff-graph';
import type { ControlFlowGraph, ControlFlowInformation } from '../../../src/control-flow/control-flow-graph';
import { emptyControlFlowInformation } from '../../../src/control-flow/control-flow-graph';
import { extractCFG } from '../../../src/control-flow/extract-cfg';
import { visitCfgInOrder, visitCfgInReverseOrder } from '../../../src/control-flow/visitor';
import { setMinus } from '../../../src/util/set';
import { log } from '../../../src/util/log';

function normAllIds(ids: readonly NodeId[]): NodeId[] {
	return ids.map(normalizeIdToNumberIfPossible);
}

export interface AssertCfgOptions {
	expectIsSubgraph: boolean
}


/**
 * Assert that the given code produces the expected CFG
 */
export function assertCfg(parser: KnownParser, code: string, partialExpected: Partial<ControlFlowInformation>, config?: Partial<AssertCfgOptions>) {
	// shallow copy is important to avoid killing the CFG :c
	const expected: ControlFlowInformation = { ...emptyControlFlowInformation(), ...partialExpected };
	return test(code, async()=> {
		const result = await createDataflowPipeline(parser, {
			request: requestFromInput(code)
		}).allRemainingSteps();
		const cfg = extractCFG(result.normalize, result.dataflow?.graph);

		let diff: GraphDifferenceReport | undefined;
		try {
			assert.deepStrictEqual(normAllIds(cfg.entryPoints), normAllIds(expected.entryPoints), 'entry points differ');
			assert.deepStrictEqual(normAllIds(cfg.exitPoints),  normAllIds(expected.exitPoints), 'exit points differ');
			assert.deepStrictEqual(normAllIds(cfg.breaks),      normAllIds(expected.breaks), 'breaks differ');
			assert.deepStrictEqual(normAllIds(cfg.nexts),       normAllIds(expected.nexts), 'nexts differ');
			assert.deepStrictEqual(normAllIds(cfg.returns),     normAllIds(expected.returns), 'returns differ');
			const check = assertCfgSatisfiesProperties(cfg);
			assert.isTrue(check, 'cfg fails properties: ' + check + ' is not satisfied');
			diff = diffOfControlFlowGraphs({ graph: expected.graph, name: 'expected' }, { graph: cfg.graph, name: 'got' }, {
				leftIsSubgraph: config?.expectIsSubgraph
			});
			assert.isTrue(diff.isEqual(), 'graphs differ:' + (diff?.comments() ?? []).join('\n'));
		} /* v8 ignore next 7 */ catch(e: unknown) {
			if(diff) {
				console.error(diff.comments());
			}
			console.error(`expected: ${cfgToMermaidUrl(expected, result.normalize)}`);
			console.error(`actual: ${cfgToMermaidUrl(cfg, result.normalize)}`);
			throw e;
		}
	});
}

const CfgProperties = {
	'single-entry-and-exit': (cfg: ControlFlowInformation) =>
		new Set(cfg.entryPoints).size === 1 && new Set(cfg.exitPoints).size === 1 && new Set(cfg.breaks).size === 0 &&
		new Set(cfg.returns).size === 0 && new Set(cfg.nexts).size === 0
	,
	'entry-reaches-all': checkEntryReachesAll,
	'exit-reaches-all':  checkExitIsReachedByAll
} as const satisfies Record<string, (cfg: ControlFlowInformation) => boolean>;

export type CfgProperty = keyof typeof CfgProperties;

function checkReachFrom(label: string, cfg: ControlFlowInformation, start: NodeId | undefined, collect: (graph: ControlFlowGraph, start: NodeId, fn: (node: NodeId) => void) => void): boolean {
	if(start === undefined) {
		return false;
	}
	const collected = new Set();
	collect(cfg.graph, start, node => {
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
	return checkReachFrom('exit', cfg, cfg.entryPoints[0], visitCfgInOrder);
}



/** either returns true or the name of the property that is not satisfied */
export type PropertyReport = true | CfgProperty;


/**
 * Check if the given CFG satisfies all properties.
 * @param cfg                 - The control flow graph to check.
 * @param onlyCheckProperties - If provided, only check the given properties, otherwise this checks all properties.
 */
export function assertCfgSatisfiesProperties(cfg: ControlFlowInformation, onlyCheckProperties?: readonly CfgProperty[]): PropertyReport {
	for(const [propName, prop] of Object.entries(CfgProperties)) {
		if((!onlyCheckProperties || onlyCheckProperties.includes(propName as CfgProperty)) && !prop(cfg)) {
			return propName as PropertyReport;
		}
	}
	return true;
}