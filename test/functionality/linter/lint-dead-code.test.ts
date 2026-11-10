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
			assertLinter('a stop in a default read later keeps the body before the read live', parser, 'f <- function(x = stop("need x")) {\n  cat("A")\n  x\n}\nf(1)', 'dead-code', []);
			assertLinter('a stop in a default read later keeps the read live', parser, 'f <- function(a, x = stop("need x")) {\n  y <- a\n  x\n}\nf(1)', 'dead-code', []);
			/* the variables a load restores are made up for the call, they are no code of their own */
			assertLinter('a load restoring what the program saved', parser, 'x <- 5\nsave(x, file = "x.RData")\nrm(x)\nload("x.RData")\nprint(x)', 'dead-code', []);
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
			assertLinter('a stop in an argument forced within tryCatch stops nothing', parser, 'f <- function(x) tryCatch(x, error = function(e) 1)\nf(stop("a"))\nprint(2)', 'dead-code', []);
			assertLinter('a stop in an argument forced within try stops nothing', parser, 'f <- function(x) { r <- try(x, silent = TRUE); class(r) }\nf(stop("a"))\nprint(2)', 'dead-code', []);
			assertLinter('a while condition on an outer variable the body redefines locally is not constant', parser, 'k <- 0\ng <- function() {\n  while(k < 2) {\n    k <- k + 1\n    if(runif(1) > 2) return(1)\n  }\n  cat("live")\n}\ng()', 'dead-code', []);
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
			assertLinter('a return in a local may preempt the stops after it, so the local does not surely stop', parser, 'f <- function(a, cc) {\n  local({\n    if(!a) return(1)\n    if(cc) stop("x")\n    stop("y")\n  })\n  cat("live")\n}', 'dead-code', []);
			assertLinter('a return in evaluated code leaves only the eval', parser, 'g <- function() {\n  eval(quote(return(1)))\n  cat("live")\n}\ng()', 'dead-code', []);
			assertLinter('a return in parsed evaluated code leaves only the eval', parser, 'g <- function() {\n  eval(parse(text = "return(1)"))\n  cat("live")\n}\ng()', 'dead-code', []);
			assertLinter('a stop in evaluated code still leaves the function', parser, 'g <- function() {\n  eval(quote(stop("x")))\n  cat("dead")\n}\ng()', 'dead-code', [{ certainty: LintingResultCertainty.Certain, loc: [3, 3, 3, 13], quickFix: [{ type: 'remove', loc: [3, 3, 3, 13], description: 'Remove the unreachable code' }] }]);
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
			assertLinter('a call of several possible callees that only some stop is not certain to stop', parser, 'g <- function(k) {\n  h <- function() stop("e")\n  if(k) h <- function() 1\n  h()\n  cat("maybe")\n}\ng(TRUE)', 'dead-code', []);
			assertLinter('a call of several possible callees that all stop stops', parser, 'g <- function(k) {\n  h <- function() stop("a")\n  if(k) h <- function() stop("b")\n  h()\n  cat("dead")\n}', 'dead-code', [{ certainty: LintingResultCertainty.Certain, loc: [5, 3, 5, 13], quickFix: [{ type: 'remove', loc: [5, 3, 5, 13], description: 'Remove the unreachable code' }] }]);
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

		/* #2810: an `else if` without a final `else` may take neither branch, so what follows still runs */
		describe('returns in an else-if chain without a final else', () => {
			assertLinter('braced chain', parser, 'test <- function(x, a, b, c) {\n\tif (x %in% 1:2) {\n\t\treturn(a)\n\t} else if (x %in% 3:4) {\n\t\treturn(b)\n\t}\n\tc\n}', 'dead-code', []);
			assertLinter('unbraced chain', parser, 'test <- function(x, a, b, c) { if (x %in% 1:2) return(a) else if (x %in% 3:4) return(b) ; c }', 'dead-code', []);
			assertLinter('a while whose condition stops is analyzed and leaves the body dead', parser, 'r <- tryCatch(while(stop("e")) cat("dead"), error = function(e) NULL)\ncat("live")', 'dead-code', [{ certainty: LintingResultCertainty.Certain, loc: [1, 32, 1, 42], quickFix: [emptied([1, 32, 1, 42])] }]);
			assertLinter('called with a value no branch takes', parser, 'test <- function(x, a, b, c) { if (x %in% 1:2) return(a) else if (x %in% 3:4) return(b) ; c }\ntest(5, 1, 2, 3)', 'dead-code', []);
			assertLinter('a symbol condition', parser, 'f <- function(x, y) { if (x) return(1) else if (y) return(2) ; 3 }', 'dead-code', []);
			assertLinter('a chain in a for body', parser, 'f <- function(x) { for(i in x) { if(i == 1) return(1) else if(i == 2) return(2) }; 3 }', 'dead-code', []);
			assertLinter('a chain of breaks in a repeat', parser, 'repeat { if(a) break else if(b) next }; 3', 'dead-code', []);
			assertLinter('a chain of stops in a tryCatch', parser, 'tryCatch({ if(a) stop("x") else if(b) stop("y") }, error = function(e) 1); 3', 'dead-code', []);
			assertLinter('a chain nested in an else', parser, 'f <- function(a, b, c) { if(a) { return(1) } else { if(b) return(2) else if(c) return(3) }; 4 }', 'dead-code', []);
			assertLinter('a stop after a conditional return of a local function is not certain', parser, 'f <- function(cc) {\n  g <- function() {\n    if(!cc) return(1)\n    stop("x")\n  }\n  g()\n  cat("live")\n}', 'dead-code', []);
			assertLinter('an unconditional stop in a local function still ends the callers', parser, 'f <- function(cc) {\n  g <- function() {\n    stop("x")\n    cat("dead")\n  }\n  g()\n  cat("dead too")\n}', 'dead-code', [{ certainty: LintingResultCertainty.Certain, loc: [4, 5, 4, 15], quickFix: [{ type: 'remove', loc: [4, 5, 4, 15], description: 'Remove the unreachable code' }] }, { certainty: LintingResultCertainty.Certain, loc: [7, 3, 7, 17], quickFix: [{ type: 'remove', loc: [7, 3, 7, 17], description: 'Remove the unreachable code' }] }]);
			assertLinter('a long chain', parser, 'f <- function(a, b, c, d) { if(a) return(1) else if(b) return(2) else if(c) return(3) else if(d) return(4); 5 }', 'dead-code', []);
			assertLinter('a chain in a local', parser, 'local({ if(a) return(1) else if(b) return(2); 3 })', 'dead-code', []);
			assertLinter('an inner if-else under a then whose else-if has no else', parser, 'f <- function(a, b) { if(a) { if(b) return(1) else return(2) } else if(b) return(3); 4 }', 'dead-code', []);
			assertLinter('a full inner if-else under a full if', parser, 'f <- function(a, b) { if(a) { if(b) return(1) else return(2) } else return(3); 4 }', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 80, 1, 80], quickFix: [{ type: 'remove', loc: [1, 80, 1, 80], description: 'Remove the unreachable code' }] }
			]);
			assertLinter('a final else makes the tail dead', parser, 'f <- function(x, y) { if (x) return(1) else if (y) return(2) else return(4) ; 3 }', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [1, 79, 1, 79], quickFix: [{ type: 'remove', loc: [1, 79, 1, 79], description: 'Remove the unreachable code' }] }
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
			assertLinter('a stop in a for body that may not run', parser, 'for(i in seq_len(0)) stop("never")\nprint("alive")', 'dead-code', []);
			assertLinter('a stop in a while body that may not run', parser, 'while(x) stop("never")\nprint("alive")', 'dead-code', []);
			assertLinter('a return in a for body that may not run', parser, 'f <- function(x) { for(i in x) return(1); 2 }\nprint(f(integer(0)))', 'dead-code', []);
		});

		describe('quoted and delayed code', () => {
			assertLinter('a quoted stop', parser, 'quote(stop("e"))\nprint("alive")', 'dead-code', []);
			assertLinter('a quoted stop in a block', parser, 'quote({ x <- 1; stop("e") })\nprint("alive")', 'dead-code', []);
			assertLinter('a delayed stop', parser, 'delayedAssign("p", stop("lazy"))\nprint("alive")', 'dead-code', []);
			assertLinter('a quoted stop an eval runs', parser, 'e <- quote(stop("e"))\neval(e)\nprint("dead")', 'dead-code', [
				{ certainty: LintingResultCertainty.Certain, loc: [3, 1, 3, 13], quickFix: [{ type: 'remove', loc: [3, 1, 3, 13], description: 'Remove the unreachable code' }] }
			]);
		});
	});
}));
