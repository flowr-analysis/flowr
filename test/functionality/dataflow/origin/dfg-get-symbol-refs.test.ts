import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { createDataflowPipeline } from '../../../../src/core/steps/pipeline/default-pipelines';
import { getAllRefsToSymbol } from '../../../../src/dataflow/origin/dfg-get-symbol-refs';
import { type SingleSlicingCriterion, type SlicingCriteria , slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import { contextFromInput } from '../../../../src/project/context/flowr-analyzer-context';

describe.sequential('Get Symbol Refs Test', withTreeSitter(shell => {
	function testCode(name: string, criterion: SingleSlicingCriterion, code: string, expected: SlicingCriteria | undefined) {
		test(name, async() => {
			const { dataflow, normalize } =
			await createDataflowPipeline(shell, { context: contextFromInput(code.trim()) }).allRemainingSteps();

			const refs = getAllRefsToSymbol(dataflow.graph, slicingCriterionToId(criterion, normalize.idMap));
			if(expected !== undefined) {
				const expectedIds = expected.map(c => slicingCriterionToId(c, normalize.idMap));
				assert.deepEqual(refs, expectedIds);
			} else {
				assert.isUndefined(refs);
			}

		});
	}

	testCode('Simple Use', '2@x', 'x <- 5\nprint(x)',             ['1@x', '2@x']);
	testCode('Simple Def', '1@x', 'x <- 5\nprint(x)',             ['1@x', '2@x']);
	testCode('Named Arg',  '1@x', 'f <- function(x) {}\n f(x=1)', ['1@x', '$11']);
}));