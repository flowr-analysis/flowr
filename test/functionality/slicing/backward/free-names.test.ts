import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import type { SlicingCriterion } from '../../../../src/slicing/criterion/parse';

describe('The names a slice leaves undefined', withTreeSitter(parser => {
	function testFreeNames(name: string, code: string, criterion: SlicingCriterion, expected: readonly string[]) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion], noReconstruction: true }]);
			const result = Object.values(sliced['static-slice'].results)[0] as { slice: { freeNames?: readonly string[] } };
			assert.deepStrictEqual(result.slice.freeNames, expected);
		});
	}

	testFreeNames('a slice that defines what it reads is closed', 'x <- 1\ny <- x + 1\nprint(y)', '3@y', []);
	testFreeNames('a name the program never defines is free', 'y <- undefinedThing + 1\nprint(y)', '2@y', ['undefinedThing']);
	testFreeNames('several of them are reported in order', 'y <- a + b\nprint(y)', '2@y', ['a', 'b']);
	/* the built-ins are there whatever the slice holds, and a parameter is defined by the function it belongs to */
	testFreeNames('built-ins and parameters are no free names', 'f <- function(p) print(p + 1)\nf(2)', '2@f', []);
}));
