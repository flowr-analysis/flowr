import { assertSliced, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { OperatorDatabase } from '../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data/get';
import { describe } from 'vitest';

describe.sequential('Control flow', withShell(shell => {
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
			{ loop: 'while(TRUE)', caps: ['while-loop', 'logical'] },
			{ loop: 'for(i in 1:100)', caps: ['for-loop', 'numbers', 'name-normal'] }
		] satisfies { loop: string, caps: SupportedFlowrCapabilityId[]}[])('$loop', ({ loop, caps }) => {
			assertSliced(label('Break immediately', [...caps, 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons', 'newlines', 'break', 'unnamed-arguments']),
				shell, `x <- 1
${loop} {
   x <- 2;
   break
}
print(x)`, ['6@x'], `x <- 1\n${loop} x <- 2\nx`);
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
print(x)`, ['7@x'], loop == 'repeat' ? 'x <- 1\nrepeat x <- 2\nx' : `x <- 1\n${loop} {
    x <- 2
    x <- 3
}
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
}));
