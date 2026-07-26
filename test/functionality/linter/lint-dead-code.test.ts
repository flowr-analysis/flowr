import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, assertLinterWithIds } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { DefaultCfgSimplificationOrder } from '../../../src/control-flow/cfg-simplification';

describe('flowR linter', withTreeSitter(parser => {
	describe('dead code', () => {

		describe('simple', () => {
			assertLinter('none', parser, 'x <- 1', 'dead-code', []);
			assertLinter('always', parser, 'if(TRUE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 17] }
			]);
			assertLinter('never', parser, 'if(FALSE) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11] }
			]);
			assertLinter('no analysis', parser, 'if(FALSE) 1 else 2', 'dead-code', [], undefined, { simplificationPasses: DefaultCfgSimplificationOrder });
		});

		describe('stop', () => {
			assertLinter('stopifnot true', parser, 'if(TRUE) 1; stopifnot(TRUE); 2', 'dead-code', []);
			assertLinter('stopifnot false', parser, 'if(TRUE) 1; stopifnot(FALSE); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 31, 1, 31] },
			]);
			assertLinter('stop condition', parser, `
x <- 2

if(u) {
  stop(42)
  x <- 3
}

print(2)
`, 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [6, 3, 6, 8] }
			]);
			assertLinter('return', parser, 'function() {\nreturn(); 2}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 11, 2, 11] }
			]);
			assertLinter('try', parser, 'try(stop(1)); 2', 'dead-code', []);
			assertLinter('try complex', parser, 'f <- function() { try(stop(1)); 2 }; f(); stop(1); 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 52, 1, 52] }
			]);
		});

		describe('non-constant', () => {
			assertLinter('always', parser, 'x <- TRUE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 25, 1, 25] }
			]);
			assertLinter('never', parser, 'x <- FALSE; if(x) 1 else 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 19, 1, 19] }
			]);
		});

		describe('if-elif-else', () => {
			assertLinterWithIds('TRUE FALSE', parser, 'if(TRUE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 17, 1, 35], involvedId: ['1@[2]if', '1@FALSE', '1@2', '1@3', '$5', '$7', '$9'] }
			]);
			assertLinterWithIds('FALSE FALSE', parser, 'if(FALSE) 1 else if (FALSE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], involvedId: ['1@1', '$2'] },
				{ certainty: LintingResultCertainty.Certain, loc: [1, 29, 1, 29], involvedId: ['1@2', '$5'] }
			]);
			assertLinterWithIds('FALSE TRUE', parser, 'if(FALSE) 1 else if (TRUE) 2 else 3', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 11, 1, 11], involvedId: ['1@1', '$2'] },
				{ certainty: LintingResultCertainty.Certain, loc: [1, 35, 1, 35], involvedId: ['1@3', '$7'] }
			]);
		});

		describe('ifelse family is eager (never dead)', () => {
			assertLinter('ifelse constant', parser, 'ifelse(TRUE, 1, 2)', 'dead-code', []);
			assertLinter('ifelse non-constant', parser, 'x <- 1\nifelse(x > 0, x, -x)', 'dead-code', []);
			assertLinter('fifelse constant', parser, 'fifelse(TRUE, 1, 2)', 'dead-code', []);
			assertLinter('if_else constant', parser, 'if_else(TRUE, 1, 2)', 'dead-code', []);
		});

		describe('on.exit defers its expression', () => {
			// on.exit(expr) registers expr to run at function exit
			assertLinter('on.exit(return) does not poison enclosing function', parser, 'f <- function() {\n  on.exit(return(3))\n  x <- 1\n  x\n}', 'dead-code', []);
		});

		describe('switch arms are mutually exclusive', () => {
			assertLinter('sibling arms after a stop arm stay live', parser, 'f <- function(k) {\n  switch(k, a = stop("x"), b = 2, c = 3)\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('code after a switch with a stop arm stays live', parser, 'f <- function(k) {\n  r <- switch(k, a = stop("x"), b = 2)\n  r\n}', 'dead-code', []);
			assertLinter('in-arm code after a stop is dead', parser, 'f <- function(k) {\n  switch(k, a = { stop("x"); y <- 1 }, b = 2)\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [2, 30, 2, 35] }
			]);
			assertLinter('stop in the default arm keeps siblings and after live', parser, 'f <- function(k) {\n  switch(k, a = 1, b = 2, stop("x"))\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('all arms return makes the tail dead', parser, 'f <- function(k) {\n  switch(k, a = return(1), b = return(2), return(3))\n  after <- 1\n  after\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [3, 3, 3, 12] },
				{ certainty: LintingResultCertainty.Certain, loc: [4, 3, 4, 7] }
			]);
			assertLinter('empty fall-through arms are not dead', parser, 'f <- function(k) {\n  switch(k, a =, b = 2, c = 3)\n  after <- 1\n  after\n}', 'dead-code', []);
		});

		describe('short-circuit guards evaluate their rhs conditionally', () => {
			assertLinter('|| return guard', parser, 'f <- function(x) {\n  x || return()\n  after <- 1\n  after\n}', 'dead-code', []);
			assertLinter('&& stop guard', parser, 'f <- function(x) {\n  x && stop("no")\n  after <- 1\n  after\n}', 'dead-code', []);
		});

		describe('realistic', () => {
			// leftover statement after the function's own return
			assertLinter('code after an early return', parser, 'f <- function(x) {\n  if (x < 0) return(NA)\n  y <- sqrt(x)\n  return(y)\n  cat("done\\n")\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [5, 3, 5, 15] }
			]);
			// a live switch (arms + tail reachable) but a genuine dead statement after the final return
			assertLinter('live switch but dead tail', parser, 'classify <- function(type, value) {\n  scale <- switch(type, small = 1, large = 100, stop("unknown"))\n  adjusted <- value * scale\n  return(adjusted)\n  message("unreachable")\n}', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [5, 3, 5, 24] }
			]);
		});

		describe('loops', () => {
			assertLinter('after infinite repeat', parser, 'repeat{ foo }; 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 16, 1, 16] }
			]);
			assertLinter('after infinite while', parser, 'while(TRUE){ foo }; 2', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 21, 1, 21] }
			]);
		});
	});
}));
