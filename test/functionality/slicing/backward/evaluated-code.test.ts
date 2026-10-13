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

	testSlice('a definition made by a caller reaches the evaluated read',
		'g <- function() eval(quote(v))\nh <- function() { v <- 1; g() }\nh()', '1@v', 'g <- function() eval(quote(v))\nh <- function() v <- 1');

	/* every evaluation is checked against every definition of its names, which has to stay a single walk of the control flow */
	test('many evaluations of many caller definitions stay fast', async() => {
		const count = 250;
		const evals = Array.from({ length: count }, (_, i) => `eval(quote(v${i % 7} + w))`).join('; ');
		const callers = Array.from({ length: count }, (_, i) => `h${i} <- function(z) { v${i % 7} <- z; w <- 2; g() }`);
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest([`g <- function() { ${evals} }`, ...callers].join('\n'));
		const started = Date.now();
		await analyzer.dataflow();
		assert.isBelow(Date.now() - started, 30_000);
	});
	testSlice('what a quoted expression assigns reaches the later read',
		'eval(quote(x <- 1))\nprint(x)', '2@print', 'x <- 1\nprint(x)');
	/* the code a name holds is evaluated where `eval` runs, checked against R */
	testSlice('a symbol built from a string and bound to a name', 'nm <- as.name("w")\nw <- 3\ny <- eval(nm)', '3@y', 'nm <- as.name("w")\nw <- 3\ny <- eval(nm)');
	testSlice('a string parsed with str2lang and bound to a name', 'nm <- str2lang("w + 1")\nw <- 3\ny <- eval(nm)', '3@y', 'nm <- str2lang("w + 1")\nw <- 3\ny <- eval(nm)');
	testSlice('also when the expression is bound to a name first',
		'e <- quote(x <- 1)\neval(e)\nprint(x)', '3@print', 'e <- quote(x <- 1)\neval(e)\nprint(x)');
	testSlice('an expression bound to a name is evaluated as often as it is evaluated',
		'w <- 1\ne <- quote(w <- w + 1)\neval(e)\neval(e)\nprint(w)', '5@print', 'w <- 1\ne <- quote(w <- w + 1)\neval(e)\neval(e)\nprint(w)');
	testSlice('an evaluated expression that defines nothing the slice needs is not kept',
		'x <- 1\ne <- quote(z <- 2)\neval(e)\nprint(x)', '4@print', 'x <- 1\nprint(x)');
	testSlice('of two evaluated expressions only the one defining the value is kept',
		'w <- 1\ne <- quote(w <- w + 1)\nf <- quote(z <- 3)\neval(e)\neval(f)\nprint(w)', '6@print', 'w <- 1\ne <- quote(w <- w + 1)\neval(e)\nprint(w)');
	testSlice('an expression bound to a name is evaluated where the loop evaluates it',
		'e <- quote(w <- w + 1)\nw <- 1\nfor(i in 1:3) eval(e)\nprint(w)', '4@print', 'e <- quote(w <- w + 1)\nw <- 1\nfor(i in 1:3) eval(e)\nprint(w)');
	testSlice('an expression evaluated by a function is evaluated once per call',
		'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nf()\nf()\nprint(w)', '6@print', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nf()\nf()\nprint(w)');
	testSlice('an expression evaluated by a function called in a loop',
		'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nfor(i in 1:3) f()\nprint(w)', '5@print', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nfor(i in 1:3) f()\nprint(w)');
	testSlice('an expression evaluated by a function called via lapply',
		'e <- quote(w <<- w + 1)\nw <- 1\nf <- function(i) eval(e)\ninvisible(lapply(1:3, f))\nprint(w)', '5@print', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function(i) eval(e)\nlapply(1:3, f)\nprint(w)');
	testSlice('an expression evaluated by a recursive function',
		'e <- quote(w <<- w + 1)\nw <- 1\nf <- function(n) { eval(e); if(n > 1) f(n - 1) }\nf(3)\nprint(w)', '5@print', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function(n) {\n        eval(e)\n        if(n > 1) f(n - 1)\n    }\nf(3)\nprint(w)');
	testSlice('an expression evaluated by a function another function calls',
		'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\ng <- function() f()\ng()\ng()\nprint(w)', '7@print', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\ng <- function() f()\ng()\ng()\nprint(w)');
	testSlice('an expression evaluated twice in the frame of a function',
		'e <- quote(w <- w + 1)\nf <- function() { w <- 1; eval(e); eval(e); w }\nprint(f())', '3@print', 'e <- quote(w <- w + 1)\nf <- function() {\n        w <- 1\n        eval(e)\n        eval(e)\n        w\n    }\nprint(f())');
	testSlice('an expression evaluated in another environment by a function',
		'e <- quote(w <- w + 1)\nenv <- new.env()\nenv$w <- 1\nf <- function() eval(e, envir = env)\nf()\nf()\nprint(env$w)', '7@print', 'e <- quote(w <- w + 1)\nenv <- new.env()\nenv$w <- 1\nf <- function() eval(e, envir = env)\nf()\nf()\nprint(env$w)');
	testSlice('an expression evaluated twice in another environment',
		'e <- quote(w <- w + 1)\nenv <- new.env()\nassign("w", 1, envir = env)\neval(e, envir = env)\neval(e, envir = env)\nprint(get("w", envir = env))', '6@print', 'e <- quote(w <- w + 1)\nenv <- new.env()\nassign("w", 1, envir = env)\neval(e, envir = env)\neval(e, envir = env)\nprint(get("w", envir = env))');
	testSlice('an evaluation whose writes the criterion does not need is not kept',
		'e <- quote(v <<- 1)\nw <- 1\nf <- function() eval(e)\nf()\nprint(w)', '5@print', 'w <- 1\nprint(w)');
	testSlice('a function evaluating an expression but never called keeps nothing',
		'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nprint(w)', '4@print', 'w <- 1\nprint(w)');
	testSlice('an expression evaluated in the frame of a function leaves the global binding alone',
		'e <- quote(w <- w + 1)\nw <- 1\nf <- function() eval(e)\nf()\nprint(w)', '5@print', 'w <- 1\nprint(w)');
	testSlice('an interpolated name pulls its definition in',
		'y <- 2\nz <- glue::glue("val {y}")', '2@z', 'y <- 2\nz <- glue::glue("val {y}")');
	testSlice('a template without interpolation needs nothing',
		'y <- 2\nz <- glue::glue("val")', '2@z', 'z <- glue::glue("val")');
}));
