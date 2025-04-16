import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { assert, describe, test } from 'vitest';
import { TreeSitterExecutor } from '../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { Ternary } from '../../../../src/util/logic';
import type { RShell } from '../../../../src/r-bridge/shell';
import { createNormalizePipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { extractCFG } from '../../../../src/control-flow/extract-cfg';
import { happensBefore } from '../../../../src/control-flow/happens-before';
import { cfgToMermaidUrl } from '../../../../src/util/mermaid/cfg';

export function assertHappensBefore(shell: RShell, code: string, a: SingleSlicingCriterion, b: SingleSlicingCriterion, expected: Ternary) {
	// shallow copy is important to avoid killing the CFG :c
	return describe(code, () => {
		test.each([shell, new TreeSitterExecutor()])('%s', async parser => {
			const result = await createNormalizePipeline(parser, {
				request: requestFromInput(code)
			}).allRemainingSteps();
			const cfg = extractCFG(result.normalize);
			const aResolved = slicingCriterionToId(a, result.normalize.idMap);
			const bResolved = slicingCriterionToId(b, result.normalize.idMap);
			try {
				assert.strictEqual(happensBefore(cfg.graph, aResolved, bResolved), expected, `expected ${a} (resolved to ${aResolved}) to ${expected} happen before ${b} (resolved to ${bResolved})`);
				if(expected === Ternary.Always) {
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