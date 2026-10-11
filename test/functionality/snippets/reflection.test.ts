import { assert, describe, test } from 'vitest';
import { withShell } from '../_helper/shell';
import { decorateLabelContext, label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';

/*
 * Reflective access and redefined primitives: every expected value is the one R prints.
 */
const name = (s: string) => decorateLabelContext(label(s, ['redefinition-of-built-in-functions-primitives']), ['dataflow']);

describe('Snippets: reflection', { concurrent: false }, withShell(shell => {
	/** the slice for `criterion`, run in R, prints what the whole program prints last */
	function assertSliceRuns(title: string, code: string, criterion: SlicingCriterion, lastLine: string) {
		test(name(title), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(shell).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion] }]);
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			shell.clearEnvironment();
			const whole = await shell.sendCommandWithOutput(code);
			shell.clearEnvironment();
			const part = await shell.sendCommandWithOutput(slice);
			shell.clearEnvironment();
			assert.strictEqual(whole.at(-1), lastLine, 'the program itself');
			assert.strictEqual(part.at(-1), lastLine, `the slice:\n${slice}`);
		});
	}

	describe('redefined grouping', () => {
		assertSliceRuns('a redefined parenthesis', '`(` <- function(x) x * 2\ny <- (3)\nprint(y)', '3@print', '[1] 6');
		assertSliceRuns('a redefined parenthesis in a function', 'f <- function() {\n  `(` <- function(x) x + 1\n  (1)\n}\nprint(f())', '5@print', '[1] 2');
		assertSliceRuns('a redefined bracket', '`[` <- function(x, i) i\nv <- c(1, 2)\nprint(v[7])', '3@print', '[1] 7');
		assertSliceRuns('a redefined dollar', '`$` <- function(x, n) 42\nl <- list(a = 1)\nprint(l$a)', '3@print', '[1] 42');
	});

	describe('with on environments', () => {
		const assigned = 'e <- new.env()\nwith(e, x <- 5)\nx <- 1\n';
		assertSliceRuns('get in the environment', assigned + 'print(get("x", envir = e))', '4@print', '[1] 5');
		assertSliceRuns('dollar on the environment', assigned + 'print(e$x)', '4@print', '[1] 5');
		assertSliceRuns('with reading the environment', assigned + 'print(with(e, x))', '4@print', '[1] 5');
		assertSliceRuns('the global variable stays', 'x <- 1\ne <- new.env()\nwith(e, x <- 5)\nprint(x)', '4@print', '[1] 1');
		assertSliceRuns('an unknown environment', 'mk <- function() new.env()\ne <- mk()\nwith(e, x <- 5)\nprint(e$x)', '4@print', '[1] 5');
		assertSliceRuns('assign into an unknown environment', 'mk <- function() new.env()\ne <- mk()\nassign("x", 5, envir = e)\nprint(e$x)', '4@print', '[1] 5');
		assertSliceRuns('a parameter environment', 'f <- function(e) with(e, x <- 5)\ne <- new.env()\nf(e)\nprint(e$x)', '4@print', '[1] 5');
		assertSliceRuns('within on an environment', 'e <- new.env()\nlocal(x <- 5, envir = e)\nprint(e$x)', '3@print', '[1] 5');
	});

	describe('promises bound by name', () => {
		assertSliceRuns('delayedAssign reads at forcing time', 'y <- 1\ndelayedAssign("x", y * 10)\ny <- 2\nprint(x)', '4@print', '[1] 20');
		assertSliceRuns('delayedAssign side effects happen when forced', 'delayedAssign("x", {z <- 3; 4})\nz <- 1\nx\nprint(z)', '4@print', '[1] 3');
		assertSliceRuns('delayedAssign in a function', 'f <- function() {\n  delayedAssign("x", y)\n  y <- 7\n  x\n}\ny <- 1\nprint(f())', '7@print', '[1] 7');
		assertSliceRuns('delayedAssign into an environment', 'e <- new.env()\ndelayedAssign("x", 3, assign.env = e)\nx <- 1\nprint(e$x)', '4@print', '[1] 3');
		assertSliceRuns('delayedAssign evaluated in another environment', 'e <- new.env()\nassign("y", 9, envir = e)\ny <- 1\ndelayedAssign("x", y, eval.env = e)\nprint(x)', '5@print', '[1] 9');
		assertSliceRuns('delayedAssign forced through get', 'y <- 2\ndelayedAssign("x", y + 1)\nprint(get("x"))', '3@print', '[1] 3');
		assertSliceRuns('delayedAssign forced in a function', 'delayedAssign("x", {z <<- 3; 4})\nf <- function() x\nz <- 1\nf()\nprint(z)', '5@print', '[1] 3');
		assertSliceRuns('delayedAssign is forced once', 'y <- 1\ndelayedAssign("x", y)\ny <- 2\nx\ny <- 3\nprint(x)', '6@print', '[1] 2');
		assertSliceRuns('delayedAssign not forced by a call that skips it', 'y <- 1\ndelayedAssign("x", {y <<- 5; 0})\nf <- function(b) if(b) x\nf(FALSE)\nx\nprint(y)', '6@print', '[1] 5');
		assertSliceRuns('delayedAssign forced after a call wrote what it reads', 'k <- 1\ndelayedAssign("v", k + 1)\nf <- function() {\n  k <<- 9\n  v\n}\nprint(f())', '7@print', '[1] 10');
		assertSliceRuns('makeActiveBinding reads on every access', 'makeActiveBinding("x", function() y + 1, environment())\ny <- 4\nprint(x)', '3@print', '[1] 5');
	});
}));
