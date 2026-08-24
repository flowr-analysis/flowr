import { assertSliced, withShell } from '../../../_helper/shell';
import type { TestConfigurationWithOutput } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
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
		] satisfies { loop: string, caps: SupportedFlowrCapabilityId[] }[])('$loop', ({ loop, caps }) => {
			assertSliced(label('Break immediately', [...caps, 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
${loop} {
   x <- 2;
   break
}
print(x)`, ['6@x'], `x <- 1\n${loop} x <- 2\nx`,
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
					skipCompare:          true /* see https://github.com/flowr-analysis/flowr/issues/1209 */,
					/* they have dead code, the repeat loop never reaches the exit */
					cfgExcludeProperties: ['entry-reaches-all', 'exit-reaches-all', ...(loop === 'repeat' ? ['has-entry-and-exit' as const] : [])],
				});
		});
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
f(5)`, { skipCompare: true /* inconsistent comment placement in ast, see https://github.com/flowr-analysis/flowr/issues/1208 */ });
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
f(5)`, { skipCompare: true /* inconsistent comment placement in ast, see https://github.com/flowr-analysis/flowr/issues/1208 */ });
	});
	describe('Redefinitions', () => {
		assertSliced(label('redefining {', ['name-escaped', ...OperatorDatabase['<-'].capabilities, 'formals-dot-dot-dot', 'implicit-return', 'numbers', 'newlines']),
			shell, `\`{\` <- function(...) 3
x <- 4
{
   x <- 2
   print(x)
}
print(x)`, ['7@x'], 'x <- 2\nx');
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
		const caps: SupportedFlowrCapabilityId[] = ['exceptions-and-errors', 'control-flow', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'unnamed-arguments', 'normal-definition', 'call-normal'];
		const outputs = { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' };
		const sliced = 'x <- 1\nw <- x + 1\nw';
		const cases: [string, string, SlicingCriterion, SupportedFlowrCapabilityId[]?, Partial<TestConfigurationWithOutput>?][] = [
			['always throwing callee caught by try', 'f <- function() { stop("b") }\nx <- 1\nw <- x + 1\nr <- try(f(), silent = TRUE)\nw', '5@w'],
			['always throwing callee caught by tryCatch', 'f <- function() { stop("b") }\nx <- 1\nw <- x + 1\nr <- tryCatch(f(), error = function(e) 0)\nw', '5@w'],
			['always throwing callee caught within a function', 'f <- function() { stop("b") }\nh <- function() {\n  x <- 1\n  w <- x + 1\n  r <- try(f(), silent = TRUE)\n  w\n}\nprint(h())', '6@w'],
			/* the caught error leaves the `stop` beside the flow, which is unrelated to the slice */
			['throw written in the try itself', 'x <- 1\nw <- x + 1\nr <- try(stop("b"), silent = TRUE)\nw', '4@w', undefined, { cfgExcludeProperties: ['entry-reaches-all'] }],
			['callee throws in one branch', 'f <- function(k) { if(k) stop("b") else 1 }\nx <- 1\nw <- x + 1\nr <- try(f(TRUE), silent = TRUE)\nw', '5@w', ['if']],
			['callee throws in every branch', 'f <- function(k) { if(k) stop("a") else stop("b") }\nx <- 1\nw <- x + 1\nr <- try(f(TRUE), silent = TRUE)\nw', '5@w', ['if']],
			['always throwing callee one level deeper', 'f <- function() { stop("b") }\ng <- function() f()\nx <- 1\nw <- x + 1\nr <- try(g(), silent = TRUE)\nw', '6@w'],
			['always throwing callee in a loop body', 'f <- function() { stop("b") }\nx <- 1\nw <- x + 1\nfor(i in integer(0)) f()\nw', '5@w', ['for-loop']],
		];
		for(const [name, code, criterion, extraCaps, extraConfig] of cases) {
			assertSliced(label(name, extraCaps ? [...caps, ...extraCaps] : caps),
				shell, code, [criterion], sliced, extraConfig ? { ...outputs, ...extraConfig } : outputs);
		}
	});

}));
