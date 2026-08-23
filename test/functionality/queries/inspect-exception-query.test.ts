import { assert, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { withTreeSitter } from '../_helper/shell';
import { label } from '../_helper/label';

describe('Inspect Exception Query', withTreeSitter(parser => {
	/** Whether the query says any of the program's function definitions may throw. */
	function testExceptions(name: string, code: string, expected: boolean) {
		test(label(name, ['name-normal'], ['other']), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(code);
			const result = await analyzer.query([{ type: 'inspect-exception' }]);
			const found = result['inspect-exception'].exceptions;
			assert.isNotEmpty(Object.keys(found), 'the query has to report every function definition');
			assert.strictEqual(Object.values(found).some(e => e.length > 0), expected, JSON.stringify(found));
		});
	}

	testExceptions('a stop throws', 'f <- function() stop("x")', true);
	testExceptions('so does one its callee makes', 'g <- function() stop("x")\nf <- function() g()', true);
	testExceptions('a conditional one throws too', 'f <- function() if(runif(1) > .5) stop("x")', true);
	testExceptions('an assertion throws when it fails', 'f <- function(x) stopifnot(x > 0)', true);
	testExceptions('a caught error does not leave the function', 'f <- function() tryCatch(stop("x"), error = function(e) NULL)', false);
	testExceptions('nor does one wrapped in try', 'f <- function() try(stop("x"))', false);
	testExceptions('a warning is no exception', 'f <- function() warning("x")', false);
}));
