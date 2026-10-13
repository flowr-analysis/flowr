import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { assert, describe, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { Ternary } from '../../../../src/util/logic';
import type { RShell } from '../../../../src/r-bridge/shell';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../../src/control-flow/control-flow-graph';
import { happensBefore } from '../../../../src/control-flow/happens-before';
import { cfgToMermaidUrl } from '../../../../src/util/mermaid/cfg';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';
import type { KnownParser } from '../../../../src/r-bridge/parser';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { canReach } from '../../../../src/control-flow/simple-visitor';

/** whether control reaches `target` from the start, on the control flow graph of a fresh analyzer */
export async function controlReaches(parser: KnownParser, code: string, target: SlicingCriterion): Promise<boolean> {
	const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
	analyzer.addRequest(code);
	const { idMap } = await analyzer.normalize();
	const cfg = await analyzer.controlflow(undefined, true);
	return canReach(cfg.graph, cfg.entryPoints, SlicingCriterion.parse(target, idMap));
}

/**
 * Asserts that in the given code, criterion `a` happens before criterion `b` according to the expected Ternary value.
 * @param shell    - The RShell instance to use for parsing and analysis.
 * @param code     - The R code to analyze.
 * @param a        - The first slicing criterion.
 * @param b        - The second slicing criterion that is compared against the first.
 * @param expected - The expected Ternary result indicating the happens-before relationship.
 * @param reversed - Whether to check the reversed relationship as well, which fails where the end of a function is unreachable.
 */
export function assertHappensBefore(shell: RShell, code: string, a: SlicingCriterion, b: SlicingCriterion, expected: Ternary, reversed = true) {
	// shallow copy is important to avoid killing the CFG :c
	return describe(code, () => {
		test.each([shell, new TreeSitterExecutor()])('%s', async parser => {
			const context = contextFromInput(code);
			const result = await createDataflowPipeline(parser, {
				context
			}).allRemainingSteps();
			const cfg = extractCfg(result.dataflow);
			const aResolved = SlicingCriterion.parse(a, result.normalize.idMap);
			const bResolved = SlicingCriterion.parse(b, result.normalize.idMap);
			try {
				assert.strictEqual(happensBefore(cfg.graph, aResolved, bResolved), expected, `expected ${a} (resolved to ${aResolved}) to ${expected} happen before ${b} (resolved to ${bResolved})`);
				if(!reversed) {
					return;
				} else if(expected === Ternary.Always) {
					assert.strictEqual(happensBefore(cfg.graph, bResolved, aResolved), Ternary.Never, 'reversed');
				} else if(expected === Ternary.Never) {
					assert.strictEqual(happensBefore(cfg.graph, bResolved, aResolved), Ternary.Always, 'reversed');
				}
			} /* v8 ignore next 4 */ catch(e: unknown) {
				console.error(`actual: ${cfgToMermaidUrl(cfg, result.normalize)}`);
				throw e;
			}
		});
	});
}