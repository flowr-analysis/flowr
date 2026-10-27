import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, assertLinterWithIds } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';

/** a branch without braces cannot just go, so the fix leaves the empty block a braced one would */
function emptied(loc: [number, number, number, number]) {
	return { type: 'replace', loc, replacement: '{}', description: 'Replace the unreachable code with an empty block' } as const;
}

describe('flowR linter', withTreeSitter(parser => {
	describe('dead code', () => {

		describe('simple', () => {
			assertLinter('none', parser, 'x <- 1', 'dead-code', []);
			assertLinter('always', parser, 'if(TRUE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 17], quickFix: [emptied([1, 17, 1, 17])] }
			]);
			assertLinter('never', parser, 'if(FALSE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], quickFix: [emptied([1, 11, 1, 11])] }
			]);
			/*
			 * The dataflow analysis already resolves a constant condition away, so the branch it drops is gone
			 * from the control flow whether or not the dead code pass runs on top.
			 */
			assertLinter('no analysis', parser, 'if(FALSE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], quickFix: [emptied([1, 11, 1, 11])] }
			], undefined, { simplificationPasses: DefaultCfgSimplificationOrder });
		});

		describe('stop', () => {
			assertLinter('stopifnot true', parser, 'if(TRUE) 1; stopifnot(TRUE); 2', 'dead-code', []);
			assertLinter('stopifnot false', parser, 'if(TRUE) 1; stopifnot(FALSE); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 31, 1, 31], quickFix: [{ type: 'remove', loc: [1, 31, 1, 31], description: 'Remove the unreachable code' }] },
			]);
			assertLinter('stop condition', parser, `
x <- 2

if(u) {
  stop(42)
  x <- 3
}

print(2)
`, 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [6, 3, 6, 8], quickFix: [{ type: 'remove', loc: [6, 3, 6, 8], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('return', parser, 'function() {\nreturn(); 2}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 11, 2, 11], quickFix: [{ type: 'remove', loc: [2, 11, 2, 11], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('try', parser, 'try(stop(1)); 2', 'dead-code', []);
			assertLinter('a stop in an argument never forced stops nothing', parser, 'f <- function(a, b) a\nr <- f(1, stop("no"))\nprint(r)', 'dead-code', []);
			assertLinter('a stop in an argument always forced stops what follows', parser, 'f <- function(a, b) b\nr <- f(1, stop("no"))\nprint(r)', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 1, 2, 1] },
				{ certainty: LintingResultCertainty.Certain, loc: [3, 1, 3, 8], quickFix: [{ type: 'remove', loc: [3, 1, 3, 8], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('try complex', parser, 'f <- function() { try(stop(1)); 2 }; f(); stop(1); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 52, 1, 52], quickFix: [{ type: 'remove', loc: [1, 52, 1, 52], description: 'Remove the unreachable code' }] }
			]);
		});

		describe('non-constant', () => {
			assertLinter('always', parser, 'x <- TRUE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 25, 1, 25], quickFix: [emptied([1, 25, 1, 25])] }
			]);
			assertLinter('never', parser, 'x <- FALSE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 19, 1, 19], quickFix: [emptied([1, 19, 1, 19])] }
			]);
		});

		describe('if-elif-else', () => {
			assertLinterWithIds('TRUE FALSE', parser, 'if(TRUE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 35], involvedId: ['1@[2]if', '1@FALSE', '1@2', '1@3', '$5', '$7', '$9'], quickFix: [emptied([1, 17, 1, 35])] }
			]);
			assertLinterWithIds('FALSE FALSE', parser, 'if(FALSE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], involvedId: ['1@1', '$2'], quickFix: [emptied([1, 11, 1, 11])] },
				{ certainty: LintingResultCertainty.Certain, loc: [1, 29, 1, 29], involvedId: ['1@2', '$5'], quickFix: [emptied([1, 29, 1, 29])] }
			]);
			assertLinterWithIds('FALSE TRUE', parser, 'if(FALSE) 1 else if (TRUE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], involvedId: ['1@1', '$2'], quickFix: [emptied([1, 11, 1, 11])] },
				{ certainty: LintingResultCertainty.Certain, loc: [1, 35, 1, 35], involvedId: ['1@3', '$7'], quickFix: [emptied([1, 35, 1, 35])] }
			]);
		});

		describe('ifelse family is eager (never dead)', () => {
			assertLinter('ifelse constant', parser, 'ifelse(TRUE, 1, 2)', 'dead-code', []);
			assertLinter('ifelse non-constant', parser, 'x <- 1\nifelse(x > 0, x, -x)', 'dead-code', []);
			assertLinter('fifelse constant', parser, 'fifelse(TRUE, 1, 2)', 'dead-code', []);
			assertLinter('if_else constant', parser, 'if_else(TRUE, 1, 2)', 'dead-code', []);
		});

		describe('do.call hands the elements of a list on one by one', () => {
			assertLinter('the value a list hands on decides a branch', parser, 'f <- function(x) { if(x > 0) return("pos"); "nonpos" }\nr <- do.call(f, list(3))', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 45, 1, 52], quickFix: [{ type: 'remove', loc: [1, 45, 1, 52], description: 'Remove the unreachable code' }] }
			]);
		});

		describe('local opens an evaluation of its own', () => {
			assertLinter('a constant condition inside local is resolved as anywhere else', parser, 'local({\n  x <- 1\n  y <- if(x > 2) "big" else "small"\n})', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [3, 18, 3, 22], quickFix: [emptied([3, 18, 3, 22])] }
			]);
			assertLinter('return inside local only leaves local', parser, 'f <- function() {\n  local({ return(1) })\n  2\n}\nprint(f())', 'dead-code', []);
			assertLinter('code after the return inside local is dead', parser, 'f <- function() {\n  local({ return(1); 3 })\n  2\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 22, 2, 22], quickFix: [{ type: 'remove', loc: [2, 22, 2, 22], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('a return after the local still makes the tail dead', parser, 'f <- function() {\n  local({ return(1) })\n  return(2)\n  3\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [4, 3, 4, 3], quickFix: [{ type: 'remove', loc: [4, 3, 4, 3], description: 'Remove the unreachable code' }] }
			]);
		});

		describe('on.exit defers its expression', () => {
			// on.exit(expr) registers expr to run at function exit
			assertLinter('on.exit(return) does not poison enclosing function', parser, 'f <- function() {\n  on.exit(return(3))\n  x <- 1\n  x\n}', 'dead-code', []);
		});

		describe('switch arms are mutually exclusive', () => {
			assertLinter('sibling arms after a stop arm stay live', parser, 'f <- function(k) {\n  switch(k, a = stop("x"), b = 2, c = 3)\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('code after a switch with a stop arm stays live', parser, 'f <- function(k) {\n  r <- switch(k, a = stop("x"), b = 2)\n  r\n}', 'dead-code', []);
			assertLinter('in-arm code after a stop is dead', parser, 'f <- function(k) {\n  switch(k, a = { stop("x"); y <- 1 }, b = 2)\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 30, 2, 35], quickFix: [{ type: 'remove', loc: [2, 30, 2, 35], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('stop in the default arm keeps siblings and after live', parser, 'f <- function(k) {\n  switch(k, a = 1, b = 2, stop("x"))\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('a numeric selector past the arms picks none', parser, 'f <- function(k) {\n  switch(k, a = return(1), b = return(2), return(3))\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('numeric selector out of range falls through', parser, 'f <- function(n) {\n  switch(n, a = return(1), stop("bad"))\n  9\n}\nf(3)', 'dead-code', []);
			assertLinter('all arms return for a string selector makes the tail dead', parser, 'f <- function() {\n  switch("c", a = return(1), return(3))\n  after <- 1\n  after\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [3, 3, 3, 12], quickFix: [{ type: 'remove', loc: [3, 3, 3, 12], description: 'Remove the unreachable code' }] },
				{ certainty: LintingResultCertainty.Certain, loc: [4, 3, 4, 7], quickFix: [{ type: 'remove', loc: [4, 3, 4, 7], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('empty fall-through arms are not dead', parser, 'f <- function(k) {\n  switch(k, a =, b = 2, c = 3)\n  after <- 1\n  after\n}', 'dead-code', []);
		});

		describe('switch with a constant selector', () => {
			assertLinter('constant selector kills the other arms', parser, 'f <- function() {\n  x <- switch("b", a = 1, b = 2, c = 3)\n  x\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 20, 2, 20] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 24, 2, 24] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 34, 2, 34] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 38, 2, 38] }
			]);
			assertLinter('no match no default kills all arms', parser, 'f <- function() {\n  switch("z", a = 1, b = 2)\n  after <- 1\n  after\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 15, 2, 15] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 19, 2, 19] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 22, 2, 22] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 26, 2, 26] }
			]);
			assertLinter('no match selects the default', parser, 'f <- function() {\n  x <- switch("z", a = 1, 99)\n  x\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 20, 2, 20] },
				{ certainty: LintingResultCertainty.Certain, loc: [2, 24, 2, 24] }
			]);
			assertLinter('constant selector into an empty fall-through arm', parser, 'f <- function() {\n  x <- switch("a", a =, b = 2)\n  x\n}', 'dead-code', []);
			assertLinter('non-constant selector prunes nothing', parser, 'f <- function(k) {\n  x <- switch(k, a = 1, b = 2)\n  x\n}', 'dead-code', []);
		});

		describe('short-circuit guards evaluate their rhs conditionally', () => {
			assertLinter('|| return guard', parser, 'f <- function(x) {\n  x || return()\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('&& stop guard', parser, 'f <- function(x) {\n  x && stop("no")\n  after <- 1\n  after\n}', 'dead-code', []);
		});

		describe('realistic', () => {
			// leftover statement after the function's own return
			assertLinter('code after an early return', parser, 'f <- function(x) {\n  if (x < 0) return(NA)\n  y <- sqrt(x)\n  return(y)\n  cat("done\\n")\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [5, 3, 5, 15], quickFix: [{ type: 'remove', loc: [5, 3, 5, 15], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('live switch but dead tail', parser, 'classify <- function(type, value) {\n  scale <- switch(type, small = 1, large = 100, stop("unknown"))\n  adjusted <- value * scale\n  return(adjusted)\n  message("unreachable")\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [5, 3, 5, 24], quickFix: [{ type: 'remove', loc: [5, 3, 5, 24], description: 'Remove the unreachable code' }] }
			]);
		});

		describe('reflective name arguments', () => {
			assertLinter('exists', parser, 'x <- 1\nif(exists("x")) print(1)', 'dead-code', []);
			assertLinter('get', parser, 'x <- 1\nprint(get("x"))', 'dead-code', []);
			assertLinter('get with envir', parser, 'e <- new.env()\nassign("x", 1, envir = e)\nprint(get("x", envir = e))', 'dead-code', []);
		});

		describe('loops', () => {
			assertLinter('after infinite repeat', parser, 'repeat{ foo }; 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 16, 1, 16], quickFix: [{ type: 'remove', loc: [1, 16, 1, 16], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('a condition the loop changes for its next iteration', parser, 'run <- TRUE\ns <- FALSE\nwhile(run) {\n  if(s) run <- FALSE\n  s <- TRUE\n}\nprint("done")', 'dead-code', []);
			assertLinter('after infinite while', parser, 'while(TRUE){ foo }; 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 21, 1, 21], quickFix: [{ type: 'remove', loc: [1, 21, 1, 21], description: 'Remove the unreachable code' }] }
			]);
		});
	});
}));
