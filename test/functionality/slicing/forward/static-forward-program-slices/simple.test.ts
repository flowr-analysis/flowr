import { withTreeSitter } from '../../../_helper/shell';
import { assert, describe, test } from 'vitest';
import { createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../../../src/r-bridge/retriever';
import { staticForwardSlice } from '../../../../../src/slicing/static/static-slicer';
import type { SlicingCriteria } from '../../../../../src/slicing/criterion/parse';
import { reconstructToCode } from '../../../../../src/reconstruct/reconstruct';

describe.sequential('Simple Forward', withTreeSitter(ts => {
	function testForwardSlice(code: string, criteria: SlicingCriteria, expected: string) {
		test(`Forward slice: ${code}`, async() => {
			const result = await createDataflowPipeline(ts, {
				request: requestFromInput(code)
			}).allRemainingSteps();
			const slice = staticForwardSlice(
				result.dataflow.graph,
				result.normalize,
				criteria
			);
			const reconstructed = reconstructToCode(result.normalize, slice.result);
			assert.strictEqual(reconstructed.code, expected, 'Reconstructed code does not match expected output');
		});
	}

	testForwardSlice(`x <- 1
y <- 2
print(x + y)
		`, ['1@x'], 'x <- 1\nprint(x + y)');
	testForwardSlice(`f <- function() {
	  x <<- 2
	}
f()
print(x + y)
		`, ['2@x'], '{ x <<- 2 }\nf()\nprint(x + y)');
}));
