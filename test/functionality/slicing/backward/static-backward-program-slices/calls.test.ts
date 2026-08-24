import { assertSliced, assumeLoadedPackages, withShell } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';
import { MIN_VERSION_LAMBDA } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions';
import { describe } from 'vitest';

assumeLoadedPackages('dplyr', 'magrittr', 'maps', 'plyr', 'inferference');


describe('Calls', { concurrent: false }, withShell(shell => {
	describe('Simple Calls', () => {
		const code = `i <- 4
a <- function(x) { x }
a(i)`;
		for(const criterion of ['3:1', '3@a'] as const) {
			assertSliced(label(JSON.stringify(code), ['function-definitions', 'resolve-arguments', 'formals-named', 'name-normal', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments']),
				shell, code, [criterion], `i <- 4
a <- function(x) x
a(i)`
			);
		}
		const constCapabilities: SupportedFlowrCapabilityId[] = ['function-definitions', 'resolve-arguments', 'formals-named', 'name-normal', 'numbers', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'implicit-return'];
		const constFunction = `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`;
		/* actually, `i` does not have to be defined, as it is _not used_ by the function, so we do not have to include `i <- 4` */
		assertSliced(label('Function call with constant function', constCapabilities),
			shell, constFunction, ['3:1'], `a <- function(x) 1
a(i)`);
		/* nothing of the function-content is required */
		assertSliced(label('Slice function definition', constCapabilities),
			shell, constFunction, ['2@a'], 'a <- function(x) { }');
		assertSliced(label('Slice within function', constCapabilities), shell, constFunction, ['2@[2]x'], 'x <- 2');
		assertSliced(label('Multiple unknown calls', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'numbers', 'call-normal', 'newlines']),
			shell, `
foo(x, y)
foo(x, 3)
    `, ['3@foo'], 'foo(x, 3)');
		assertSliced(label('Multiple unknown calls sharing known def', ['name-normal', 'resolve-arguments', 'formals-named', 'unnamed-arguments', 'implicit-return', 'numbers', 'call-normal', 'newlines']),
			shell, `
x. <- function (x) { x }
foo(x, x.(y))
foo(x, x.(3))
    `, ['4@foo'], `x. <- function(x) x
foo(x, x.(3))`);
		assertSliced(label('Using ...', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-dot-dot-dot', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'numbers']),
			shell, `
f1 <- function (a,b) { WW }
f2 <- function (...) { f1(...) }
x <- 3
WW <- 4
y <- 3
f2(1,x)
    `, ['7@f2'], `f1 <- function(a, b) WW
f2 <- function(...) f1(...)
x <- 3
WW <- 4
f2(1,x)`);
	});
	describe('Functions using environment', () => {
		describe('Read variable defined before', () => {
			const code = `i <- 4
a <- function(x) { x + i }
a(4)`;
			for(const criterion of ['3:1', '3@a'] as const) {
				assertSliced(label('Must include read', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'numbers']),
					shell, code, [criterion], `i <- 4
a <- function(x) x + i
a(4)`);
			}
		});
		describe('Read variable defined after', () => {
			const code = `a <- function(x) { x + i }
i <- 4
a(5)`;
			for(const criterion of ['3:1', '3@a'] as const) {
				assertSliced(label('Must include read', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'numbers']),
					shell, code, [criterion], `a <- function(x) x + i
i <- 4
a(5)`);
			}
		});
		describe('Read variable defined before and after', () => {
			const code = `i <- 3
a <- function(x) { x + i }
i <- 4
a(5)`;
			for(const criterion of ['4:1', '4@a'] as const) {
				assertSliced(label('Only keep second definition', ['name-normal', 'resolve-arguments', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'numbers']), shell, code, [criterion], `a <- function(x) x + i
i <- 4
a(5)`);
			}
		});
	});
	describe('Functions with multiple definitions', () => {
		const code = `a <- b <- function() { x }
x <- 2
a()
b()`;
		const caps: SupportedFlowrCapabilityId[] = ['name-normal', 'normal-definition', 'implicit-return', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'return-value-of-assignments', 'precedence'];
		assertSliced(label('Include only b-definition', caps),
			shell, code, ['3@a'], `a <- b <- function() x
x <- 2
a()`);
		assertSliced(label('Include only b-definition', caps),
			shell, code, ['4@b'], `b <- function() x
x <- 2
b()`);
	});
	describe('Functions with named arguments', () => {
		const code = `a <- function(x=4) { x }
a(x = 3)`;
		assertSliced(label('Must include function definition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'implicit-return', 'newlines', 'named-arguments', 'resolve-arguments', 'numbers']),
			shell, code, ['2@a'], `a <- function(x=4) x
a(x = 3)`);

		assertSliced(label('Must work for same named arguments too', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'named-arguments', 'newlines']),
			shell, 'a <- 3\nb <- foo(a=a)', ['2@b'], 'a <- 3\nb <- foo(a=a)');

		assertSliced(label('Must work for same named arguments nested', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'named-arguments', 'accessing-exported-names', 'implicit-return', 'newlines', 'strings']), shell, `
f <- function(some_variable="hello") {
  result <- some::other(some_variable=some_variable)
  result
}
    `, ['4@result'], `function(some_variable="hello") {
    result <- some::other(some_variable=some_variable)
    result
}`);


		const lateCode = `f <- function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }
f()
`;
		assertSliced(label('Late bindings of parameter in body', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'implicit-return', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'call-normal', 'semicolons']),
			shell, lateCode, ['2@f'], `f <- function(a=b, m=3) {
        b <- 1
        a + 1
    }
f()`);
		const lateCodeB = `f <- function(a=b, b=3) { b <- 1; a; b <- 5; a + 1 }
f()
`;
		assertSliced(label('Late bindings of parameter in parameters', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'call-normal', ...OperatorDatabase['+'].capabilities, 'semicolons']),
			shell, lateCodeB, ['2@f'], `f <- function(a=b, b=3) a + 1
f()`);
		assertSliced(label('Parameters binding context', ['name-normal', 'formals-promises', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'implicit-return', 'newlines', 'numbers', 'call-normal']),
			shell, `f <- function(a=y) { a }
a <- 5
y <- 3
y <- 4
f()`, ['5@f'], `f <- function(a=y) a
y <- 4
f()`);

		assertSliced(label('Named argument collides with variable', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'unnamed-arguments', 'named-arguments', 'newlines']), shell, 'x <- 100\nlist(123, x = 200, 234)\nprint(x)',
			['3@x'], 'x <- 100\nx');
	});
	describe('Functions with nested definitions', () => {
		describe('Simple Function pass with return', () => {
			const code = `a <- function() { a <- 2; return(function() { 1 }) }
b <- a()
b()`;
			assertSliced(label('Must include outer function', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'numbers', 'return', 'implicit-return', 'call-normal', 'newlines', 'semicolons']),
				shell, code, ['2@a'], `a <- function() return(function() { 1 })
a()`);
			assertSliced(label('Must include linked function', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'return', 'implicit-return', 'numbers', 'newlines', 'call-normal']),
				shell, code, ['3@b'], `a <- function() return(function() { 1 })
b <- a()
b()`);
		});
		describe('Functions binding multiple scopes', () => {
			const code = `
a <- function() { x <- function() { z + y }; y <- 12; return(x) }
y <- 5
z <- 5
u <- a()
u()`;
			assertSliced(label('Must include function shell', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'numbers', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'return', 'newlines', 'call-normal', 'semicolons']),
				shell, code, ['5@a'], `a <- function() {
        x <- function() { }
        return(x)
    }
a()`);
			assertSliced(label('Must include function shell on call', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'return', 'call-normal']), shell, code, ['6@u'], `a <- function() {
        x <- function() z + y
        y <- 12
        return(x)
    }
z <- 5
u <- a()
u()`);
		});
	});
	describe('Anonymous Functions', () => {
		assertSliced(label('keep anonymous', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'binary-operator', 'infix-calls', ...OperatorDatabase['-'].capabilities, 'implicit-return', 'call-anonymous', 'unnamed-arguments']),
			shell, `
x <- (function() {
  x <- 4
  x - 5
  3
 })()
cat(x)
    `, ['7@x'], `x <- (function() 3)()
x`);
	});
	describe('Criterion within a function body', () => {
		/* slicing into the body yields the statements themselves, the definition is not required for them */
		assertSliced(label('body without its header', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'function-calls', 'call-normal']),
			shell, 'f <- function() { x <- 2\nprint(x) }\nf()', ['2@x'], 'x <- 2\nx',
			{ expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' }
		);
	});
	describe('Higher-order Functions', () => {
		const code = `a <- function() { x <- 3; i }
i <- 4
b <- function(f) { i <- 5; f() }
b(a)`;
		const caps: SupportedFlowrCapabilityId[] = ['name-normal', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'newlines', 'numbers', 'formals-named', 'call-normal', 'unnamed-arguments'];
		assertSliced(label('Only i, not bound in context', caps), shell, code, ['1@i'], 'i');
		assertSliced(label('Slice of b is independent', caps), shell, code, ['3@b'], 'b <- function(f) { }');
		assertSliced(label('Slice of b-call uses function', caps), shell, code, ['4@b'], `a <- function() i
b <- function(f) {
        i <- 5
        f()
    }
b(a)`);
		assertSliced(label('Directly call returned function', ['name-normal', 'closures', 'resolve-arguments', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'normal-definition', 'implicit-return', 'return', 'unnamed-arguments', 'newlines', 'numbers', 'call-normal']),
			shell, `m <- 12
a <- function(x) {
  b <- function() { function() { x } }
  return(b())
}
res <- a(m)()`, ['6@res'], `m <- 12
a <- function(x) {
        b <- function() function() x
        return(b())
    }
res <- a(m)()`);
		assertSliced(label('Higher order anonymous function', ['name-normal', 'resolve-arguments', 'closures', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'normal-definition', 'call-anonymous', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'newlines', 'precedence']),
			shell, `a <- function(b) {
  b
}
x <- a(function() 2 + 3)() + a(function() 7)()`, ['4@x'], `a <- function(b) b
x <- a(function() 2 + 3)() + a(function() 7)()`);
	});
	describe('Side-Effects', () => {
		assertSliced(label('Important Side-Effect', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call', 'implicit-return', 'call-normal', 'unnamed-arguments', 'newlines', 'precedence']), shell, `x <- 2
f <- function() { x <<- 3 }
f()
cat(x)
    `, ['4@x'], `f <- function() x <<- 3
f()
x`);

		assertSliced(label('Unimportant Side-Effect', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', ...OperatorDatabase['<<-'].capabilities, 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'call-normal', 'unnamed-arguments', 'newlines']), shell, `f <- function() { y <<- 3 }
f()
cat(x)
    `, ['3@x'], 'x');
	});
	assertSliced(label('Nested Side-Effect For Last', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'implicit-return', 'numbers', 'call-normal', 'side-effects-in-function-call']), shell, `f <- function() {
  a <- function() { x }
  x <- 3
  a()
  x <- 2
  a()
}
b <- f()
    `, ['8@b'], `f <- function() {
        a <- function() x
        x <- 2
        a()
    }
b <- f()`);
	// that it contains x <- 2 is an error in the current implementation as this happens due to the 'reads' edge from the closure linking
	// however, this read edge should not apply when the call happens within the same scope
	// we have to separate on the exit points for this and re-resolve for each exit point
	assertSliced(label('Nested Side-Effect For First', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'numbers', 'call-normal', 'newlines', 'side-effects-in-function-call']), shell, `f <- function() {
  a <- function() { x }
  x <- 3
  b <- a()
  x <- 2
  a()
  b
}
b <- f()
    `, ['9@b'], `f <- function() {
        a <- function() x
        x <- 3
        b <- a()
        x <- 2
        b
    }
b <- f()`);
	assertSliced(label('always dominating', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'side-effects-in-function-call' ]),
		shell, 'x <- 2\nf <- function() x <<- 3\nf()\nprint(x)', ['4@x'], 'f <- function() x <<- 3\nf()\nx');
	assertSliced(label('conditionally dominating', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'side-effects-in-function-call' ]),
		shell, 'x <- 2\nf <- function() x <<- 3\nif(u) f()\nprint(x)', ['4@x'], 'x <- 2\nf <- function() x <<- 3\nif(u) f()\nx');
	describe('Early return of function', () => {
		const code = `x <- (function() {
  g <- function() { y }
  y <- 5
  if(z)
  	return(g)
  y <- 3
  g
})()
res <- x()`;
		assertSliced(label('Double return points', ['name-normal', 'closures', ...OperatorDatabase['<-'].capabilities, 'call-anonymous', 'normal-definition', 'implicit-return', 'numbers', 'if', 'return', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['9@res'], `
x <- (function() {
        g <- function() y
        y <- 5
        if(z) return(g)
        y <- 3
        g
    })()
res <- x()`.trim());
	});
	describe('Recursive functions', () => {
		const code = `f <- function() { f() }
f()`;
		assertSliced(label('Endless recursion', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['2@f'], `f <- function() f()
f()`);
	});
	describe('Uninteresting calls', () => {
		const code = `
a <- list(1,2,3,4)
a[3]
print(a[2])
    `;
		assertSliced(label('No function if not required', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'single-bracket-access', 'newlines']), shell, code, ['3@a'], `a <- list(1,2,3,4)
a`);
	});
	describe('Global vs. local definitions', () => {
		const localCode = `
a <- function() { x = x + 5; cat(x) }
x <- 3
a()
cat(x)`;
		const localCaps: readonly SupportedFlowrCapabilityId[] = ['name-normal', 'lexicographic-scope', 'normal-definition', ...OperatorDatabase['='].capabilities, 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'semicolons', 'unnamed-arguments', 'newlines', 'call-normal', 'numbers', 'precedence'];
		assertSliced(label('Local redefinition has no effect', localCaps), shell, localCode, ['5@x'], `x <- 3
x`);
		assertSliced(label('Local redefinition must be kept as part of call', localCaps), shell, localCode, ['4@a'], `a <- function() {
        x = x + 5
        cat(x)
    }
x <- 3
a()`);
		const globalCode = `
a <- function() { x <<- x + 5; cat(x) }
x <- 3
a()
x`;
		assertSliced(label('But the global redefinition remains', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'call-normal', 'unnamed-arguments', 'precedence']), shell, globalCode, ['5@x'], `a <- function() x <<- x + 5
x <- 3
a()
x`);
		const globalCodeWithoutLocal = `
a <- function() { x <<- 5; cat(x) }
x <- 3
a()
x`;
		assertSliced(label('The local assignment is only needed if the global reads', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'function-definitions', ...OperatorDatabase['<<-'].capabilities, 'numbers', 'newlines', 'call-normal', 'unnamed-arguments', 'precedence']), shell, globalCodeWithoutLocal, ['5@x'], `a <- function() x <<- 5
a()
x`);

		assertSliced(label('Must work with nested globals', ['name-normal', 'resolve-arguments', 'lexicographic-scope', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'numbers', 'call-normal', 'unnamed-arguments', 'precedence']),
			shell, `a <- function() { function(b) x <<- b }
y <- 5
x <- 2
a()(y)
x`, ['5@x'], `a <- function() function(b) x <<- b
y <- 5
a()(y)
x`);

		assertSliced(label('Must work with nested globals and known assignments not-happening', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'if', 'logical', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments', 'resolve-arguments', 'implicit-return', 'newlines', 'call-normal', 'unnamed-arguments']),
			shell, `a <- function() { function(b) { if(FALSE) { x <<- b } } }
y <- 5
x <- 2
a()(y)
cat(x)`, ['5@x'], `x <- 2
x`);

		assertSliced(label('Must work with nested globals and maybe assignments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'formals-named', 'if', 'call-normal', ...OperatorDatabase['>'].capabilities, 'numbers', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments', 'resolve-arguments', 'lexicographic-scope', 'newlines', 'unnamed-arguments', 'closures']),
			shell, `a <- function() { function(b) { if(runif() > .5) { x <<- b } } }
y <- 5
x <- 2
a()(y)
cat(x)`, ['5@x'], `a <- function() function(b) if(runif() > .5) { x <<- b }
y <- 5
x <- 2
a()(y)
x`);
	});
	describe('Using strings for definitions', () => {
		const code = `
'a' <- function() { x <- 3; 4 }
'a'()
a()
a <- function() { x <- 3; 5 }
'a'()
a()
\`a\`()
    `;
		const caps: SupportedFlowrCapabilityId[] = ['name-quoted', 'name-escaped', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'name-normal', 'numbers', 'semicolons', 'implicit-return', 'call-normal', 'newlines', 'name-escaped'];
		assertSliced(label('Must link with string/string', caps), shell, code, ['3@\'a\''], `'a' <- function() 4
'a'()`);
		assertSliced(label('Must link with string/no-string', caps), shell, code, ['4@a'], `'a' <- function() 4
a()`);
		assertSliced(label('Must link with no-string/string', caps), shell, code, ['6@\'a\''], `a <- function() 5
'a'()`);
		// the common case:
		assertSliced(label('Must link with no-string/no-string', caps), shell, code, ['7@a'], `a <- function() 5
a()`);
		assertSliced(label('Try with special backticks', caps), shell, code, ['8@`a`'], `a <- function() 5
\`a\`()`);
	});
	describe('Using own infix operators', () => {
		const code = `
\`%a%\` <- function(x, y) { x + y }
\`%a%\`(3, 4)

'%b%' <- function(x, y) { x * y }
'%b%'(3, 4)

cat(3 %a% 4)
cat(4 %b% 5)
      `;
		const caps: SupportedFlowrCapabilityId[] = ['name-escaped', 'resolve-arguments', 'name-quoted', 'infix-calls', 'formals-named', 'implicit-return', 'newlines', 'unnamed-arguments', 'special-operator'];
		assertSliced(label('Must link with backticks', caps), shell, code, ['8:7'], `\`%a%\` <- function(x, y) x + y
3 %a% 4`);
		assertSliced(label('Must link with backticks', caps), shell, code, ['9:7'], `'%b%' <- function(x, y) x * y
4 %b% 5`);
		assertSliced(label('Must work with assigned custom pipes too', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'infix-calls', 'numbers', 'special-operator', 'precedence']),
			shell, 'a <- b %>% c %>% d', ['1@a'], 'a <- b %>% c %>% d');
	});
	describe('Using own alias infix operators', () => {
		const code = `
"%a%" <- function(x, y) { x + y }
"%a%" <- pkg::"%a%"
cat(4 %a% 5)
      `;
		assertSliced(label('Must link alias but not namespace origin', ['name-quoted', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'infix-calls', 'special-operator', 'accessing-exported-names', 'newlines', 'unnamed-arguments']),
			shell, code, ['4:1'], `"%a%" <- pkg::"%a%"
cat(4 %a% 5)`);
	});
	describe('Using own alias infix operators with namespace', () => {
		const code = `
pkg::"%a%" <- function(x, y) { x + y }
"%a%" <- pkg::"%a%"
cat(4 %a% 5)
      `;
		assertSliced(label('must link alias with namespace', ['accessing-exported-names', 'resolve-arguments', 'name-quoted', ...OperatorDatabase['<-'].capabilities, 'formals-named', 'implicit-return', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'special-operator', 'unnamed-arguments']),
			shell, code, ['4:1'], `pkg::"%a%" <- function(x, y) x + y
"%a%" <- pkg::"%a%"
cat(4 %a% 5)`);
	});
	describe('Quotation', () => {
		assertSliced(label('quote does not reference variables', ['name-normal', 'newlines', ...OperatorDatabase['<-'].capabilities, 'built-in-quoting' ]),
			shell, 'x <- 3\ny <- quote(x)', ['2@y'], 'y <- quote(x)');
	});
	describe('S3 Dispatch', () => {
		/* the generic has to evaluate its object to know the class, even though no method body reads it */
		assertSliced(label('dispatch forces its object', ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, 'p <- function(x) UseMethod("p")\np.foo <- function(x) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', ['5@v'],
			'p <- function(x) UseMethod("p")\np.foo <- function(x) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv',
			{ expectedOutput: '[1] "FOO"', expectedSliceOutput: '[1] "FOO"' });
		assertSliced(label('dispatch with dots forces its object', ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, 'p <- function(x, ...) UseMethod("p")\np.foo <- function(x, ...) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv', ['5@v'],
			'p <- function(x, ...) UseMethod("p")\np.foo <- function(x, ...) "FOO"\no <- structure(1, class="foo")\nv <- p(o)\nv',
			{ expectedOutput: '[1] "FOO"', expectedSliceOutput: '[1] "FOO"' });
		assertSliced(label('next-method keeps the object as well', ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, 'p <- function(x) UseMethod("p")\np.foo <- function(x) NextMethod()\np.default <- function(x) "DEF"\no <- structure(1, class="foo")\nv <- p(o)\nv', ['6@v'],
			'p <- function(x) UseMethod("p")\np.foo <- function(x) NextMethod()\np.default <- function(x) "DEF"\no <- structure(1, class="foo")\nv <- p(o)\nv',
			{ expectedOutput: '[1] "DEF"', expectedSliceOutput: '[1] "DEF"' });
		/* control: a plain function never forces the parameter it does not mention, so the argument may go */
		assertSliced(label('a plain call still drops the argument it never forces', ['name-normal', 'numbers', 'strings', 'newlines', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, 'p <- function(x) "FOO"\nu <- 1\nv <- p(u)\nv', ['4@v'],
			'p <- function(x) "FOO"\nv <- p(u)\nv',
			{ expectedOutput: '[1] "FOO"', expectedSliceOutput: '[1] "FOO"' });
		/* control: naming the object moves the dispatch to it, leaving the first formal lazy */
		assertSliced(label('a named object leaves the first formal lazy', ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, 'p <- function(x, y) UseMethod("p", y)\np.foo <- function(x, y) "FOO"\np.default <- function(x, y) "DEF"\nw <- 7\no <- structure(1, class="foo")\nv <- p(w, o)\nv', ['7@v'],
			'p <- function(x, y) UseMethod("p", y)\np.foo <- function(x, y) "FOO"\np.default <- function(x, y) "DEF"\no <- structure(1, class="foo")\nv <- p(w, o)\nv',
			{ expectedOutput: '[1] "FOO"', expectedSliceOutput: '[1] "FOO"' });
	});
	describe('S3 Dispatch on Base Generics', () => {
		const baseCaps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s3', 'normal-definition', 'implicit-return', 'call-normal', 'named-arguments', 'unnamed-arguments', ...OperatorDatabase['<-'].capabilities];
		/* `length` dispatches just like a `UseMethod` generic does, so its method has to stay */
		assertSliced(label('a method of a base generic stays', baseCaps),
			shell, 'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', ['4@v'],
			'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv',
			{ expectedOutput: '[1] 99', expectedSliceOutput: '[1] 99' });
		assertSliced(label('a method of an operator stays', [...baseCaps, 'name-quoted', 'infix-calls', ...OperatorDatabase['+'].capabilities]),
			shell, '"+.mn" <- function(e1, e2) 123\no <- structure(1, class="mn")\nv <- o + 1\nv', ['4@v'],
			'"+.mn" <- function(e1, e2) 123\no <- structure(1, class="mn")\nv <- o + 1\nv',
			{ expectedOutput: '[1] 123', expectedSliceOutput: '[1] 123' });
		assertSliced(label('a method of an extractor stays', [...baseCaps, 'name-quoted', 'single-bracket-access']),
			shell, '"[.mm" <- function(x, i) 55\no <- structure(c(1,2,3), class="mm")\nv <- o[2]\nv', ['4@v'],
			'"[.mm" <- function(x, i) 55\no <- structure(c(1,2,3), class="mm")\nv <- o[2]\nv',
			{ expectedOutput: '[1] 55', expectedSliceOutput: '[1] 55' });
		assertSliced(label('next-method through a base generic', baseCaps),
			shell, 'length.zz <- function(x) NextMethod()\no <- structure(c(1,2,3), class="zz")\nv <- length(o)\nv', ['4@v'],
			'length.zz <- function(x) NextMethod()\no <- structure(c(1,2,3), class="zz")\nv <- length(o)\nv',
			{ expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
		/* precision: only the methods of the generic that is called, and only when it is called at all */
		assertSliced(label('a method of another generic is not dragged in', baseCaps),
			shell, 'foo.bar <- function(x) 1\nlength.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv', ['5@v'],
			'length.zz <- function(x) 99\no <- structure(1, class="zz")\nv <- length(o)\nv',
			{ expectedOutput: '[1] 99', expectedSliceOutput: '[1] 99' });
		assertSliced(label('an undispatched method goes', baseCaps),
			shell, 'length.zz <- function(x) 99\nu <- 5\nv <- u\nv', ['4@v'],
			'u <- 5\nv <- u\nv',
			{ expectedOutput: '[1] 5', expectedSliceOutput: '[1] 5' });
	});
	describe('S4 Registration', () => {
		const s4Caps: SupportedFlowrCapabilityId[] = ['name-normal', 'numbers', 'strings', 'newlines', 'oop-s4', 'normal-definition', 'implicit-return', 'call-normal', 'unnamed-arguments', 'named-arguments', ...OperatorDatabase['<-'].capabilities];
		/* `setClass` writes a string-keyed registry `new("P")` reads, so the slice cannot drop it */
		assertSliced(label('new keeps the class registration', s4Caps),
			shell, 'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', ['4@r'],
			'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr',
			{ expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		assertSliced(label('a prototype default is kept with its class', s4Caps),
			shell, 'setClass("W", representation(v = "numeric"), prototype(v = 12))\no <- new("W")\nr <- o@v\nr', ['4@r'],
			'setClass("W", representation(v = "numeric"), prototype(v = 12))\no <- new("W")\nr <- o@v\nr',
			{ expectedOutput: '[1] 12', expectedSliceOutput: '[1] 12' });
		/* `setMethod` answers an existing generic, so it depends on the `setGeneric` that created it */
		assertSliced(label('a method keeps the generic it answers', s4Caps),
			shell, 'setGeneric("sz", function(x) standardGeneric("sz"))\nsetMethod("sz", "numeric", function(x) x * 3)\nr <- sz(4)\nr', ['4@r'],
			'setGeneric("sz", function(x) standardGeneric("sz"))\nsetMethod("sz", "numeric", function(x) x * 3)\nr <- sz(4)\nr',
			{ expectedOutput: '[1] "sz"\n[1] 12', expectedSliceOutput: '[1] "sz"\n[1] 12' });
		/* `callNextMethod` reaches the method of the superclass, which the chain of generic reads keeps */
		assertSliced(label('call-next-method keeps the inherited method', s4Caps),
			shell, 'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "A", function(o) o@x)\nsetMethod("f", "B", function(o) callNextMethod() + 1)\nr <- f(new("B", x = 10))\nr', ['7@r'],
			'setClass("A", representation(x = "numeric"))\nsetClass("B", contains = "A")\nsetGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "A", function(o) o@x)\nsetMethod("f", "B", function(o) callNextMethod() + 1)\nr <- f(new("B", x = 10))\nr',
			{ expectedOutput: '[1] "f"\n[1] 11', expectedSliceOutput: '[1] "f"\n[1] 11' });
		/* `setValidity` changes what `new` does with the class, so it is kept, and it keeps the declaration in turn */
		assertSliced(label('a validator is kept with the class it guards', s4Caps),
			shell, 'setClass("P", representation(s = "numeric"))\nsetValidity("P", function(object) if(object@s < 0) "neg" else TRUE)\nr <- tryCatch(new("P", s = -1)@s, error = function(e) -99)\nr', ['4@r'],
			'setClass("P", representation(s = "numeric"))\nsetValidity("P", function(object) if(object@s < 0) "neg" else TRUE)\nr <- tryCatch(new("P", s = -1)@s, error = function(e) -99)\nr',
			{ expectedOutput: /\[1\] -99$/, expectedSliceOutput: /\[1\] -99$/ });
		/* precision: the registry is keyed by name, so a class nothing uses stays out */
		assertSliced(label('an unused class registration is dropped', s4Caps),
			shell, 'setClass("P", representation(s = "numeric"))\nsetClass("Q", representation(t = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr', ['5@r'],
			'setClass("P", representation(s = "numeric"))\no <- new("P", s = 1)\nr <- o@s\nr',
			{ expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		/* precision: the same for a generic nothing calls */
		assertSliced(label('an unused generic is dropped', s4Caps),
			shell, 'setGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "numeric", function(o) o * 2)\nsetGeneric("h", function(o) standardGeneric("h"))\nsetMethod("h", "numeric", function(o) o + 100)\nr <- f(3)\nr', ['6@r'],
			'setGeneric("f", function(o) standardGeneric("f"))\nsetMethod("f", "numeric", function(o) o * 2)\nr <- f(3)\nr',
			{ expectedOutput: '[1] "f"\n[1] "h"\n[1] 6', expectedSliceOutput: '[1] "f"\n[1] 6' });
	});
	describe('Assignment and Reflection Functions', () => {
		describe('Assign', () => {
			assertSliced(label('using assign as assignment', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']),
				shell, 'assign("x", 42)\nx', ['2@x'],
				'assign("x", 42)\nx');
			assertSliced(label('function', ['name-normal', 'assignment-functions', 'strings', 'newlines', 'numbers', 'implicit-return', 'normal-definition']),
				shell, 'assign("a", function() 1)\na()', ['2@a'], 'assign("a", function() 1)\na()');
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
			assertSliced(label('using delayed-assign as assignment', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']),
				shell, 'delayedAssign("x", 42)\nx', ['2@x'],
				'delayedAssign("x", 42)\nx');
			/* the promise is forced at the read, so it sees the last write of `x`, not the one at registration time */
			assertSliced(label('using delayed-assign keeps the bindings the force may see', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']),
				shell, 'x <- 4\ndelayedAssign("y", x)\nx <- 5;\ny', ['4@y'],
				'x <- 4\ndelayedAssign("y", x)\nx <- 5\ny', { expectedOutput: '[1] 5', expectedSliceOutput: '[1] 5' });
			assertSliced(label('the delayed expression drags in what it reads', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']),
				shell, 'z <- 1\ndelayedAssign("d", z * 2)\nv <- d\nv', ['4@v'],
				'z <- 1\ndelayedAssign("d", z * 2)\nv <- d\nv', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
			assertSliced(label('the force decides which binding is read', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']),
				shell, 'z <- 1\ndelayedAssign("d", z)\nz <- 10\nv <- d\nv', ['5@v'],
				'z <- 1\ndelayedAssign("d", z)\nz <- 10\nv <- d\nv', { expectedOutput: '[1] 10', expectedSliceOutput: '[1] 10' });
			/* control: an expression without free variables must not pull anything along */
			assertSliced(label('a closed delayed expression drags in nothing', ['name-normal', 'numbers', 'assignment-functions', 'strings', 'newlines', 'global-scope']),
				shell, 'q <- 99\ndelayedAssign("d", 1 + 2)\nv <- d\nv', ['4@v'],
				'delayedAssign("d", 1 + 2)\nv <- d\nv', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
		});
		describe('Get', () => {
			assertSliced(label('get-access should work like a symbol-access', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'name-created']),
				shell, 'x <- 42\ny <- get("x")', ['2@y'],
				'x <- 42\ny <- get("x")');
			assertSliced(label('function', ['name-normal', 'strings', 'newlines', 'normal-definition', 'implicit-return', ...OperatorDatabase['<-'].capabilities, 'name-created']),
				shell, 'a <- function() 1\nb <- get("a")\nb()', ['3@b'], 'a <- function() 1\nb <- get("a")\nb()');
			assertSliced(label('get in function', ['name-normal', 'function-definitions', 'newlines', 'strings', 'implicit-return', 'name-created']),
				shell, `a <- 5
f <- function() {
  get("a")
}
f()`, ['5@f'], `a <- 5
f <- function() get("a")
f()`);
			assertSliced(label('get in function argument', ['name-normal', 'formals-default', 'strings', 'implicit-return', ...OperatorDatabase['<-'].capabilities, 'newlines', 'numbers', 'name-created']),
				shell, `a <- 5
f <- function(a = get("a")) {
  a
}
f()`, ['5@f'], `f <- function(a=get("a")) a
f()`);
		});
		describe('Combine get and assign', () => {
			assertSliced(label('get in assign', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'assignment-functions', 'strings', 'unnamed-arguments', 'newlines', 'name-created']),
				shell, 'b <- 5\nassign("a", get("b"))\nprint(a)', ['3@a'], 'b <- 5\nassign("a", get("b"))\na');
			assertSliced(label('get-access a function call', ['name-normal', 'numbers', 'strings', 'newlines', ...OperatorDatabase['<-'].capabilities, 'global-scope', 'function-definitions', 'call-normal', 'name-created']),
				shell, `a <- function() 1
b <- get("a")
res <- b()`, ['3@res'], `a <- function() 1
b <- get("a")
res <- b()`);
		});
	});
	describe('Redefine built-ins', () => {
		assertSliced(label('redefining assignments should work', ['name-quoted', 'name-normal', 'precedence', 'numbers', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['='].capabilities, 'redefinition-of-built-in-functions-primitives']),
			shell, 'x <- 1\n`<-`<-`*`\nx <- 3\ny = x', ['4@y'], 'x <- 1\ny = x');
		assertSliced(label('redefine if', ['name-escaped', ...OperatorDatabase['<-'].capabilities, 'numbers', 'formals-dot-dot-dot', 'newlines', 'unnamed-arguments']),
			shell, `\`if\` <- function(...) 2
if(1) 
   x <- 3
print(x)`, ['4@x'], 'x <- 3\nx'/*, { expectedOutput: '[1] 2' }*/);
		assertSliced(label('named argument with redefine', ['name-escaped', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities, 'named-arguments', 'newlines', 'numbers']),
			shell, `x <- 2
\`<-\` <- \`*\`
x <- 3
print(y = x)`, ['4@y'], 'y=x');
		assertSliced(label('redefine in local scope', [
			'newlines', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities,
			'numbers', 'name-escaped', 'call-normal', 'function-definitions', 'redefinition-of-built-in-functions-primitives'
		]),
		shell, `f <- function() {
   x <- 2
   \`<-\` <- \`*\`
   x <- 3
}
y <- f()
print(y)`, ['7@y'], `f <- function() {
        x <- 2
        \`<-\` <- \`*\`
        x <- 3
    }
y <- f()
y` /* the formatting here seems wild, why five spaces */, { expectedOutput: '[1] 6' });
	});
	describe('Switch', () => {
		assertSliced(label('Switch with named arguments', ['switch', ...OperatorDatabase['<-'].capabilities, 'numbers', 'strings', 'named-arguments', 'unnamed-arguments', 'switch', 'function-calls' ]),
			shell, 'x <- switch("a", a=1, b=2, c=3)', ['1@x'], 'x <- switch("a", a=1, b=2, c=3)');
	});
	describe('Separate Function Resolution', () => {
		assertSliced(label('Separate function resolution', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'call-normal', 'newlines', 'search-type']),
			shell, 'c <- 3\nc(1, 2, 3)', ['2@c'], 'c(1, 2, 3)');
		assertSliced(label('Separate function resolution', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'call-normal', 'newlines', 'search-type']),
			shell, 'c <- 3\nprint(c(1, 2))', ['2@print'], 'print(c(1, 2))');
	});
	describe('Failures in Practice', () => {
		describe('empty functions', () => {
			assertSliced(label('Empty Function in Reconstruct', ['function-definitions']), shell,
				'x <- 2\nfoo <- function(n, x = 3) { print(x) }\nprint(x)', ['3@x'], 'x <- 2\nx');
		});
		describe('Super Side-Effects', () => {
			assertSliced(label('No recursion', ['super-left-assignment', 'lexicographic-scope']), shell, `calls <- 0
x <- function() {
  calls <<- calls + 1
  4
}
x()`, ['6@x'], 'x <- function() 4\nx()');
			assertSliced(label('With recursion', ['super-left-assignment', 'lexicographic-scope']), shell, `calls <- 0
x <- function() {
  calls <<- calls + 1
  x()
}
x()`, ['6@x'], 'x <- function() x()\nx()');
			assertSliced(label('Counting fibonacci', ['super-left-assignment', 'lexicographic-scope']), shell, `calls <- 0
fib <- function() {
  calls <<- calls + 1
  if(n <= 1) {
    n
  } else {
    fib(n - 1) + fib(n - 2)
  }
}
fib(42)`, ['10@fib'], 'fib <- function() if(n <= 1) { n } else\n' +
				'    { fib(n - 1) + fib(n - 2) }\nfib(42)');
		});
		describe('Inverted Caller', () => {
			assertSliced(label('Call from Higher', ['function-calls', 'lexicographic-scope']),
				shell, 'create <- function() function() 3\ng <- create()\nc <- g()', ['3@c'], 'create <- function() function() 3\ng <- create()\nc <- g()');
			assertSliced(label('Call from Lower', ['function-calls', 'lexicographic-scope']),
				shell, 'g <- function() 3\ncreate <- function() function() g()\nc <- create()()', ['3@c'], 'g <- function() 3\ncreate <- function() function() g()\nc <- create()()');
			assertSliced(label('Higher Base', ['function-calls', 'lexicographic-scope']),
				shell, `
x <- function() b()
c <- (function() {
a <- function() b() + x()
b <<- function() 2
g <- function() f() + 1
h <- function() g() * 2
f <- function() a()
h()})()`.trim(), ['2@c'], `
x <- function() b()
c <- (function() {
        a <- function() b() + x()
        b <<- function() 2
        g <- function() f() + 1
        h <- function() g() * 2
        f <- function() a()
        h()
    })()
`.trim());
		});
		/* adapted from a complex pipe in practice */
		describe('Nested Pipes', () => {
			const caps: SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'double-bracket-access', 'numbers', 'infix-calls', 'binary-operator', 'call-normal', 'newlines', 'unnamed-arguments', 'precedence', 'special-operator', 'strings', ...OperatorDatabase['=='].capabilities];
			const code = `x <- fun %>%
				filter(X == "green") %>%
				dplyr::select(X, Y) %>%
				mutate(Z = 5) %>%
				distinct() %>%
				group_by(X) %>%
				# i am commento!
				summarize(Y = mean(Y)) %>%
				left_join(., ., by = "X") %>%
				ungroup() %>%
				mutate(Y = Y + 1) %>%
				filter(Y > 5)`;
			assertSliced(label('Require complete pipe', caps),
				shell, code, ['1@x'], 'x <- fun %>% filter(X == "green") %>% dplyr::select(X, Y) %>% mutate(Z = 5) %>% distinct() %>% group_by(X) %>% summarize(Y = mean(Y)) %>% left_join(., ., by = "X") %>% ungroup() %>% mutate(Y = Y + 1) %>% filter(Y > 5)');
			/* a name in a data mask is a column of the data handed to the verb, so the data is part of its slice */
			assertSliced(label('Slice for variable in filter', caps),
				shell, code, ['2@X'], 'fun %>% X');
			assertSliced(label('Slice for variable in last filter', caps),
				shell, code, ['12@Y'], 'fun %>% filter(X == "green") %>% dplyr::select(X, Y) %>% mutate(Z = 5) %>% distinct() %>% group_by(X) %>% summarize(Y = mean(Y)) %>% left_join(., ., by = "X") %>% ungroup() %>% mutate(Y = Y + 1) %>% Y');
		});
		describe('Functions in Unknown Call Contexts', () => {
			const capabilities: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities,
				'numbers', 'unnamed-arguments', 'newlines', 'call-normal', 'resolve-arguments', 'named-arguments', 'implicit-return', 'grouping', 'formals-named'
			];
			assertSliced(label('call in unknown foo', capabilities), shell,
				`
f <- function(y) { y + 3 }
foo(.x = f(3))
`, ['3@foo'], `f <- function(y) y + 3
foo(.x = f(3))`);
			assertSliced(label('definition in unknown foo', capabilities), shell,
				'x <- 2;\nfoo(.x = function(y) { y + 3 })', ['2@foo'],
				'foo(.x = function(y) { y + 3 })');
			assertSliced(label('nested definition in unknown foo', capabilities), shell,
				'x <- function() { 3 }\nfoo(.x = function(y) { c(X = x()) })', ['2@foo'],
				'x <- function() 3\nfoo(.x = function(y) { c(X = x()) })');
			assertSliced(label('nested definition in unknown foo with reference', capabilities), shell,
				'x <- function() { 3 }\ng = function(y) { c(X = x()) }\nfoo(.x = g)', ['3@foo'],
				'x <- function() 3\ng = function(y) c(X = x())\nfoo(.x = g)');
		});
		describe('Anonymous Function Recovery on Parameter', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'grouping',
				'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition', 'unnamed-arguments',
				'formals-named'
			];
			assertSliced(label('Simple Anonymous Function', caps), shell,
				'function(x, y=3) {\n    x\n   x + y\n   }', ['2@x'],
				'function(x, y=3) x');
			assertSliced(label('Simple Anonymous Function (both)', caps), shell,
				'function(x, y=3) {\n    x\n   z <- x + y\n   }', ['3@z'],
				'function(x, y=3) z <- x + y');
		});
		describe('Grouped Default Values', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping',
				'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition',
				'unnamed-arguments', 'formals-named', 'call-normal'
			];
			const plusCaps: SupportedFlowrCapabilityId[] = [...caps, ...OperatorDatabase['+'].capabilities];
			assertSliced(label('Parenthesized default', caps), shell,
				'f <- function(a, b = (1)) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b=(1)) b\nv <- f(3)\nv', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
			assertSliced(label('Braced default', caps), shell,
				'f <- function(a, b = { 1 }) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b={1}) b\nv <- f(3)\nv', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
			assertSliced(label('Nested parenthesized default', caps), shell,
				'f <- function(a, b = ((1))) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b=((1))) b\nv <- f(3)\nv', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
			assertSliced(label('Parenthesized compound default', plusCaps), shell,
				'f <- function(a, b = (a + 1)) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b=(a + 1)) b\nv <- f(3)\nv', { expectedOutput: '[1] 4', expectedSliceOutput: '[1] 4' });
			assertSliced(label('Braced multi-expression default', plusCaps), shell,
				'f <- function(a, b = { x <- 2; x + 1 }) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b={x <- 2; x + 1}) b\nv <- f(3)\nv', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
			/* controls: ungrouped defaults must stay untouched */
			assertSliced(label('Constant default', caps), shell,
				'f <- function(a, b = 1) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b=1) b\nv <- f(3)\nv', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
			assertSliced(label('Symbol default', caps), shell,
				'f <- function(a, b = a) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b=a) b\nv <- f(3)\nv', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
			assertSliced(label('Call default', caps), shell,
				'f <- function(a, b = length(a)) { b }\nv <- f(3)\nv', ['3@v'],
				'f <- function(a, b=length(a)) b\nv <- f(3)\nv', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		});
		describe('Grouped Conditions and Vectors', () => {
			const caps: SupportedFlowrCapabilityId[] = [
				'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping', 'numbers', 'newlines'
			];
			assertSliced(label('Parenthesized if condition', [...caps, 'if', 'logical']), shell,
				'a <- TRUE\nif((a)) { v <- 1 } else { v <- 2 }\nv', ['3@v'],
				'a <- TRUE\nif((a)) { v <- 1 } else\n{ v <- 2 }\nv', { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
			assertSliced(label('Parenthesized while condition', [...caps, 'while-loop', ...OperatorDatabase['<'].capabilities, ...OperatorDatabase['+'].capabilities]), shell,
				'i <- 0\nwhile((i < 2)) { i <- i + 1 }\nv <- i\nv', ['4@v'],
				'i <- 0\nwhile((i < 2)) i <- i + 1\nv <- i\nv', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
			assertSliced(label('Parenthesized for vector', [...caps, 'for-loop', ...OperatorDatabase[':'].capabilities, ...OperatorDatabase['+'].capabilities]), shell,
				's <- 0\nfor(i in (1:3)) { s <- s + i }\nv <- s\nv', ['4@v'],
				's <- 0\nfor(i in (1:3)) s <- s + i\nv <- s\nv', { expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
			assertSliced(label('Braced for vector', [...caps, 'for-loop', ...OperatorDatabase[':'].capabilities, ...OperatorDatabase['+'].capabilities]), shell,
				's <- 0\nfor(i in { 1:3 }) { s <- s + i }\nv <- s\nv', ['4@v'],
				's <- 0\nfor(i in {1:3}) s <- s + i\nv <- s\nv', { expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
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
			assertSliced(label('Single occurrence', [...caps, 'single-bracket-access', 'functions-with-global-side-effects']), shell,
				'load("x")\nm[,ii:=sample(yy),]\nprint(m)', ['3@print'],
				'load("x")\nm[,ii:=sample(yy),]\nprint(m)');
			assertSliced(label('Work with double brackets too', [...caps, 'double-bracket-access', 'functions-with-global-side-effects']), shell,
				'load("x")\nm[[ii:=sample(yy)]]\nprint(m)', ['3@print'],
				'load("x")\nm[[ii:=sample(yy)]]\nprint(m)');
			assertSliced(label('Multiple occurrences', [...caps, 'single-bracket-access', 'access-with-argument-names', 'functions-with-global-side-effects', 'logical']), shell,
				'load("x")\nm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nprint(m)', ['4@print'],
				'load("x")\nm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nprint(m)');
			assertSliced(label('Overwrites should still apply', [...caps, ...OperatorDatabase['<-'].capabilities, 'single-bracket-access', 'access-with-argument-names', 'numbers']), shell,
				'm[,ii:=sample(yy),]\nm[,k:=sample(gg),what=TRUE]\nm <- 5\nprint(m)', ['4@print'],
				'm <- 5\nprint(m)');
		});
		describe('if-then-else format', () => {
			const caps: SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'if', 'logical', 'binary-operator', 'infix-calls', 'call-normal', 'newlines', 'unnamed-arguments', 'precedence'];
			const code = `x <- 3
{
if (x == 3)
{ x <- 4 
y <- 2 }
else { x <- y <- 3 }
}
print(x)
			`;
			assertSliced(label('Slice for initial x should return noting else', caps),
				shell, code, ['1@x'], 'x <- 3', {
					expectedOutput: '[1] 4'
				});
			assertSliced(label('Slice for first condition', caps),
				shell, code, ['3@x'], 'x <- 3\nx');
			assertSliced(label('Slice for last x', caps),
				shell, code, ['8@x'], `x <- 3
if(x == 3) { 
        x <- 4
        y <- 2
    } else 
{ x <- y <- 3 }
x`);
		});
		describe('Apply Functions', () => {
			describe('Lapply Forcing the Map Function Body', () => {
				assertSliced(label('Forcing Second Argument', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return'
				]), shell,
				'res <- lapply(1:3, function(x) x + 1)', ['1@res'],
				'res <- lapply(1:3, function(x) x + 1)'
				);
				assertSliced(label('Forcing Second Argument with closure', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				'y <- 2\nres <- lapply(1:3, function(x) x + y)', ['2@res'],
				'y <- 2\nres <- lapply(1:3, function(x) x + y)'
				);
				assertSliced(label('Forcing Second Argument with closure colliding with built-in name', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				'data <- 2\nres <- lapply(1:3, function(x) x + data)', ['2@res'],
				'data <- 2\nres <- lapply(1:3, function(x) x + data)'
				);
				assertSliced(label('Forcing Second Argument with closure colliding with built-in name access', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				'data <- c()\nres <- lapply(1:3, function(x) x + data[x])', ['2@res'],
				'data <- c()\nres <- lapply(1:3, function(x) x + data[x])'
				);
				assertSliced(label('Forcing Second Argument Nested with closure colliding with built-in name access', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				'data <- c()\nres <- do.call(rbind, lapply(1:2, function(y) { lapply(1:3, function(x) x + data[x]) }))', ['2@res'],
				'data <- c()\nres <- do.call(rbind, lapply(1:2, function(y) { lapply(1:3, function(x) x + data[x]) }))'
				);
				assertSliced(label('Force-Including Call Reference', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				'foo <- bar()\nres <- lapply(1:3, function(x) foo * 2)', ['2@res'],
				'foo <- bar()\nres <- lapply(1:3, function(x) foo * 2)'
				);
			});
			describe('With FUN.VALUE', () => {
				assertSliced(label('Force-Including Call Reference', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				`themed <- vapply(defaults, FUN.VALUE = logical(1), function(x) {
    is_quosure(x) && quo_is_call(x, name = "from_theme")
  })`, ['1@themed'],
				`themed <- vapply(defaults, FUN.VALUE = logical(1), function(x) {
    is_quosure(x) && quo_is_call(x, name = "from_theme")
  })`
				);
			});
			describe('nested ddply', () => {
				assertSliced(label('Force-Including Call Reference', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return', 'closures'
				]), shell,
				`foo <- function(k) { 
					g <- function(x) { x + 1 }
					K <- ddply(k, k, .fun=function(xx,yy) { c(N=g(xx)) })
					return(K) 
				 }
				 foo(1:3)`, ['6@foo'],
				`foo <- function(k) {
        g <- function(x) x + 1
        K <- ddply(k, k, .fun=function(xx,yy) { c(N=g(xx)) })
        return(K)
    }
foo(1:3)`
				);
			});
			describe('interference', () => {
				assertSliced(label('interference function', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'call-normal', 'implicit-return'
				]), shell,
				'foo <- function(x) x\ninterference(formula = a | b | c, propensity_integrand="foo")', ['2@interference'],
				'foo <- function(x) x\ninterference(formula = a | b | c, propensity_integrand="foo")'
				);
			});
			describe('Mapply Forcing the Map Function Body in the first arg', () => {
				assertSliced(label('Forcing First Argument', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return'
				]), shell,
				'res <- mapply(function(x) x + 1, 1:3)', ['1@res'],
				'res <- mapply(function(x) x + 1, 1:3)'
				);
				assertSliced(label('Force-Including Reference', [
					'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'implicit-return'
				]), shell,
				'foo <- bar()\nres <- mapply(function(x) foo * 2, 1:3)', ['2@res'],
				'foo <- bar()\nres <- mapply(function(x) foo * 2, 1:3)'
				);
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
			const code = `x <- 20 : 30
res <- 0
for(i in 1:10) {
    x.y.data <- x[x > 25 + i]
    for(j in x.y.data) res <- res + 1
}
print(res)`;
			assertSliced(label('Loop Re-Iterate', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return']),
				shell, code, ['7@print'], code);
		});
		describe('Nested dataframe assignments', () => {
			const code = `df <- foo()
df$a[x > 3] <- 5
print(df)`;
			assertSliced(label('Simple reassignment', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'normal-definition', 'newlines', 'unnamed-arguments', 'call-normal', 'infix-calls', 'double-bracket-access', 'binary-operator', 'return', 'implicit-return']),
				shell, code, ['3@print'], code);
		});
	});
	describe('Closures', () => {
		assertSliced(label('closure w/ default arguments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'newlines', 'implicit-return', 'normal-definition', 'closures', 'unnamed-arguments']),
			shell, `f <- function(x = 1) {
  function() x
}
g <- f(2)
print(g())`, ['5@g'], `f <- function(x=1) function() x
g <- f(2)
g()`);
		assertSliced(label('nested closures w/ default arguments', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'formals-default', 'numbers', 'newlines', 'lambda-syntax', 'implicit-return', ...OperatorDatabase['+'].capabilities, 'closures', 'grouping']),
			shell, `f <- function(x = 1) {
  (\\(y = 2) function(z = 3) x + y + z)()
}
g <- f(8)
print(g())`, ['5@g'], `f <- function(x=1) (\\(y=2) function(z=3) x + y + z)()
g <- f(8)
g()`, { minRVersion: MIN_VERSION_LAMBDA });
		assertSliced(label('closure w/ side effects', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'normal-definition', 'newlines', 'closures', ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call', ...OperatorDatabase['+'].capabilities, 'numbers']),
			shell, `f <- function() {
  function() {
    x <<- x + 1
    x
  }
}
x <- 2
f()()
print(x)`, ['9@x'], `f <- function() function() x <<- x + 1
x <- 2
f()()
x`);
	});
	describe('Calls with potential side effects', () => {
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
		assertSliced(label('Points Should Link to Plot', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
			'plot(f)\npoints(g)', ['2@points'],
			'plot(f)\npoints(g)'
		);
		assertSliced(label('Custom plot should have no links', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
			'plot <- function() {}\nplot(f)\npoints(g)', ['3@points'],
			'points(g)'
		);
		describe('maps::map', () => {
			assertSliced(label('Link to the last map', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map(f)\nx <- points(g)', ['2@points'],
				'map(f)\npoints(g)'
			);
			assertSliced(label('Link to the last map (print)', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map(f)\nx <- points(g)\nprint(x)', ['3@print'],
				'map(f)\nx <- points(g)\nprint(x)'
			);
			assertSliced(label('Link to the last map (with par)', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'par(mar=c(1,1,1,1))\nmap(f)\nx <- points(g)', ['3@x'],
				'par(mar=c(1,1,1,1))\nmap(f)\nx <- points(g)'
			);
			assertSliced(label('Link to the last map (multiple map)', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map("x")\nmap("y")\nx <- points(g)', ['3@x'],
				'map("y")\nx <- points(g)'
			);
			assertSliced(label('Link to the last map (map with foo)', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map("a", foo=c(-1))\npoints(x)', ['2@points'],
				'map("a", foo=c(-1))\npoints(x)'
			);
			assertSliced(label('An added map should be included', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map("a", add=TRUE)\npoints(x)', ['2@points'],
				'map("a", add=TRUE)\npoints(x)'
			);
			assertSliced(label('A not-added map should be kept', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map("a", add=FALSE)\npoints(x)', ['2@points'],
				'map("a", add=FALSE)\npoints(x)'
			);
			assertSliced(label('Map-Add should cascade', ['functions-with-global-side-effects', 'redefinition-of-built-in-functions-primitives']), shell,
				'map("a", add=FALSE)\nmap("b", add=TRUE)\npoints(x)', ['3@points'],
				'map("a", add=FALSE)\nmap("b", add=TRUE)\npoints(x)'
			);
		});
		describe('unknown assigns', () => {
			assertSliced(label('Same assign target', ['functions-with-global-side-effects', 'name-normal', 'call-normal']),
				shell, 'assign("x", 3)\nprint(x)', ['2@x'], 'assign("x", 3)\nx');
			assertSliced(label('Different assign target', ['functions-with-global-side-effects', 'name-normal', 'call-normal']),
				shell, 'assign("y", 3)\nprint(x)', ['2@x'], 'x');
			assertSliced(label('Variable assign target (different)', ['functions-with-global-side-effects', 'name-normal', 'call-normal']),
				shell, 'assign(y, 3)\nprint(x)', ['2@x'], 'assign(y, 3)\nx'); /* as we do not know the target of `y`, we mark as unknown */
			assertSliced(label('Variable assign target (same)', ['functions-with-global-side-effects', 'name-normal', 'call-normal']),
				shell, 'assign(x, 3)\nprint(x)', ['2@x'], 'assign(x, 3)\nx'); /* as we do not know the target of `x`, we mark as unknown */

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
bar <- foo(l=x, c=y)`, ['8@bar'], `foo <- function(l, c) {
        tmp <- list()
        for(i in 1:length(l)) tmp[[i]] <- l[[i]] %in% c[[i]]
        return(tmp)
    }
bar <- foo(l=x, c=y)`);
	});
	describe('Include Callees', () => {
		const capabilities: SupportedFlowrCapabilityId[] = [
			'function-definitions', 'formals-named', 'name-normal', 'numbers', 'call-normal', 'newlines',
			'unnamed-arguments', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['*'].capabilities
		];
		const code = `f <- function(x) {
  y <- x * 2
  print(y)
}
f(21)`;
		assertSliced(label('default stops at the function-definition boundary', capabilities),
			shell, code, ['3@print'], `function(x) {
    y <- x * 2
    print(y)
}`
		);
		assertSliced(label('includeCallees continues past the boundary', capabilities),
			shell, code, ['3@print'], `f <- function(x) {
        y <- x * 2
        print(y)
    }
f(21)`, { includeCallees: true }
		);
		const codeMultipleCallSites = `f <- function(x) {
  y <- x * 2
  print(y)
}
f(21)
f(99)`;
		assertSliced(label('includeCallees includes all call sites', capabilities),
			shell, codeMultipleCallSites, ['3@print'], `f <- function(x) {
        y <- x * 2
        print(y)
    }
f(21)
f(99)`, { includeCallees: true }
		);
		const codeWithUnrelatedStatement = `g <- 3
f <- function(x) {
  y <- x * 2
  print(y)
}
f(21)`;
		assertSliced(label('includeCallees does not pull in unrelated code', capabilities),
			shell, codeWithUnrelatedStatement, ['4@print'], `f <- function(x) {
        y <- x * 2
        print(y)
    }
f(21)`, { includeCallees: true }
		);
		// gate: a self-contained body (no parameter, no captured variable) must not pull in the callers
		const codeSelfContained = `f <- function(x) {
  y <- 5
  print(y)
}
f(21)`;
		assertSliced(label('includeCallees is a no-op when the body does not depend on the interface', capabilities),
			shell, codeSelfContained, ['3@print'], 'y <- 5\nprint(y)', { includeCallees: true }
		);
		assertSliced(label('self-contained body slices identically without the flag', capabilities),
			shell, codeSelfContained, ['3@print'], 'y <- 5\nprint(y)'
		);
		// gate: a captured variable from the enclosing scope does let the callers (and the capture) in
		const codeCapture = `z <- 10
f <- function(x) {
  y <- z
  print(y)
}
f(21)`;
		assertSliced(label('includeCallees follows a captured enclosing-scope variable', capabilities),
			shell, codeCapture, ['4@print'], `z <- 10
f <- function(x) {
        y <- z
        print(y)
    }
f(21)`, { includeCallees: true }
		);
	});
	describe('Super-assignment binds lexically', () => {
		const superCaps: readonly SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['<<-'].capabilities, 'normal-definition', 'implicit-return', 'closures', 'lexicographic-scope', 'side-effects-in-function-call', 'numbers', 'newlines', 'semicolons', 'call-normal', 'unnamed-arguments'];
		/* `<<-` searches the enclosing frames first, so this writes f's `x`, not the global one */
		assertSliced(label('the enclosing function frame wins over the global one', superCaps), shell,
			`f <- function() { x <- 2; h <- function() x <<- 9; h(); x }
v <- f()
v`, ['3@v'], `f <- function() {
        x <- 2
        h <- function() x <<- 9
        h()
        x
    }
v <- f()
v`, { expectedOutput: '[1] 9', expectedSliceOutput: '[1] 9' });
		/* the write lands on f's `x`, so the global one is never touched and the call is irrelevant */
		assertSliced(label('a write caught by an enclosing frame leaves the global one alone', superCaps), shell,
			`x <- 1
f <- function() { x <- 2; h <- function() x <<- 9; h() }
f()
v <- x
v`, ['5@v'], `x <- 1
v <- x
v`, { expectedOutput: '[1] 1', expectedSliceOutput: '[1] 1' });
		/* control: a closure counter writes the frame it captured, so every call depends on the one before */
		assertSliced(label('a closure counter still chains its calls', superCaps), shell,
			`mk <- function() { n <- 0; function() { n <<- n + 1; n } }
c1 <- mk()
c1()
v <- c1()
v`, ['5@v'], `mk <- function() {
        n <- 0
        function() {
            n <<- n + 1
            n
        }
    }
c1 <- mk()
c1()
v <- c1()
v`, { expectedOutput: '[1] 1\n[1] 2', expectedSliceOutput: '[1] 1\n[1] 2' });
		/* control: with no enclosing frame holding the name, the global one is still the target */
		assertSliced(label('a super-assignment no enclosing frame catches still reaches the global one', superCaps), shell,
			`x <- 1
f <- function() { g <- function() x <<- 42; g(); x }
v <- f()
v`, ['4@v'], `x <- 1
f <- function() {
        g <- function() x <<- 42
        g()
        x
    }
v <- f()
v`, { expectedOutput: '[1] 42', expectedSliceOutput: '[1] 42' });
	});
	describe('User-defined replacement functions', () => {
		const replCaps: readonly SupportedFlowrCapabilityId[] = ['name-quoted', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities, 'replacement-functions', 'normal-definition', 'formals-named', 'implicit-return', 'numbers', 'newlines', 'call-normal', 'unnamed-arguments'];
		/* a replacement function rebinds its target whether or not flowR ships a built-in for it */
		assertSliced(label('a user-defined replacement rebinds its target', replCaps), shell,
			'`s<-` <- function(x, value) x + value\ny <- 1\ns(y) <- 5\nv <- y\nv', ['5@v'],
			'`s<-` <- function(x, value) x + value\ny <- 1\ns(y) <- 5\nv <- y\nv',
			{ expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
		/* the same holds when the user redefines a replacement we do know */
		assertSliced(label('a user redefinition of a known replacement rebinds its target', replCaps), shell,
			'`levels<-` <- function(x, value) x + value\ny <- 1\nlevels(y) <- 5\nv <- y\nv', ['5@v'],
			'`levels<-` <- function(x, value) x + value\ny <- 1\nlevels(y) <- 5\nv <- y\nv',
			{ expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
		/* the super-assigning form binds outside the frame it is called in */
		assertSliced(label('a super-assigning user replacement binds outside the frame', [...replCaps, ...OperatorDatabase['<<-'].capabilities, 'side-effects-in-function-call']), shell,
			'`s<-` <- function(x, value) x + value\ny <- 1\nf <- function() { s(y) <<- 5 }\nf()\nv <- y\nv', ['6@v'],
			'`s<-` <- function(x, value) x + value\ny <- 1\nf <- function() s(y) <<- 5\nf()\nv <- y\nv',
			{ expectedOutput: '[1] 6', expectedSliceOutput: '[1] 6' });
		/* control: a built-in replacement is unaffected */
		assertSliced(label('a built-in replacement is unchanged', [...replCaps, 'built-in-sequencing', 'single-bracket-access', 'strings']), shell,
			'x <- c(1, 2)\nnames(x) <- c("a", "b")\nv <- names(x)[1]\nv', ['4@v'],
			'x <- c(1, 2)\nnames(x) <- c("a", "b")\nv <- names(x)[1]\nv',
			{ expectedOutput: '[1] "a"', expectedSliceOutput: '[1] "a"' });
	});
}));
