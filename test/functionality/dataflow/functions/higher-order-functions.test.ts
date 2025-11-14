import { describe, assert, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { type SingleSlicingCriterion , tryResolveSliceCriterionToId } from '../../../../src/slicing/criterion/parse';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { defaultConfigOptions } from '../../../../src/config';
import { isHigherOrder } from '../../../../src/dataflow/fn/higher-order-function';

describe('is-higher-order-function', withTreeSitter(ts => {
	function testHigherOrder(
		label: string,
		code: string,
		expect: {
            pos?: SingleSlicingCriterion[]
            neg?: SingleSlicingCriterion[]
        }
	) {
		for(const [exp, crit] of [[true, expect.pos], [false, expect.neg]] as const) {
			for(const c of crit ?? []) {
				test(`${label} (expect ${c} to be ${exp ? 'ho' : 'not ho'})`, async() => {
					const df = await createDataflowPipeline(ts, {
						requests: requestFromInput(code)
					}, defaultConfigOptions).allRemainingSteps();

					const id = tryResolveSliceCriterionToId(c, df.normalize.idMap);
					// move up the error message :sparkles:
					assert.isDefined(id, `could not resolve criterion ${c}`);

					assert.strictEqual(isHigherOrder(id, df.dataflow.graph), exp);
				});
			}
		}
	}

	describe('function definitions', () => {
		testHigherOrder('identity, no calls','f <- function(x) x', { neg: ['1@function'] });
		testHigherOrder('returning fn', 'f <- function()\n    function(x) x', { pos: ['1@function'], neg: ['2@function'] });
		testHigherOrder('maybe returning fn','f <- function() {\nif(u) 42 else { function(x) x }}', {
			pos: ['1@function'],
			neg: ['2@function']
		}); // function maybe returning another function
	});

	describe('function calls', () => {
		testHigherOrder('constant call', 'f <- function(x) x\nf(42)', { neg: ['1@function', '2@f'] });
		testHigherOrder('pass fn argument', 'f <- function(x) x\nf(function(y) y)', { pos: ['1@function'], neg: ['2@function'] });
	});
}));
