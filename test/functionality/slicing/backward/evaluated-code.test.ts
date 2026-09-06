import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { assumeLoadedPackages, withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import type { SlicingCriterion } from '../../../../src/slicing/criterion/parse';

assumeLoadedPackages('glue');

/**
 * Code flowR only gets to run through a detour -- a captured expression handed to `eval`, or the R inside a
 * string template -- still has to reach the slice, in both directions.
 */
describe('Slicing code that is evaluated indirectly', withTreeSitter(parser => {
	function testSlice(name: string, code: string, criterion: SlicingCriterion, expected: string) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion] }]);
			const result = Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } };
			assert.strictEqual(result.reconstruct.code, expected);
		});
	}

	testSlice('what a quoted expression assigns reaches the later read',
		'eval(quote(x <- 1))\nprint(x)', '2@print', 'x <- 1\nprint(x)');
	testSlice('also when the expression is bound to a name first',
		'e <- quote(x <- 1)\neval(e)\nprint(x)', '3@print', 'x <- 1\nprint(x)');
	testSlice('an interpolated name pulls its definition in',
		'y <- 2\nz <- glue::glue("val {y}")', '2@z', 'y <- 2\nz <- glue::glue("val {y}")');
	testSlice('a template without interpolation needs nothing',
		'y <- 2\nz <- glue::glue("val")', '2@z', 'z <- glue::glue("val")');
}));
