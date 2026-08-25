import { assertSliced, assumeLoadedPackages, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import { MIN_VERSION_LAMBDA } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import type { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { describe } from 'vitest';

assumeLoadedPackages('dplyr', 'magrittr', 'maps', 'plyr', 'inferference');

describe('Calls', { concurrent: false }, withShell(shell => {
	describe('Simple Calls', () => {
		const code = 'i <- 4\na <- function(x) { x }\na(i)';
		for(const criterion of ['3:1', '3@a'] as const) {
			assertSliced(label(JSON.stringify(code), ['function-definitions', 'resolve-arguments', 'formals-named', 'name-normal', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments']),
				shell, code, [criterion], 'i <- 4\na <- function(x) x\na(i)'
			);
		}
		const constCapabilities: SupportedFlowrCapabilityId[] = ['function-definitions', 'resolve-arguments', 'formals-named', 'name-normal', 'numbers', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'implicit-return'];
		const constFunction = 'i <- 4\na <- function(x) { x <- 2; 1 }\na(i)';
		/* actually, `i` does not have to be defined, as it is _not used_ by the function, so we do not have to include `i <- 4` */
		assertSliced(label('Function call with constant function', constCapabilities),
			shell, constFunction, ['3:1'], 'a <- function(x) 1\na(i)');
		/* nothing of the function-content is required */
		assertSliced(label('Slice function definition', constCapabilities), shell, constFunction, ['2@a'], 'a <- function(x) { }');
		assertSliced(label('Slice within function', constCapabilities), shell, constFunction, ['2@[2]x'], 'x <- 2');
		assertSliced(label('Multiple unknown calls', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'numbers', 'call-normal', 'newlines']),
			shell, '\nfoo(x, y)\nfoo(x, 3)\n    ', ['3@foo'], 'foo(x, 3)');
		assertSliced(label('Multiple unknown calls sharing known def', ['name-normal', 'resolve-arguments', 'formals-named', 'unnamed-arguments', 'implicit-return', 'numbers', 'call-normal', 'newlines']),
			shell, '\nx. <- function (x) { x }\nfoo(x, x.(y))\nfoo(x, x.(3))\n    ', ['4@foo'], 'x. <- function(x) x\nfoo(x, x.(3))');
		assertSliced(label('Using ...', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-dot-dot-dot', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'numbers']),
			shell, '\nf1 <- function (a,b) { WW }\nf2 <- function (...) { f1(...) }\nx <- 3\nWW <- 4\ny <- 3\nf2(1,x)\n    ', ['7@f2'], 'f1 <- function(a, b) WW\nf2 <- function(...) f1(...)\nx <- 3\nWW <- 4\nf2(1,x)');
	});
	describe('Functions using environment', () => {
		const envCaps: SupportedFlowrCapabilityId[] = ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'numbers'];
		/** checks both slicing criteria ('n:1' and 'n\@a') land on the same expected slice */
		function envCase(name: string, code: string, criteria: readonly SlicingCriterion[], expected: string) {
			for(const criterion of criteria) {
				assertSliced(label(name, envCaps), shell, code, [criterion], expected);
			}
		}
		envCase('Must include read (defined before)', 'i <- 4\na <- function(x) { x + i }\na(4)', ['3:1', '3@a'], 'i <- 4\na <- function(x) x + i\na(4)');
		envCase('Must include read (defined after)', 'a <- function(x) { x + i }\ni <- 4\na(5)', ['3:1', '3@a'], 'a <- function(x) x + i\ni <- 4\na(5)');
		envCase('Only keep second definition (defined before and after)', 'i <- 3\na <- function(x) { x + i }\ni <- 4\na(5)', ['4:1', '4@a'], 'a <- function(x) x + i\ni <- 4\na(5)');
	});
	describe('Functions with multiple definitions', () => {
		const code = 'a <- b <- function() { x }\nx <- 2\na()\nb()';
		const caps: SupportedFlowrCapabilityId[] = ['name-normal', 'normal-definition', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'return-value-of-assignments', 'precedence'];
		assertSliced(label('Include only b-definition', caps),
			shell, code, ['3@a'], 'a <- b <- function() x\nx <- 2\na()');
		assertSliced(label('Include only b-definition', caps),
			shell, code, ['4@b'], 'b <- function() x\nx <- 2\nb()');
	});
	describe('Functions with named arguments', () => {
		const code = 'a <- function(x=4) { x }\na(x = 3)';
		assertSliced(label('Must include function definition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'implicit-return', 'newlines', 'named-arguments', 'resolve-arguments', 'numbers']),
			shell, code, ['2@a'], 'a <- function(x=4) x\na(x = 3)');

		assertSliced(label('Must work for same named arguments too', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'named-arguments', 'newlines']), shell, 'a <- 3\nb <- foo(a=a)', ['2@b'], 'a <- 3\nb <- foo(a=a)');

		assertSliced(label('Must work for same named arguments nested', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'named-arguments', 'accessing-exported-names', 'implicit-return', 'newlines', 'strings']), shell, '\nf <- function(some_variable="hello") {\n  result <- some::other(some_variable=some_variable)\n  result\n}\n    ', ['4@result'], 'function(some_variable="hello") {\n    result <- some::other(some_variable=some_variable)\n    result\n}');

		const lateCode = 'f <- function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }\nf()\n';
		assertSliced(label('Late bindings of parameter in body', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'implicit-return', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'call-normal', 'semicolons']),
			shell, lateCode, ['2@f'], 'f <- function(a=b, m=3) {\n        b <- 1\n        a + 1\n    }\nf()');
		const lateCodeB = 'f <- function(a=b, b=3) { b <- 1; a; b <- 5; a + 1 }\nf()\n';
		assertSliced(label('Late bindings of parameter in parameters', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'call-normal', ...OperatorDatabase['+'].capabilities, 'semicolons']),
			shell, lateCodeB, ['2@f'], 'f <- function(a=b, b=3) a + 1\nf()');
		assertSliced(label('Parameters binding context', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'implicit-return', 'newlines', 'numbers', 'call-normal']),
			shell, 'f <- function(a=y) { a }\na <- 5\ny <- 3\ny <- 4\nf()', ['5@f'], 'f <- function(a=y) a\ny <- 4\nf()');

		assertSliced(label('Named argument collides with variable', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'named-arguments', 'newlines']), shell, 'x <- 100\nlist(123, x = 200, 234)\nprint(x)',
			['3@x'], 'x <- 100\nx');
	});
	describe('Functions with nested definitions', () => {
		describe('Simple Function pass with return', () => {
			const code = 'a <- function() { a <- 2; return(function() { 1 }) }\nb <- a()\nb()';
			assertSliced(label('Must include outer function', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'numbers', 'return', 'implicit-return', 'call-normal', 'newlines', 'semicolons']),
				shell, code, ['2@a'], 'a <- function() return(function() { 1 })\na()');
			assertSliced(label('Must include linked function', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'return', 'implicit-return', 'numbers', 'newlines', 'call-normal']),
				shell, code, ['3@b'], 'a <- function() return(function() { 1 })\nb <- a()\nb()');
		});
		describe('Functions binding multiple scopes', () => {
			const code = '\na <- function() { x <- function() { z + y }; y <- 12; return(x) }\ny <- 5\nz <- 5\nu <- a()\nu()';
			assertSliced(label('Must include function shell', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'numbers', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'return', 'newlines', 'call-normal', 'semicolons']),
				shell, code, ['5@a'], 'a <- function() {\n        x <- function() { }\n        return(x)\n    }\na()');
			assertSliced(label('Must include function shell on call', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'return', 'call-normal']), shell, code, ['6@u'], 'a <- function() {\n        x <- function() z + y\n        y <- 12\n        return(x)\n    }\nz <- 5\nu <- a()\nu()');
		});
	});
	describe('Anonymous Functions', () => {
		assertSliced(label('keep anonymous', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'binary-operator', 'infix-calls', ...OperatorDatabase['-'].capabilities, 'implicit-return', 'call-anonymous', 'unnamed-arguments']),
			shell, '\nx <- (function() {\n  x <- 4\n  x - 5\n  3\n })()\ncat(x)\n    ', ['7@x'], 'x <- (function() 3)()\nx');
	});
	describe('Criterion within a function body', () => {
		/* slicing into the body yields the statements themselves, the definition is not required for them */
		assertSliced(label('body without its header', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'function-calls', 'call-normal']), shell, 'f <- function() { x <- 2\nprint(x) }\nf()', ['2@x'], 'x <- 2\nx', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
	});
	describe('Higher-order Functions', () => {
		const code = 'a <- function() { x <- 3; i }\ni <- 4\nb <- function(f) { i <- 5; f() }\nb(a)';
		const caps: SupportedFlowrCapabilityId[] = ['name-normal', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'newlines', 'numbers', 'formals-named', 'call-normal', 'unnamed-arguments'];
		assertSliced(label('Only i, not bound in context', caps), shell, code, ['1@i'], 'i');
		assertSliced(label('Slice of b is independent', caps), shell, code, ['3@b'], 'b <- function(f) { }');
		assertSliced(label('Slice of b-call uses function', caps), shell, code, ['4@b'], 'a <- function() i\nb <- function(f) {\n        i <- 5\n        f()\n    }\nb(a)');
		assertSliced(label('Directly call returned function', ['name-normal', 'closures', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'normal-definition', 'implicit-return', 'return', 'unnamed-arguments', 'newlines', 'numbers', 'call-normal']),
			shell, 'm <- 12\na <- function(x) {\n  b <- function() { function() { x } }\n  return(b())\n}\nres <- a(m)()', ['6@res'], 'm <- 12\na <- function(x) {\n        b <- function() function() x\n        return(b())\n    }\nres <- a(m)()');
		assertSliced(label('Higher order anonymous function', ['name-normal', 'resolve-arguments', 'closures', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'normal-definition', 'call-anonymous', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'newlines', 'precedence']),
			shell, 'a <- function(b) {\n  b\n}\nx <- a(function() 2 + 3)() + a(function() 7)()', ['4@x'], 'a <- function(b) b\nx <- a(function() 2 + 3)() + a(function() 7)()');
	});
	describe('Side-Effects', () => {
		assertSliced(label('Important Side-Effect', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call', 'implicit-return', 'call-normal', 'unnamed-arguments', 'newlines', 'precedence']), shell, 'x <- 2\nf <- function() { x <<- 3 }\nf()\ncat(x)\n    ', ['4@x'], 'f <- function() x <<- 3\nf()\nx');

		assertSliced(label('Unimportant Side-Effect', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', ...OperatorDatabase['<<-'].capabilities, 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'call-normal', 'unnamed-arguments', 'newlines']), shell, 'f <- function() { y <<- 3 }\nf()\ncat(x)\n    ', ['3@x'], 'x');
	});
	assertSliced(label('Nested Side-Effect For Last', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'implicit-return', 'numbers', 'call-normal', 'side-effects-in-function-call']), shell, 'f <- function() {\n  a <- function() { x }\n  x <- 3\n  a()\n  x <- 2\n  a()\n}\nb <- f()\n    ', ['8@b'], 'f <- function() {\n        a <- function() x\n        x <- 2\n        a()\n    }\nb <- f()');
	// that it contains x <- 2 is an error in the current implementation as this happens due to the 'reads' edge from the closure linking
	// however, this read edge should not apply when the call happens within the same scope
	// we have to separate on the exit points for this and re-resolve for each exit point
	assertSliced(label('Nested Side-Effect For First', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'numbers', 'call-normal', 'newlines', 'side-effects-in-function-call']), shell, 'f <- function() {\n  a <- function() { x }\n  x <- 3\n  b <- a()\n  x <- 2\n  a()\n  b\n}\nb <- f()\n    ', ['9@b'], 'f <- function() {\n        a <- function() x\n        x <- 3\n        b <- a()\n        x <- 2\n        b\n    }\nb <- f()');
	assertSliced(label('always dominating', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'side-effects-in-function-call' ]), shell, 'x <- 2\nf <- function() x <<- 3\nf()\nprint(x)', ['4@x'], 'f <- function() x <<- 3\nf()\nx');
	assertSliced(label('conditionally dominating', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'side-effects-in-function-call' ]), shell, 'x <- 2\nf <- function() x <<- 3\nif(u) f()\nprint(x)', ['4@x'], 'x <- 2\nf <- function() x <<- 3\nif(u) f()\nx');
	describe('Early return of function', () => {
		const code = 'x <- (function() {\n  g <- function() { y }\n  y <- 5\n  if(z)\n  \treturn(g)\n  y <- 3\n  g\n})()\nres <- x()';
		assertSliced(label('Double return points', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'call-anonymous', 'normal-definition', 'implicit-return', 'numbers', 'if', 'return', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['9@res'], '\nx <- (function() {\n        g <- function() y\n        y <- 5\n        if(z) return(g)\n        y <- 3\n        g\n    })()\nres <- x()'.trim());
	});
	describe('Recursive functions', () => {
		const code = 'f <- function() { f() }\nf()';
		assertSliced(label('Endless recursion', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['2@f'], 'f <- function() f()\nf()');
	});
	describe('Uninteresting calls', () => {
		const code = '\na <- list(1,2,3,4)\na[3]\nprint(a[2])\n    ';
		assertSliced(label('No function if not required', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'single-bracket-access', 'newlines']), shell, code, ['3@a'], 'a <- list(1,2,3,4)\na');
	});
	describe('Global vs. local definitions', () => {
		const localCode = '\na <- function() { x = x + 5; cat(x) }\nx <- 3\na()\ncat(x)';
		const localCaps: readonly SupportedFlowrCapabilityId[] = ['name-normal', 'lexicographic-scope', 'normal-definition', ...OperatorDatabase['='].capabilities, 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'semicolons', 'unnamed-arguments', 'newlines', 'call-normal', 'numbers', 'precedence'];
		assertSliced(label('Local redefinition has no effect', localCaps), shell, localCode, ['5@x'], 'x <- 3\nx');
		assertSliced(label('Local redefinition must be kept as part of call', localCaps), shell, localCode, ['4@a'], 'a <- function() {\n        x = x + 5\n        cat(x)\n    }\nx <- 3\na()');
		const globalCode = '\na <- function() { x <<- x + 5; cat(x) }\nx <- 3\na()\nx';
		assertSliced(label('But the global redefinition remains', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'call-normal', 'unnamed-arguments', 'precedence']), shell, globalCode, ['5@x'], 'a <- function() x <<- x + 5\nx <- 3\na()\nx');
		const globalCodeWithoutLocal = '\na <- function() { x <<- 5; cat(x) }\nx <- 3\na()\nx';
		assertSliced(label('The local assignment is only needed if the global reads', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'function-definitions', ...OperatorDatabase['<<-'].capabilities, 'numbers', 'newlines', 'call-normal', 'unnamed-arguments', 'precedence']), shell, globalCodeWithoutLocal, ['5@x'], 'a <- function() x <<- 5\na()\nx');

		assertSliced(label('Must work with nested globals', ['name-normal', 'resolve-arguments', 'lexicographic-scope', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'numbers', 'call-normal', 'unnamed-arguments', 'precedence']),
			shell, 'a <- function() { function(b) x <<- b }\ny <- 5\nx <- 2\na()(y)\nx', ['5@x'], 'a <- function() function(b) x <<- b\ny <- 5\na()(y)\nx');

		assertSliced(label('Must work with nested globals and known assignments not-happening', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'if', 'logical', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments', 'resolve-arguments', 'implicit-return', 'newlines', 'call-normal', 'unnamed-arguments']),
			shell, 'a <- function() { function(b) { if(FALSE) { x <<- b } } }\ny <- 5\nx <- 2\na()(y)\ncat(x)', ['5@x'], 'x <- 2\nx');

		assertSliced(label('Must work with nested globals and maybe assignments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'if', 'call-normal', ...OperatorDatabase['>'].capabilities, 'numbers', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments', 'resolve-arguments', 'lexicographic-scope', 'newlines', 'unnamed-arguments', 'closures']),
			shell, 'a <- function() { function(b) { if(runif() > .5) { x <<- b } } }\ny <- 5\nx <- 2\na()(y)\ncat(x)', ['5@x'], 'a <- function() function(b) if(runif() > .5) { x <<- b }\ny <- 5\nx <- 2\na()(y)\nx');
	});
	describe('Using strings for definitions', () => {
		const code = "\n'a' <- function() { x <- 3; 4 }\n'a'()\na()\na <- function() { x <- 3; 5 }\n'a'()\na()\n`a`()\n    ";
		const caps: SupportedFlowrCapabilityId[] = ['name-quoted', 'name-escaped', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'name-normal', 'numbers', 'semicolons', 'implicit-return', 'call-normal', 'newlines', 'name-escaped'];
		function strCase(name: string, criterion: SlicingCriterion, expected: string) {
			assertSliced(label(name, caps), shell, code, [criterion], expected);
		}
		strCase('Must link with string/string', '3@\'a\'', '\'a\' <- function() 4\n\'a\'()');
		strCase('Must link with string/no-string', '4@a', '\'a\' <- function() 4\na()');
		strCase('Must link with no-string/string', '6@\'a\'', 'a <- function() 5\n\'a\'()');
		strCase('Must link with no-string/no-string', '7@a', 'a <- function() 5\na()'); // the common case
		strCase('Try with special backticks', '8@`a`', 'a <- function() 5\n`a`()');
	});
	describe('Using own infix operators', () => {
		const code = "\n`%a%` <- function(x, y) { x + y }\n`%a%`(3, 4)\n\n'%b%' <- function(x, y) { x * y }\n'%b%'(3, 4)\n\ncat(3 %a% 4)\ncat(4 %b% 5)\n      ";
		const caps: SupportedFlowrCapabilityId[] = ['name-escaped', 'resolve-arguments', 'name-quoted', 'infix-calls', 'formals-named', 'implicit-return', 'newlines', 'unnamed-arguments', 'special-operator'];
		assertSliced(label('Must link with backticks', caps), shell, code, ['8:7'], '`%a%` <- function(x, y) x + y\n3 %a% 4');
		assertSliced(label('Must link with backticks', caps), shell, code, ['9:7'], "'%b%' <- function(x, y) x * y\n4 %b% 5");
		assertSliced(label('Must work with assigned custom pipes too', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'infix-calls', 'numbers', 'special-operator', 'precedence']), shell, 'a <- b %>% c %>% d', ['1@a'], 'a <- b %>% c %>% d');
	});
	describe('Using own alias infix operators', () => {
		const code = '\n"%a%" <- function(x, y) { x + y }\n"%a%" <- pkg::"%a%"\ncat(4 %a% 5)\n      ';
		assertSliced(label('Must link alias but not namespace origin', ['name-quoted', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'infix-calls', 'special-operator', 'accessing-exported-names', 'newlines', 'unnamed-arguments']),
			shell, code, ['4:1'], '"%a%" <- pkg::"%a%"\ncat(4 %a% 5)');
	});
	describe('Using own alias infix operators with namespace', () => {
		const code = '\npkg::"%a%" <- function(x, y) { x + y }\n"%a%" <- pkg::"%a%"\ncat(4 %a% 5)\n      ';
		assertSliced(label('must link alias with namespace', ['accessing-exported-names', 'resolve-arguments', 'name-quoted', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'special-operator', 'unnamed-arguments']),
			shell, code, ['4:1'], 'pkg::"%a%" <- function(x, y) x + y\n"%a%" <- pkg::"%a%"\ncat(4 %a% 5)');
	});
	describe('Quotation', () => {
		assertSliced(label('quote does not reference variables', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'built-in-quoting' ]), shell, 'x <- 3\ny <- quote(x)', ['2@y'], 'y <- quote(x)');
	});
	/** an S3 dispatch case: `caps` (shared per describe below) plus code/criterion/expected slice/output */
	function s3Case(name: string, caps: SupportedFlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string, out: string) {
		assertSliced(label(name, caps), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
	}
	describe('S3 Dispatch', () => {
		const s3Caps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal'];
		const plainCaps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'normal-definition', 'implicit-return', 'call-normal'];
		/* the generic has to evaluate its object to know the class, even though no method body reads it */
		s3Case('dispatch forces its object', s3Caps, 'p <- function(x) UseMethod("p")\np.foo <- function(x) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '5@v', 'p <- function(x) UseMethod("p")\np.foo <- function(x) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '[1] "FOO"');
		s3Case('dispatch with dots forces its object', s3Caps, 'p <- function(x, ...) UseMethod("p")\np.foo <- function(x, ...) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '5@v', 'p <- function(x, ...) UseMethod("p")\np.foo <- function(x, ...) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', '[1] "FOO"');
		s3Case('next-method keeps the object as well', s3Caps, 'p <- function(x) UseMethod("p")\np.foo <- function(x) NextMethod()\np.default <- function(x) "DEF"\no <- structure(1, class="foo")\nv <- p(o)\nv', '6@v', 'p <- function(x) UseMethod("p")\np.foo <- function(x) NextMethod()\np.default <- function(x) "DEF"\no <- structure(1, class="foo")\nv <- p(o)\nv', '[1] "DEF"');
		/* control: a plain function never forces the parameter it does not mention, so the argument may go */
		s3Case('a plain call still drops the argument it never forces', plainCaps, 'p <- function(x) "FOO"\nu <- 1\nv <- p(u)\nv', '4@v', 'p <- function(x) "FOO"\nv <- p(u)\nv', '[1] "FOO"');
		/* control: naming the object moves the dispatch to it, leaving the first formal lazy */
		s3Case('a named object leaves the first formal lazy', s3Caps, 'p <- function(x, y) UseMethod("p", y)\np.foo <- function(x, y) "FOO"\np.default <- function(x, y) "DEF"\nw <- 7\no <- structure(1, class="foo")\nv <- p(w, o)\nv', '7@v', 'p <- function(x, y) UseMethod("p", y)\np.foo <- function(x, y) "FOO"\np.default <- function(x, y) "DEF"\no <- structure(1, class="foo")\nv <- p(w, o)\nv', '[1] "FOO"');
	});
	describe('S3 Dispatch on Base Generics', () => {
		const baseCaps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal', 'named-arguments', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities];
		/* `length` dispatches just like a `UseMethod` generic does, so its method has to stay */
		s3Case('a method of a base generic stays', baseCaps, 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '4@v', 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '[1] 99');
		s3Case('a method of an operator stays', [...baseCaps, 'name-quoted', 'infix-calls', ...OperatorDatabase['+'].capabilities], '"+.mn" <- function(e1, e2) 123\no <- structure(1, class="mn")\nv <- o + 1\nv', '4@v', '"+.mn" <- function(e1, e2) 123\no <- structure(1, class="mn")\nv <- o + 1\nv', '[1] 123');
		s3Case('a method of an extractor stays', [...baseCaps, 'name-quoted', 'single-bracket-access'], '"[.mm" <- function(x, i) 55\no <- structure(c(1,2,3), class="mm")\nv <- o[2]\nv', '4@v', '"[.mm" <- function(x, i) 55\no <- structure(c(1,2,3), class="mm")\nv <- o[2]\nv', '[1] 55');
		s3Case('next-method through a base generic', baseCaps, 'length.zz <- function(x) NextMethod()\no <- structure(c(1,2,3), class="zz")\nv <- length(o)\nv', '4@v', 'length.zz <- function(x) NextMethod()\no <- structure(c(1,2,3), class="zz")\nv <- length(o)\nv', '[1] 3');
		/* precision: only the methods of the generic that is called, and only when it is called at all */
		s3Case('a method of another generic is not dragged in', baseCaps, 'foo.bar <- function(x) 1\nlength.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '5@v', 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', '[1] 99');
		s3Case('an undispatched method goes', baseCaps, 'length.zz <- function(x) 99\nu <- 5\nv <- u\nv', '4@v', 'u <- 5\nv <- u\nv', '[1] 5');
	});
	describe('S4 Registration', () => {
		const s4Caps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s4', 'normal-definition', 'implicit-return', 'call-normal', 'unnamed-arguments', 'named-arguments', ...OperatorDatabase['<-'].capabilities];
		/** `sliceOut` defaults to `out` when the R output and the slice's own output agree */
		function s4Case(name: string, code: string, criterion: SlicingCriterion, expected: string, out: string | RegExp, sliceOut?: string | RegExp) {
			assertSliced(label(name, s4Caps), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: sliceOut ?? out });
		}
		/* `setClass` writes a string-keyed registry `new("P")` reads, so the slice cannot drop it */
		s4Case('new keeps the class registration', 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '4@r', 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '[1] 1');
		s4Case('a prototype default is kept with its class', 'setClass("W", representation(v = "numeric"), prototype(v = 12))\no <- new("W")\nr <- o@v\nr', '4@r', 'setClass("W", representation(v = "numeric"), prototype(v = 12))\no <- new("W")\nr <- o@v\nr', '[1] 12');
		/* `setMethod` answers an existing generic, so it depends on the `setGeneric` that created it */
		s4Case('a method keeps the generic it answers', 'setGeneric("sz", function(x) standardGeneric("sz"))\nsetMethod("sz", "numeric", function(x) x * 3)\nr <- sz(4)\nr', '4@r', 'setGeneric("sz", function(x) standardGeneric("sz"))\nsetMethod("sz", "numeric", function(x) x * 3)\nr <- sz(4)\nr', '[1] "sz"\n[1] 12');
		/* `callNextMethod` reaches the method of the superclass, which the chain of generic reads keeps */
		s4Case('call-next-method keeps the inherited method', 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "A", function(o) o@x)\nsetMethod("f", "B", function(o) callNextMethod() + 1)\nr <- f(new("B", x = 10))\nr', '7@r', 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "A", function(o) o@x)\nsetMethod("f", "B", function(o) callNextMethod() + 1)\nr <- f(new("B", x = 10))\nr', '[1] "f"\n[1] 11');
		/* `setValidity` changes what `new` does with the class, so it is kept, and it keeps the declaration in turn */
		s4Case('a validator is kept with the class it guards', 'setClass("P", representation(s = "numeric"))\nsetValidity("P", function(object) if(object@s < 0) "neg" else TRUE)\nr <- tryCatch(new("P", s = -1)@s, error = function(e) -99)\nr', '4@r', 'setClass("P", representation(s = "numeric"))\nsetValidity("P", function(object) if(object@s < 0) "neg" else TRUE)\nr <- tryCatch(new("P", s = -1)@s, error = function(e) -99)\nr', /\[1\] -99$/);
		/* precision: the registry is keyed by name, so a class nothing uses stays out */
		s4Case('an unused class registration is dropped', 'setClass("P", representation(s = "numeric"))\nsetClass("Q", representation(t = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '5@r', 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', '[1] 1');
		/* precision: the same for a generic nothing calls */
		s4Case('an unused generic is dropped', 'setGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "numeric", function(o) o * 2)\nsetGeneric("h", function(o) standardGeneric("h"))\nsetMethod("h", "numeric", function(o) o + 100)\nr <- f(3)\nr', '6@r', 'setGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "numeric", function(o) o * 2)\nr <- f(3)\nr', '[1] "f"\n[1] "h"\n[1] 6', '[1] "f"\n[1] 6');
	});
	describe('Assignment and Reflection Functions', () => {
		describe('Assign', () => {
			assertSliced(label('using assign as assignment', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']), shell, 'assign("x", 42)\nx', ['2@x'], 'assign("x", 42)\nx');
			assertSliced(label('function', ['name-normal', 'assignment-functions', 'strings', 'newlines', 'numbers', 'implicit-return', 'normal-definition']), shell, 'assign("a", function() 1)\na()', ['2@a'], 'assign("a", function() 1)\na()');
			assertSliced(label('conditional assign', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'if', 'lambda-syntax', 'numbers', 'call-normal', 'implicit-return', 'assignment-functions', 'strings', 'numbers']),
				shell, `a <- \\() 2
if(y) {
   assign("a", function() 1)
}
a()`, ['5@a'], `a <- \\() 2
if(y) { assign("a", function() 1) }
a()`, { minRVersion: MIN_VERSION_LAMBDA });
		});
		describe('DelayedAssign', () => {
			assertSliced(label('using delayed-assign as assignment', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']), shell, 'delayedAssign("x", 42)\nx', ['2@x'], 'delayedAssign("x", 42)\nx');
			/** a delayed-assign force case, checked with both the R output and the slice's own output */
			function delayedCase(name: string, code: string, criterion: SlicingCriterion, expected: string, out: string) {
				assertSliced(label(name, ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
			}
			/* the promise is forced at the read, so it sees the last write of `x`, not the one at registration time */
			delayedCase('using delayed-assign keeps the bindings the force may see', 'x <- 4\ndelayedAssign("y", x)\nx <- 5;\ny', '4@y', 'x <- 4\ndelayedAssign("y", x)\nx <- 5\ny', '[1] 5');
			delayedCase('the delayed expression drags in what it reads', 'z <- 1\ndelayedAssign("d", z * 2)\nv <- d\nv', '4@v', 'z <- 1\ndelayedAssign("d", z * 2)\nv <- d\nv', '[1] 2');
			delayedCase('the force decides which binding is read', 'z <- 1\ndelayedAssign("d", z)\nz <- 10\nv <- d\nv', '5@v', 'z <- 1\ndelayedAssign("d", z)\nz <- 10\nv <- d\nv', '[1] 10');
			/* control: an expression without free variables must not pull anything along */
			delayedCase('a closed delayed expression drags in nothing', 'q <- 99\ndelayedAssign("d", 1 + 2)\nv <- d\nv', '4@v', 'delayedAssign("d", 1 + 2)\nv <- d\nv', '[1] 3');
		});
		describe('Get', () => {
			assertSliced(label('get-access should work like a symbol-access', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'name-created']), shell, 'x <- 42\ny <- get("x")', ['2@y'], 'x <- 42\ny <- get("x")');
			assertSliced(label('function', ['name-normal', 'strings', 'newlines', 'normal-definition', 'implicit-return', ...OperatorDatabase['<-'].capabilities, 'name-created']), shell, 'a <- function() 1\nb <- get("a")\nb()', ['3@b'], 'a <- function() 1\nb <- get("a")\nb()');
			assertSliced(label('get in function', ['name-normal', 'function-definitions', 'newlines', 'strings', 'implicit-return', 'name-created']),
				shell, 'a <- 5\nf <- function() {\n  get("a")\n}\nf()', ['5@f'], 'a <- 5\nf <- function() get("a")\nf()');
			assertSliced(label('get in function argument', ['name-normal', 'formals-default', 'strings', 'implicit-return', ...OperatorDatabase['<-'].capabilities, 'newlines', 'numbers', 'name-created']),
				shell, 'a <- 5\nf <- function(a = get("a")) {\n  a\n}\nf()', ['5@f'], 'f <- function(a=get("a")) a\nf()');
		});
		describe('Combine get and assign', () => {
			assertSliced(label('get in assign', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'assignment-functions', 'strings', 'unnamed-arguments', 'newlines', 'name-created']), shell, 'b <- 5\nassign("a", get("b"))\nprint(a)', ['3@a'], 'b <- 5\nassign("a", get("b"))\na');
			assertSliced(label('get-access a function call', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'function-definitions', 'call-normal', 'name-created']),
				shell, 'a <- function() 1\nb <- get("a")\nres <- b()', ['3@res'], 'a <- function() 1\nb <- get("a")\nres <- b()');
		});
	});
	describe('Redefine built-ins', () => {
		assertSliced(label('redefining assignments should work', ['name-quoted', 'name-normal', 'precedence', 'numbers', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['='].capabilities, 'redefinition-of-built-in-functions-primitives']), shell, 'x <- 1\n`<-`<-`*`\nx <- 3\ny = x', ['4@y'], 'x <- 1\ny = x');
		assertSliced(label('redefine if', ['name-escaped', ...OperatorDatabase['<-'].capabilities, 'numbers', 'formals-dot-dot-dot', 'newlines', 'unnamed-arguments']),
			shell, '`if` <- function(...) 2\nif(1) \n   x <- 3\nprint(x)', ['4@x'], 'x <- 3\nx'/*, { expectedOutput: '[1] 2' }*/);
		assertSliced(label('named argument with redefine', ['name-escaped', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities, 'named-arguments', 'newlines', 'numbers']),
			shell, 'x <- 2\n`<-` <- `*`\nx <- 3\nprint(y = x)', ['4@y'], 'y=x');
		assertSliced(label('redefine in local scope', [
			'newlines', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities,
			'numbers', 'name-escaped', 'call-normal', 'function-definitions', 'redefinition-of-built-in-functions-primitives'
		]),
		shell, 'f <- function() {\n   x <- 2\n   `<-` <- `*`\n   x <- 3\n}\ny <- f()\nprint(y)', ['7@y'], 'f <- function() {\n        x <- 2\n        `<-` <- `*`\n        x <- 3\n    }\ny <- f()\ny' /* the formatting here seems wild, why five spaces */, { expectedOutput: '[1] 6' });
	});
	describe('Switch', () => {
		assertSliced(label('Switch with named arguments', ['switch', ...OperatorDatabase['<-'].capabilities, 'numbers', 'strings', 'named-arguments', 'unnamed-arguments', 'switch', 'function-calls' ]), shell, 'x <- switch("a", a=1, b=2, c=3)', ['1@x'], 'x <- switch("a", a=1, b=2, c=3)');
	});
	describe('Separate Function Resolution', () => {
		const resolutionCaps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'call-normal', 'newlines', 'search-type'];
		assertSliced(label('Separate function resolution', resolutionCaps), shell, 'c <- 3\nc(1, 2, 3)', ['2@c'], 'c(1, 2, 3)');
		assertSliced(label('Separate function resolution', resolutionCaps), shell, 'c <- 3\nprint(c(1, 2))', ['2@print'], 'print(c(1, 2))');
	});
	describe('Failures in Practice', () => {
		describe('empty functions', () => {
			assertSliced(label('Empty Function in Reconstruct', ['function-definitions']), shell,
				'x <- 2\nfoo <- function(n, x = 3) { print(x) }\nprint(x)', ['3@x'], 'x <- 2\nx');
		});
		describe('Super Side-Effects', () => {
			const sideEffectCaps: SupportedFlowrCapabilityId[] = ['super-left-assignment', 'lexicographic-scope'];
			assertSliced(label('No recursion', sideEffectCaps), shell, 'calls <- 0\nx <- function() {\n  calls <<- calls + 1\n  4\n}\nx()', ['6@x'], 'x <- function() 4\nx()');
			assertSliced(label('With recursion', sideEffectCaps), shell, 'calls <- 0\nx <- function() {\n  calls <<- calls + 1\n  x()\n}\nx()', ['6@x'], 'x <- function() x()\nx()');
			assertSliced(label('Counting fibonacci', sideEffectCaps), shell, 'calls <- 0\nfib <- function() {\n  calls <<- calls + 1\n  if(n <= 1) {\n    n\n  } else {\n    fib(n - 1) + fib(n - 2)\n  }\n}\nfib(42)', ['10@fib'], 'fib <- function() if(n <= 1) { n } else\n' +
				'    { fib(n - 1) + fib(n - 2) }\nfib(42)');
		});
		describe('Inverted Caller', () => {
			const invertedCaps: SupportedFlowrCapabilityId[] = ['function-calls', 'lexicographic-scope'];
			function invertedCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, invertedCaps), shell, code, [criterion], expected);
			}
			invertedCase('Call from Higher', 'create <- function() function() 3\ng <- create()\nc <- g()', '3@c', 'create <- function() function() 3\ng <- create()\nc <- g()');
			invertedCase('Call from Lower', 'g <- function() 3\ncreate <- function() function() g()\nc <- create()()', '3@c', 'g <- function() 3\ncreate <- function() function() g()\nc <- create()()');
			invertedCase('Higher Base', '\nx <- function() b()\nc <- (function() {\na <- function() b() + x()\nb <<- function() 2\ng <- function() f() + 1\nh <- function() g() * 2\nf <- function() a()\nh()})()'.trim(), '2@c', '\nx <- function() b()\nc <- (function() {\n        a <- function() b() + x()\n        b <<- function() 2\n        g <- function() f() + 1\n        h <- function() g() * 2\n        f <- function() a()\n        h()\n    })()\n'.trim());
		});
		/* adapted from a complex pipe in practice */
		describe('Nested Pipes', () => {
			const caps: SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'double-bracket-access', 'numbers', 'infix-calls', 'binary-operator', 'call-normal', 'newlines', 'unnamed-arguments', 'precedence', 'special-operator', 'strings', ...OperatorDatabase['=='].capabilities];
			const code = 'x <- fun %>%\n\t\t\t\tfilter(X == "green") %>%\n\t\t\t\tdplyr::select(X, Y) %>%\n\t\t\t\tmutate(Z = 5) %>%\n\t\t\t\tdistinct() %>%\n\t\t\t\tgroup_by(X) %>%\n\t\t\t\t# i am commento!\n\t\t\t\tsummarize(Y = mean(Y)) %>%\n\t\t\t\tleft_join(., ., by = "X") %>%\n\t\t\t\tungroup() %>%\n\t\t\t\tmutate(Y = Y + 1) %>%\n\t\t\t\tfilter(Y > 5)';
			assertSliced(label('Require complete pipe', caps), shell, code, ['1@x'], 'x <- fun %>% filter(X == "green") %>% dplyr::select(X, Y) %>% mutate(Z = 5) %>% distinct() %>% group_by(X) %>% summarize(Y = mean(Y)) %>% left_join(., ., by = "X") %>% ungroup() %>% mutate(Y = Y + 1) %>% filter(Y > 5)');
			/* a name in a data mask is a column of the data handed to the verb, so the data is part of its slice */
			assertSliced(label('Slice for variable in filter', caps), shell, code, ['2@X'], 'fun %>% X');
			assertSliced(label('Slice for variable in last filter', caps), shell, code, ['12@Y'], 'fun %>% filter(X == "green") %>% dplyr::select(X, Y) %>% mutate(Z = 5) %>% distinct() %>% group_by(X) %>% summarize(Y = mean(Y)) %>% left_join(., ., by = "X") %>% ungroup() %>% mutate(Y = Y + 1) %>% Y');
		});
		describe('Functions in Unknown Call Contexts', () => {
			const capabilities: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities,
				'numbers', 'unnamed-arguments', 'newlines', 'call-normal', 'resolve-arguments', 'named-arguments', 'implicit-return', 'grouping', 'formals-named'
			];
			function fooCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, capabilities), shell, code, [criterion], expected);
			}
			fooCase('call in unknown foo', '\nf <- function(y) { y + 3 }\nfoo(.x = f(3))\n', '3@foo', 'f <- function(y) y + 3\nfoo(.x = f(3))');
			fooCase('definition in unknown foo', 'x <- 2;\nfoo(.x = function(y) { y + 3 })', '2@foo', 'foo(.x = function(y) { y + 3 })');
			fooCase('nested definition in unknown foo', 'x <- function() { 3 }\nfoo(.x = function(y) { c(X = x()) })', '2@foo', 'x <- function() 3\nfoo(.x = function(y) { c(X = x()) })');
			fooCase('nested definition in unknown foo with reference', 'x <- function() { 3 }\ng = function(y) { c(X = x()) }\nfoo(.x = g)', '3@foo', 'x <- function() 3\ng = function(y) c(X = x())\nfoo(.x = g)');
		});
		describe('Anonymous Function Recovery on Parameter', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'grouping',
				'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition', 'unnamed-arguments',
				'formals-named'
			];
			function anonCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, caps), shell, code, [criterion], expected);
			}
			anonCase('Simple Anonymous Function', 'function(x, y=3) {\n    x\n   x + y\n   }', '2@x', 'function(x, y=3) x');
			anonCase('Simple Anonymous Function (both)', 'function(x, y=3) {\n    x\n   z <- x + y\n   }', '3@z', 'function(x, y=3) z <- x + y');
		});
		describe('Grouped Default Values', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping',
				'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition',
				'unnamed-arguments', 'formals-named', 'call-normal'
			];
			const plusCaps: SupportedFlowrCapabilityId[] = [...caps, ...OperatorDatabase['+'].capabilities];
			function groupedDefault(name: string, usesPlus: boolean, code: string, expected: string, out: string) {
				assertSliced(label(name, usesPlus ? plusCaps : caps), shell, code, ['3@v'], expected, { expectedOutput: out, expectedSliceOutput: out });
			}
			groupedDefault('Parenthesized default', false, 'f <- function(a, b = (1)) { b }\nv <- f(3)\nv', 'f <- function(a, b=(1)) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Braced default', false, 'f <- function(a, b = { 1 }) { b }\nv <- f(3)\nv', 'f <- function(a, b={1}) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Nested parenthesized default', false, 'f <- function(a, b = ((1))) { b }\nv <- f(3)\nv', 'f <- function(a, b=((1))) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Parenthesized compound default', true, 'f <- function(a, b = (a + 1)) { b }\nv <- f(3)\nv', 'f <- function(a, b=(a + 1)) b\nv <- f(3)\nv', '[1] 4');
			groupedDefault('Braced multi-expression default', true, 'f <- function(a, b = { x <- 2; x + 1 }) { b }\nv <- f(3)\nv', 'f <- function(a, b={x <- 2; x + 1}) b\nv <- f(3)\nv', '[1] 3');
			/* controls: ungrouped defaults must stay untouched */
			groupedDefault('Constant default', false, 'f <- function(a, b = 1) { b }\nv <- f(3)\nv', 'f <- function(a, b=1) b\nv <- f(3)\nv', '[1] 1');
			groupedDefault('Symbol default', false, 'f <- function(a, b = a) { b }\nv <- f(3)\nv', 'f <- function(a, b=a) b\nv <- f(3)\nv', '[1] 3');
			groupedDefault('Call default', false, 'f <- function(a, b = length(a)) { b }\nv <- f(3)\nv', 'f <- function(a, b=length(a)) b\nv <- f(3)\nv', '[1] 1');
		});
		describe('Grouped Conditions and Vectors', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping', 'numbers', 'newlines'
			];
			function groupedCase(name: string, extraCaps: SupportedFlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string, out: string) {
				assertSliced(label(name, [...caps, ...extraCaps]), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
			}
			groupedCase('Parenthesized if condition', ['if', 'logical'], 'a <- TRUE\nif((a)) { v <- 1 } else { v <- 2 }\nv', '3@v', 'a <- TRUE\nif((a)) { v <- 1 } else\n{ v <- 2 }\nv', '[1] 1');
			groupedCase('Parenthesized while condition', ['while-loop', ...OperatorDatabase['<'].capabilities, ...OperatorDatabase['+'].capabilities], 'i <- 0\nwhile((i < 2)) { i <- i + 1 }\nv <- i\nv', '4@v', 'i <- 0\nwhile((i < 2)) i <- i + 1\nv <- i\nv', '[1] 2');
			groupedCase('Parenthesized for vector', ['for-loop', ...OperatorDatabase[':'].capabilities, ...OperatorDatabase['+'].capabilities], 's <- 0\nfor(i in (1:3)) { s <- s + i }\nv <- s\nv', '4@v', 's <- 0\nfor(i in (1:3)) s <- s + i\nv <- s\nv', '[1] 6');
			groupedCase('Braced for vector', ['for-loop', ...OperatorDatabase[':'].capabilities, ...OperatorDatabase['+'].capabilities], 's <- 0\nfor(i in { 1:3 }) { s <- s + i }\nv <- s\nv', '4@v', 's <- 0\nfor(i in {1:3}) s <- s + i\nv <- s\nv', '[1] 6');
		});
		describe('Potentially redefine built-ins', () => {
			assertSliced(label('Potential Definition', [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'if'
			]), shell, 'x <- 2\nif(u) `<-` <- `*`\nx <- 3', ['3@x'], 'x <- 2\nif(u) `<-` <- `*`\nx <- 3');
		});
		describe('Primitive', () => {
			assertSliced(label('Without using primitive', [
				'built-in-internal-and-primitive-functions'
			]), shell, 'print <- function(...) 42\nprint(3)', ['2@print'], 'print <- function(...) 42\nprint(3)');
		});
		describe('Data Table Assignments', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase[':='].capabilities,
				'strings', 'newlines', 'unnamed-arguments', 'call-normal'
			];
			function dtCase(name: string, extraCaps: SupportedFlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string) {
				assertSliced(label(name, [...caps, ...extraCaps]), shell, code, [criterion], expected);
			}
			dtCase('Single occurrence', ['single-bracket-access', 'functions-with-global-side-effects'], 'load("x")\nm[,ii:=sample(yy),]\nprint(m)', '3@print', 'load("x")\nm[,ii:=sample(yy),]\nprint(m)');
			dtCase('Work with double brackets too', ['double-bracket-access', 'functions-with-global-side-effects'], 'load("x")\nm[[ii:=sample(yy)]]\nprint(m)', '3@print', 'load("x")\nm[[ii:=sample(yy)]]\nprint(m)');
			dtCase('Multiple occurrences', ['single-bracket-access', 'access-with-argument-names', 'functions-with-global-side-effects', 'logical'], 'load("x")\nm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nprint(m)', '4@print', 'load("x")\nm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nprint(m)');
			dtCase('Overwrites should still apply', [...OperatorDatabase['<-'].capabilities, 'single-bracket-access', 'access-with-argument-names', 'numbers'], 'm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nm <- 5\nprint(m)', '4@print', 'm <- 5\nprint(m)');
		});
		describe('if-then-else format', () => {
			const caps: SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'if', 'logical', 'binary-operator', 'infix-calls', 'call-normal', 'newlines', 'unnamed-arguments', 'precedence'];
			const code = 'x <- 3\n{\nif (x == 3)\n{ x <- 4 \ny <- 2 }\nelse { x <- y <- 3 }\n}\nprint(x)\n\t\t\t';
			assertSliced(label('Slice for initial x should return noting else', caps), shell, code, ['1@x'], 'x <- 3', { expectedOutput: '[1] 4' });
			assertSliced(label('Slice for first condition', caps), shell, code, ['3@x'], 'x <- 3\nx');
			assertSliced(label('Slice for last x', caps),
				shell, code, ['8@x'], 'x <- 3\nif(x == 3) { \n        x <- 4\n        y <- 2\n    } else \n{ x <- y <- 3 }\nx');
		});
		describe('Apply Functions', () => {
			const applyCaps: SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return'];
			/** the slice at `criterion` is `expected` (`code` unchanged by default) */
			function applyCase(name: string, caps: SupportedFlowrCapabilityId[], code: string, criterion: SlicingCriterion, expected: string = code) {
				assertSliced(label(name, caps), shell, code, [criterion], expected);
			}
			describe('Lapply Forcing the Map Function Body', () => {
				applyCase('Forcing Second Argument', applyCaps, 'res <- lapply(1:3, function(x) x + 1)', '1@res');
				applyCase('Forcing Second Argument with closure', [...applyCaps, 'closures'], 'y <- 2\nres <- lapply(1:3, function(x) x + y)', '2@res');
				applyCase('Forcing Second Argument with closure colliding with built-in name', [...applyCaps, 'closures'], 'data <- 2\nres <- lapply(1:3, function(x) x + data)', '2@res');
				applyCase('Forcing Second Argument with closure colliding with built-in name access', [...applyCaps, 'closures'], 'data <- c()\nres <- lapply(1:3, function(x) x + data[x])', '2@res');
				applyCase('Forcing Second Argument Nested with closure colliding with built-in name access', [...applyCaps, 'closures'], 'data <- c()\nres <- do.call(rbind, lapply(1:2, function(y) { lapply(1:3, function(x) x + data[x]) }))', '2@res');
				applyCase('Force-Including Call Reference', [...applyCaps, 'closures'], 'foo <- bar()\nres <- lapply(1:3, function(x) foo * 2)', '2@res');
			});
			describe('With FUN.VALUE', () => {
				applyCase('Force-Including Call Reference', [...applyCaps, 'closures'], 'themed <- vapply(defaults, FUN.VALUE = logical(1), function(x) {\n    is_quosure(x) && quo_is_call(x, name = "from_theme")\n  })', '1@themed');
			});
			describe('nested ddply', () => {
				applyCase('Force-Including Call Reference', [...applyCaps, 'closures'], 'foo <- function(k) {\n\t\t\t\t\tg <- function(x) { x + 1 }\n\t\t\t\t\tK <- ddply(k, k, .fun=function(xx,yy) { c(N=g(xx)) })\n\t\t\t\t\treturn(K)\n\t\t\t\t }\n\t\t\t\t foo(1:3)', '6@foo', 'foo <- function(k) {\n        g <- function(x) x + 1\n        K <- ddply(k, k, .fun=function(xx,yy) { c(N=g(xx)) })\n        return(K)\n    }\nfoo(1:3)');
			});
			describe('interference', () => {
				applyCase('interference function', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'call-normal', 'implicit-return'],
					'foo <- function(x) x\ninterference(formula = a | b | c, propensity_integrand="foo")', '2@interference');
			});
			describe('Mapply Forcing the Map Function Body in the first arg', () => {
				applyCase('Forcing First Argument', applyCaps, 'res <- mapply(function(x) x + 1, 1:3)', '1@res');
				applyCase('Force-Including Reference', applyCaps, 'foo <- bar()\nres <- mapply(function(x) foo * 2, 1:3)', '2@res');
			});
		});
		describe('Using built-in names as a variable', () => {
			for(const [loop, loopLabel] of [['for(i in 1:length(l))', 'for-loop'], ['while(xx)', 'while-loop'], ['repeat', 'repeat-loop']] as const) {
				describe(loopLabel, () => {
					for(const name of ['c', 'list', 'class', 'dim', 'any', 't', 'attach', 'source']) {
						const code = `foo <- function(l, ${name}) {
        tmp <- list()
        ${loop} tmp[[i]] <- l[[i]] %in% ${name}[[i]]
        return(tmp)
    }
x <- list(1,2,3,4)
y <- c(1,2)
bar <- foo(l=x, ${name}=y)`;
						assertSliced(label(`Using ${name} with `, ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return', loopLabel]),
							shell, code, ['8@bar'], code);
					}
				});
			}
		});
		describe('Loop iteration overwrites', () => {
			const code = 'x <- 20 : 30\nres <- 0\nfor(i in 1:10) {\n    x.y.data <- x[x > 25 + i]\n    for(j in x.y.data) res <- res + 1\n}\nprint(res)';
			assertSliced(label('Loop Re-Iterate', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return']), shell, code, ['7@print'], code);
		});
		describe('Nested dataframe assignments', () => {
			const code = 'df <- foo()\ndf$a[x > 3] <- 5\nprint(df)';
			assertSliced(label('Simple reassignment', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return']), shell, code, ['3@print'], code);
		});
	});
	describe('Closures', () => {
		assertSliced(label('closure w/ default arguments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition', 'closures', 'unnamed-arguments']),
			shell, 'f <- function(x = 1) {\n  function() x\n}\ng <- f(2)\nprint(g())', ['5@g'], 'f <- function(x=1) function() x\ng <- f(2)\ng()');
		assertSliced(label('nested closures w/ default arguments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'newlines', 'lambda-syntax', 'implicit-return', ...OperatorDatabase['+'].capabilities, 'closures', 'grouping']),
			shell, `f <- function(x = 1) {
  (\\(y = 2) function(z = 3) x + y + z)()
}
g <- f(8)
print(g())`, ['5@g'], `f <- function(x=1) (\\(y=2) function(z=3) x + y + z)()
g <- f(8)
g()`, { minRVersion: MIN_VERSION_LAMBDA });
		assertSliced(label('closure w/ side effects', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'closures', ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call', ...OperatorDatabase['+'].capabilities, 'numbers']),
			shell, 'f <- function() {\n  function() {\n    x <<- x + 1\n    x\n  }\n}\nx <- 2\nf()()\nprint(x)', ['9@x'], 'f <- function() function() x <<- x + 1\nx <- 2\nf()()\nx');
	});
	describe('Calls with potential side effects', () => {
		const mapCaps: SupportedFlowrCapabilityId[] = ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives'];
		function mapCase(name: string, code: string, criterion: SlicingCriterion, expected: string) {
			assertSliced(label(name, mapCaps), shell, code, [criterion], expected);
		}
		assertSliced(label('Changing the working directory', [
			'functions-with-global-side-effects', 'name-normal', 'strings', 'call-normal', 'unnamed-arguments', 'newlines'
		]), shell,
		'setwd("f/")\nx', ['2@x'],
		'setwd("f/")\nx'
		);
		assertSliced(label('Setting a fixed seed', [
			'functions-with-global-side-effects', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines'
		]), shell,
		'seed <- 1234\nset.seed(seed)\nx', ['3@x'],
		'seed <- 1234\nset.seed(seed)\nx'
		);
		assertSliced(label('Configuring options', [
			'functions-with-global-side-effects', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines', 'named-arguments'
		]), shell,
		'options(y=2)\nx', ['2@x'],
		'options(y=2)\nx'
		);
		assertSliced(label('Exit hooks', [
			'functions-with-global-side-effects', 'name-normal', 'numbers', 'call-normal', 'unnamed-arguments', 'newlines', 'named-arguments', 'implicit-return', 'function-definitions'
		]), shell,
		'x\non.exit(function() 3)', ['1@x'],
		'x\non.exit(function() 3)'
		);
		assertSliced(label('Library Loads and Installations', [
			'functions-with-global-side-effects', 'name-normal', 'strings', 'call-normal', 'unnamed-arguments', 'newlines', 'library-loading'
		]), shell,
		/* w should be included as it defined the package to be loaded by the library call */
		'v\nlibrary(x)\nrequire(y)\nw <- "x"\nattachNamespace(w)\nloadNamespace("x")', ['1@v'],
		'v\nlibrary(x)\nrequire(y)\nw <- "x"\nattachNamespace(w)\nloadNamespace("x")'
		);
		mapCase('Points Should Link to Plot', 'plot(f)\npoints(g)', '2@points', 'plot(f)\npoints(g)');
		mapCase('Custom plot should have no links', 'plot <- function() {}\nplot(f)\npoints(g)', '3@points', 'points(g)');
		describe('maps::map', () => {
			mapCase('Link to the last map', 'map(f)\nx <- points(g)', '2@points', 'map(f)\npoints(g)');
			mapCase('Link to the last map (print)', 'map(f)\nx <- points(g)\nprint(x)', '3@print', 'map(f)\nx <- points(g)\nprint(x)');
			mapCase('Link to the last map (with par)', 'par(mar=c(1,1,1,1))\nmap(f)\nx <- points(g)', '3@x', 'par(mar=c(1,1,1,1))\nmap(f)\nx <- points(g)');
			mapCase('Link to the last map (multiple map)', 'map("x")\nmap("y")\nx <- points(g)', '3@x', 'map("y")\nx <- points(g)');
			mapCase('Link to the last map (map with foo)', 'map("a", foo=c(-1))\npoints(x)', '2@points', 'map("a", foo=c(-1))\npoints(x)');
			mapCase('An added map should be included', 'map("a", add=TRUE)\npoints(x)', '2@points', 'map("a", add=TRUE)\npoints(x)');
			mapCase('A not-added map should be kept', 'map("a", add=FALSE)\npoints(x)', '2@points', 'map("a", add=FALSE)\npoints(x)');
			mapCase('Map-Add should cascade', 'map("a", add=FALSE)\nmap("b", add=TRUE)\npoints(x)', '3@points', 'map("a", add=FALSE)\nmap("b", add=TRUE)\npoints(x)');
		});
		describe('unknown assigns', () => {
			const assignCaps: SupportedFlowrCapabilityId[] = ['functions-with-global-side-effects', 'name-normal', 'call-normal'];
			function assignCase(name: string, code: string, expected: string) {
				assertSliced(label(name, assignCaps), shell, code, ['2@x'], expected);
			}
			assignCase('Same assign target', 'assign("x", 3)\nprint(x)', 'assign("x", 3)\nx');
			assignCase('Different assign target', 'assign("y", 3)\nprint(x)', 'x');
			/* as we do not know the target of `y`/`x`, we mark as unknown */
			assignCase('Variable assign target (different)', 'assign(y, 3)\nprint(x)', 'assign(y, 3)\nx');
			assignCase('Variable assign target (same)', 'assign(x, 3)\nprint(x)', 'assign(x, 3)\nx');
		});
	});
	describe('Array Overwriting Loops', () => {
		assertSliced(label('Overwrite in For-Loop', [
			'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'for-loop', 'newlines', 'unnamed-arguments', 'call-normal',
			'built-in-sequencing', 'double-bracket-access', 'replacement-functions', 'return', 'special-operator', 'function-definitions',
			'named-arguments'
		]), shell, `foo <- function(l,c){
\ttmp <- list()
\tfor(i in 1:length(l)){
\t\ttmp[[i]] <- l[[i]]%in%c[[i]]
\t}
\treturn(tmp)
}
bar <- foo(l=x, c=y)`, ['8@bar'], 'foo <- function(l, c) {\n        tmp <- list()\n        for(i in 1:length(l)) tmp[[i]] <- l[[i]] %in% c[[i]]\n        return(tmp)\n    }\nbar <- foo(l=x, c=y)');
	});
	describe('Include Callees', () => {
		const capabilities: SupportedFlowrCapabilityId[] = [
			'function-definitions', 'formals-named', 'name-normal', 'numbers', 'call-normal', 'newlines',
			'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities
		];
		function calleeCase(name: string, code: string, criterion: SlicingCriterion, expected: string, includeCallees?: boolean) {
			assertSliced(label(name, capabilities), shell, code, [criterion], expected, includeCallees ? { includeCallees: true } : undefined);
		}
		const code = 'f <- function(x) {\n  y <- x * 2\n  print(y)\n}\nf(21)';
		calleeCase('default stops at the function-definition boundary', code, '3@print', 'function(x) {\n    y <- x * 2\n    print(y)\n}');
		calleeCase('includeCallees continues past the boundary', code, '3@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }\nf(21)', true);
		calleeCase('includeCallees includes all call sites', 'f <- function(x) {\n  y <- x * 2\n  print(y)\n}\nf(21)\nf(99)', '3@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }\nf(21)\nf(99)', true);
		calleeCase('includeCallees does not pull in unrelated code', 'g <- 3\nf <- function(x) {\n  y <- x * 2\n  print(y)\n}\nf(21)', '4@print', 'f <- function(x) {\n        y <- x * 2\n        print(y)\n    }\nf(21)', true);
		// gate: a self-contained body (no parameter, no captured variable) must not pull in the callers
		const codeSelfContained = 'f <- function(x) {\n  y <- 5\n  print(y)\n}\nf(21)';
		calleeCase('includeCallees is a no-op when the body does not depend on the interface', codeSelfContained, '3@print', 'y <- 5\nprint(y)', true);
		calleeCase('self-contained body slices identically without the flag', codeSelfContained, '3@print', 'y <- 5\nprint(y)');
		// gate: a captured variable from the enclosing scope does let the callers (and the capture) in
		calleeCase('includeCallees follows a captured enclosing-scope variable', 'z <- 10\nf <- function(x) {\n  y <- z\n  print(y)\n}\nf(21)', '4@print', 'z <- 10\nf <- function(x) {\n        y <- z\n        print(y)\n    }\nf(21)', true);
	});
	describe('Super-assignment binds lexically', () => {
		const superCaps: readonly SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['<<-'].capabilities, 'normal-definition', 'implicit-return', 'closures', 'lexicographic-scope', 'side-effects-in-function-call', 'numbers', 'newlines', 'semicolons', 'call-normal', 'unnamed-arguments'];
		function superCase(name: string, code: string, criterion: SlicingCriterion, expected: string, out: string) {
			assertSliced(label(name, superCaps), shell, code, [criterion], expected, { expectedOutput: out, expectedSliceOutput: out });
		}
		/* `<<-` searches the enclosing frames first, so this writes f's `x`, not the global one */
		superCase('the enclosing function frame wins over the global one', 'f <- function() { x <- 2; h <- function() x <<- 9; h(); x }\nv <- f()\nv', '3@v', 'f <- function() {\n        x <- 2\n        h <- function() x <<- 9\n        h()\n        x\n    }\nv <- f()\nv', '[1] 9');
		/* the write lands on f's `x`, so the global one is never touched and the call is irrelevant */
		superCase('a write caught by an enclosing frame leaves the global one alone', 'x <- 1\nf <- function() { x <- 2; h <- function() x <<- 9; h() }\nf()\nv <- x\nv', '5@v', 'x <- 1\nv <- x\nv', '[1] 1');
		/* control: a closure counter writes the frame it captured, so every call depends on the one before */
		superCase('a closure counter still chains its calls', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nc1 <- mk()\nc1()\nv <- c1()\nv', '5@v', 'mk <- function() {\n        n <- 0\n        function() {\n            n <<- n + 1\n            n\n        }\n    }\nc1 <- mk()\nc1()\nv <- c1()\nv', '[1] 1\n[1] 2');
		/* control: with no enclosing frame holding the name, the global one is still the target */
		superCase('a super-assignment no enclosing frame catches still reaches the global one', 'x <- 1\nf <- function() { g <- function() x <<- 42; g(); x }\nv <- f()\nv', '4@v', 'x <- 1\nf <- function() {\n        g <- function() x <<- 42\n        g()\n        x\n    }\nv <- f()\nv', '[1] 42');
	});
	describe('User-defined replacement functions', () => {
		const replCaps: readonly SupportedFlowrCapabilityId[] = ['name-quoted', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'replacement-functions', 'normal-definition', 'formals-named', 'implicit-return', 'numbers', 'newlines', 'call-normal', 'unnamed-arguments'];
		/** `code` is also the expected slice, as none of these drop anything */
		function replCase(name: string, extraCaps: SupportedFlowrCapabilityId[], code: string, criterion: SlicingCriterion, out: string) {
			assertSliced(label(name, [...replCaps, ...extraCaps]), shell, code, [criterion], code, { expectedOutput: out, expectedSliceOutput: out });
		}
		/* a replacement function rebinds its target whether or not flowR ships a built-in for it */
		replCase('a user-defined replacement rebinds its target', [], '`s<-` <- function(x, value) x + value\ny <- 1\ns(y) <- 5\nv <- y\nv', '5@v', '[1] 6');
		/* the same holds when the user redefines a replacement we do know */
		replCase('a user redefinition of a known replacement rebinds its target', [], '`levels<-` <- function(x, value) x + value\ny <- 1\nlevels(y) <- 5\nv <- y\nv', '5@v', '[1] 6');
		/* control: a built-in replacement is unaffected */
		replCase('a built-in replacement is unchanged', ['built-in-sequencing', 'single-bracket-access', 'strings'], 'x <- c(1, 2)\nnames(x) <- c("a", "b")\nv <- names(x)[1]\nv', '4@v', '[1] "a"');
		/* the super-assigning form binds outside the frame it is called in */
		assertSliced(label('a super-assigning user replacement binds outside the frame', [...replCaps, ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call']), shell, '`s<-` <- function(x, value) x + value\ny <- 1\nf <- function() { s(y) <<- 5 }\nf()\nv <- y\nv', ['6@v'], '`s<-` <- function(x, value) x + value\ny <- 1\nf <- function() s(y) <<- 5\nf()\nv <- y\nv', { expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
	});
}));
