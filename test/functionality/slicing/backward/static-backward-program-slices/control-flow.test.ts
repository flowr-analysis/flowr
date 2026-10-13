import { assertSliced, withShell, assertSliceMatchesR, withTreeSitter } from '../../../_helper/shell';
import type { TestConfigurationWithOutput } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { FlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import type { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { describe } from 'vitest';

describe('Control flow', { concurrent: false }, withShell(shell => {
	describe('Branch Coverage', () => {
		assertSliced(label('nested if', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if', 'unnamed-arguments']),
			shell, `x <- 1
if(y) {
  if(z) {
    x <- 3
  } else {
    x <- 2
  }
} else {
  x <- 4
}
print(x)`, ['11@x'], `if(y) { if(z) { x <- 3 } else 
    { x <- 2 } } else 
{ x <- 4 }
x`);

		// we don't expect to be smart about loops other than repeat at the moment, see https://github.com/flowr-analysis/flowr/issues/804
		describe.each([
			{ loop: 'repeat', caps: ['repeat-loop'] },
			{ loop: 'while(u)', caps: ['while-loop', 'logical'] },
			{ loop: 'for(i in 1:100)', caps: ['for-loop', 'numbers', 'name-normal'] }
		] satisfies { loop: string, caps: FlowrCapabilityId[] }[])('$loop', ({ loop, caps }) => {
			assertSliced(label('Break immediately', [...caps, 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
${loop} {
   x <- 2;
   break
}
print(x)`, ['6@x'], `x <- 1
${loop} {
    x <- 2
    break
}
x`,
				/* the block always breaks, so the vertex that would mark its completion is never reached */
				{ cfgExcludeProperties: ['entry-reaches-all', 'exit-reaches-all'] });
			assertSliced(label('Break in condition', [...caps, 'name-normal', 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments', 'if']),
				shell, `x <- 1
${loop} {
   x <- 2;
   if(foo) 
      break
}
print(x)`, ['7@x'], `x <- 1
${loop} {
    x <- 2
    if(foo) break
}
x`);
			assertSliced(label('Next', [...caps, 'newlines', 'name-normal', 'numbers', 'next', 'semicolons', 'unnamed-arguments']),
				shell, `x <- 1
${loop} {
   x <- 2;
   next;
   x <- 3;
}
print(x)`, ['7@x'], loop === 'repeat' ? 'x <- 1\nrepeat x <- 2\nx' : `x <- 1\n${loop} x <- 2
x`,
				{
					skipCompare:          true,
					/* they have dead code, the repeat loop never reaches the exit */
					cfgExcludeProperties: ['entry-reaches-all', 'exit-reaches-all', ...(loop === 'repeat' ? ['has-entry-and-exit' as const] : [])],
				});
		});
		assertSliced(label('a break in a loop the slice does not need is not kept', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'for-loop', 'if']),
			shell, 'x <- 0\nfor(i in 1:3) { y <- i; if(i == 2) break }\nv <- x\nv', ['4@v'], 'x <- 0\nv <- x\nv', { expectedOutput: '[1] 0', expectedSliceOutput: '[1] 0' });
		assertSliced(label('a break of an inner loop is not kept for the outer one', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'for-loop', 'if']),
			shell, 's <- 0\nfor(i in 1:3) { for(j in 1:3) { if(j == 2) break }; s <- s + i }\nv <- s\nv', ['4@v'], 's <- 0\nfor(i in 1:3) s <- s + i\nv <- s\nv', { expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
		assertSliced(label('dead code (return)', ['name-normal', 'formals-named', 'newlines', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities, 'numbers', 'return', 'unnamed-arguments', 'comments']),
			shell, `f <- function(x) {
   x <- 3 * x
   return(x)
   # everything below should no longer be included
   x <- 2
   return(x)
}

f(5)`, ['9@f'], `f <- function(x) {
        x <- 3 * x
        return(x)
    }
f(5)`, { skipCompare: true /* shell and tree-sitter place the comment differently in the ast, see https://github.com/flowr-analysis/flowr/issues/1208 */ });
		assertSliced(label('dead code (return in if)', ['name-normal', 'formals-named', 'newlines', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities, 'numbers', 'if', 'return', 'unnamed-arguments', 'comments']),
			shell, `f <- function(x) {
   x <- 3 * x
   if(k)
      return(x)
   else
      return(1)
   # everything below should no longer be included
   x <- 2
   return(x)
}

f(5)`, ['12@f'], `f <- function(x) {
        x <- 3 * x
        if(k) return(x) else
        return(1)
    }
f(5)`, { skipCompare: true /* shell and tree-sitter place the comment differently in the ast, see https://github.com/flowr-analysis/flowr/issues/1208 */ });
	});
	describe('Redefinitions', () => {
		assertSliced(label('redefining {', ['name-escaped', ...OperatorDatabase['<-'].capabilities, 'formals-dot-dot-dot', 'implicit-return', 'numbers', 'newlines']),
			shell, `\`{\` <- function(...) 3
x <- 4
{
   x <- 2
   print(x)
}
print(x)`, ['7@x'], '`{` <- function(...) 3\nx <- 4\n{ x <- 2 }\nx', { expectedOutput: '[1] 3\n[1] 4', expectedSliceOutput: '[1] 3\n[1] 4' });
	});

	describe('Dead Code', () => {
		assertSliced(label('useless branch I', ['control-flow', 'built-in', 'if']),
			shell, `
y <- 42
if(TRUE) {
   y <- TRUE
} else {
   y <- FALSE
}
print(y)`, ['8@y'], 'y <- TRUE\ny');

		assertSliced(label('useless branch II', ['control-flow', 'built-in', 'if']),
			shell, `
y <- 42
if(FALSE) {
   y <- TRUE
} else {
   y <- FALSE
}
print(y)`, ['8@y'], 'y <- FALSE\ny');

		assertSliced(label('useless branch III', ['control-flow', 'built-in', 'if']),
			shell, `
y <- 42
if(FALSE) {
   if(TRUE) {
      y <- TRUE
   } else {
      y <- FALSE
   }
} else {
   y <- TRUE
}
print(y)`, ['12@y'], 'y <- TRUE\ny');
	});

	describe('Alias Tracking', () => {
		assertSliced(label('useless branch with alias', ['control-flow', 'built-in', 'if']),
			shell, `
x <- TRUE 
y <- TRUE
if(x) {
   y <- FALSE
}
print(y)`, ['7@y'], 'y <- FALSE\ny');

		assertSliced(label('useless branch with alias ||', ['control-flow', 'built-in', 'if']),
			shell, `
x <- FALSE 
y <- TRUE
if(x) {
   y <- FALSE
}
print(y)`, ['7@y'], 'y <- TRUE\ny');
	});
	describe('Calls that throw', () => {
		/* a callee that always throws makes what follows it unreachable, but says nothing about what runs before it
		 * and nothing at all once a handler, a branch, or a loop sits between the call and the enclosing list */
		const caps: FlowrCapabilityId[] = ['exceptions-and-errors', 'control-flow', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'unnamed-arguments', 'normal-definition', 'call-normal'];
		const outputs = { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' };
		const sliced = 'x <- 1\nw <- x + 1\nw';
		const cases: [string, string, SlicingCriterion, FlowrCapabilityId[]?, Partial<TestConfigurationWithOutput>?, string?][] = [
			['always throwing callee caught by try', 'f <- function() { stop("b") }\nx <- 1\nw <- x + 1\nr <- try(f(), silent = TRUE)\nw', '5@w'],
			['always throwing callee caught by tryCatch', 'f <- function() { stop("b") }\nx <- 1\nw <- x + 1\nr <- tryCatch(f(), error = function(e) 0)\nw', '5@w'],
			['always throwing callee caught within a function', 'f <- function() { stop("b") }\nh <- function() {\n  x <- 1\n  w <- x + 1\n  r <- try(f(), silent = TRUE)\n  w\n}\nprint(h())', '6@w', undefined, { expectedSliceOutput: '' }, 'h <- function() {\n        x <- 1\n        w <- x + 1\n        w\n    }'],
			/* the caught error leaves the `stop` beside the flow, which is unrelated to the slice */
			['throw written in the try itself', 'x <- 1\nw <- x + 1\nr <- try(stop("b"), silent = TRUE)\nw', '4@w', undefined, { cfgExcludeProperties: ['entry-reaches-all'] }],
			['callee throws in one branch', 'f <- function(k) { if(k) stop("b") else 1 }\nx <- 1\nw <- x + 1\nr <- try(f(TRUE), silent = TRUE)\nw', '5@w', ['if']],
			['callee throws in every branch', 'f <- function(k) { if(k) stop("a") else stop("b") }\nx <- 1\nw <- x + 1\nr <- try(f(TRUE), silent = TRUE)\nw', '5@w', ['if']],
			['always throwing callee one level deeper', 'f <- function() { stop("b") }\ng <- function() f()\nx <- 1\nw <- x + 1\nr <- try(g(), silent = TRUE)\nw', '6@w'],
			['always throwing callee in a loop body', 'f <- function() { stop("b") }\nx <- 1\nw <- x + 1\nfor(i in integer(0)) f()\nw', '5@w', ['for-loop']],
		];
		for(const [name, code, criterion, extraCaps, extraConfig, expected] of cases) {
			assertSliced(label(name, extraCaps ? [...caps, ...extraCaps] : caps),
				shell, code, [criterion], expected ?? sliced, extraConfig ? { ...outputs, ...extraConfig } : outputs);
		}
		/* what a kept call raises is caught only as long as the handler stays, and it skips the rest of the block */
		assertSliced(label('kept call keeps the handler catching it', [...caps, 'side-effects-in-function-call']),
			shell, 'lg <- character()\nf <- function(b) { lg <<- c(lg, "o"); b }\nr <- tryCatch(f(stop("x")), error = function(e) -1)\nprint(lg)', ['4@lg'], 'lg <- character()\nf <- function(b) {\n        lg <<- c(lg, "o")\n        b\n    }\nr <- tryCatch(f(stop("x")), error = function(e) -1)\nlg', { expectedOutput: '[1] "o"', expectedSliceOutput: '[1] "o"' });
		assertSliced(label('abort in the block skips the rest of it', caps),
			shell, 'f <- function() stop("s")\nx <- 1\ntry({ f(); x <- 2 }, silent = TRUE)\nprint(x)', ['4@x'], 'f <- function() stop("s")\nx <- 1\ntry({ f(); x <- 2 }, silent = TRUE)\nx', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('return in a handler leaves only the handler', [...caps, 'return']),
			shell, 'f <- function() { tryCatch(stop("a"), error = function(e) return(1)); 2 }\nprint(f())', ['2@print'], 'f <- function() {\n        function(e) { }\n        2\n    }\nprint(f())', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		assertSliced(label('try around a call whose effects are not needed', [...caps, 'side-effects-in-function-call']),
			shell, 'f <- function() { z <<- 1; 2 }\nx <- 1\ntry(f(), silent = TRUE)\nv <- x\nv', ['5@v'], 'x <- 1\nv <- x\nv', { expectedOutput: '[1] 2\n[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('tryCatch around a call whose effects are not needed', [...caps, 'side-effects-in-function-call']),
			shell, 'f <- function() { z <<- 1; stop("e") }\nx <- 1\ntryCatch(f(), error = function(e) NULL)\nv <- x\nv', ['5@v'], 'x <- 1\nv <- x\nv', { expectedOutput: 'NULL\n[1] 1', expectedSliceOutput: '[1] 1' });
	});

}));

describe('Control flow checked against R', withTreeSitter(parser => {
	const cases: readonly (readonly [string, string])[] = [
		['unconditional break dropped', 'for(i in 1:3) { x <- i\n  break\n}\nprint(x)'],
		['unconditional break dropped: nontermination', 'while(TRUE) { x <- 1; break }\nprint(x)'],
		['unconditional break dropped: realistic search', 'data(mtcars)\ncars <- mtcars[order(-mtcars$hp), ]\ntarget_hp <- 150\nfirst_match <- NA\nfor (i in seq_len(nrow(cars))) {\n  if (cars$hp[i] > target_hp) next\n  first_match <- rownames(cars)[i]\n  break\n}\nattempt <- 0\nrepeat {\n  attempt <- attempt + 1\n  converged <- attempt >= 1\n  break\n}\ncat("@@", capture.output(print(first_match)), sep = "\\n")'],
		['tryCatch dropped around kept call', 'lg <- character()\nf <- function(b) { lg <<- c(lg, "o"); b }\nr <- tryCatch(f(stop("x")), error = function(e) -1)\nprint(lg)'],
		['tryCatch dropped: realistic resource log', 'attempts <- 0\nflaky <- function(fail_until = 3) {\n  attempts <<- attempts + 1\n  if (attempts < fail_until) stop("transient failure ", attempts)\n  "ok"\n}\nretry <- function(f, times = 5, ...) {\n  last_err <- NULL\n  for (i in seq_len(times)) {\n    res <- tryCatch(f(...), error = function(e) { last_err <<- e; NULL })\n    if (!is.null(res)) return(list(value = res, tries = i))\n  }\n  stop(last_err)\n}\nr1 <- retry(flaky)\ncleanup_log <- character()\nwith_resource <- function(name, body) {\n  cleanup_log <<- c(cleanup_log, paste("open", name))\n  on.exit(cleanup_log <<- c(cleanup_log, paste("close", name)), add = TRUE)\n  body\n}\nv1 <- with_resource("db", 42)\nv2 <- tryCatch(with_resource("file", stop("boom")), error = function(e) -1)\ncat("@@", capture.output(print(cleanup_log)), sep = "\\n")'],
		['unconditional break dropped (for)', 'for(i in 1:3) { g <- i; break }\nprint(g)'],
		['unconditional break dropped (repeat, slice never terminates)', 'repeat { g <- 5; break }\nprint(g)'],
		['constant-true break dropped (repeat, slice never terminates)', 'repeat { g <- 5; if(TRUE) break }\nprint(g)'],
		['return in tryCatch handler escapes the caller', 'f <- function() { tryCatch(stop("a"), error = function(e) return(1)); 2 }\nprint(f())'],
	];
	for(const [name, code] of cases) {
		assertSliceMatchesR(parser, name, code);
	}
}));
