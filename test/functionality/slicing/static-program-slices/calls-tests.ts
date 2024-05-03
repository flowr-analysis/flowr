import { assertSliced, withShell } from '../../_helper/shell'
import { label } from '../../_helper/label'
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data'

describe('Calls', withShell(shell => {
	describe('Simple Calls', () => {
		const code = `i <- 4
a <- function(x) { x }
a(i)`
		for(const criterion of ['3:1', '3@a'] as const) {
			assertSliced(label(JSON.stringify(code), ['function-definitions', 'formals-named', 'name-normal', 'call-normal', 'local-left-assignment', 'unnamed-arguments']),
				shell, code, [criterion], code
			)
		}
		const constCapabilities: SupportedFlowrCapabilityId[] = ['function-definitions', 'formals-named', 'name-normal', 'numbers', 'call-normal', 'local-left-assignment', 'unnamed-arguments', 'implicit-return']
		const constFunction = `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`
		/* actually, `i` does not have to be defined, as it is _not used_ by the function, so we do not have to include `i <- 4` */
		assertSliced(label('Function call with constant function', constCapabilities),
			shell, constFunction, ['3:1'], `a <- function(x) { 1 }
a(i)`)
		/* nothing of the function-content is required */
		assertSliced(label('Slice function definition', constCapabilities),
			shell, constFunction, ['2@a'], 'a <- function(x) { }')
		assertSliced(label('Slice within function', constCapabilities), shell, constFunction, ['2:20'], 'x <- 2')
		assertSliced(label('Multiple unknown calls', ['name-normal', 'unnamed-arguments', 'numbers', 'call-normal', 'newlines']),
			shell, `
foo(x, y)
foo(x, 3)
    `, ['3@foo'], 'foo(x, 3)')
		assertSliced(label('Multiple unknown calls sharing known def', ['name-normal', 'formals-named', 'unnamed-arguments', 'implicit-return', 'numbers', 'call-normal', 'newlines']),
			shell, `
x. <- function (x) { x }
foo(x, x.(y))
foo(x, x.(3))
    `, ['4@foo'], `x. <- function(x) { x }
foo(x, x.(3))`)
		assertSliced(label('Using ...', ['name-normal', 'unnamed-arguments', 'formals-dot-dot-dot', 'formals-named', 'implicit-return', 'call-normal', 'local-left-assignment', 'newlines', 'numbers']),
			shell, `
f1 <- function (a,b) { c }
f2 <- function (...) { f1(...) }
x <- 3
c <- 4
y <- 3
f2(1,x)
    `, ['7@f2'], `f1 <- function(a, b) { c }
f2 <- function(...) { f1(...) }
x <- 3
c <- 4
f2(1,x)`)
	})
	describe('Functions using environment', () => {
		describe('Read variable defined before', () => {
			const code = `i <- 4
a <- function(x) { x + i }
a(4)`
			for(const criterion of ['3:1', '3@a'] as const) {
				assertSliced(label('Must include read', ['name-normal', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', 'local-left-assignment', 'newlines', 'binary-operator', 'infix-calls', 'numbers']),
					shell, code, [criterion], code)
			}
		})
		describe('Read variable defined after', () => {
			const code = `a <- function(x) { x + i }
i <- 4
a(5)`
			for(const criterion of ['3:1', '3@a'] as const) {
				assertSliced(label('Must include read', ['name-normal', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', 'local-left-assignment', 'newlines', 'binary-operator', 'infix-calls', 'numbers']),
					shell, code, [criterion], code)
			}
		})
		describe('Read variable defined before and after', () => {
			const code = `i <- 3
a <- function(x) { x + i }
i <- 4
a(5)`
			for(const criterion of ['4:1', '4@a'] as const) {
				assertSliced(label('Only keep second definition', ['name-normal', 'unnamed-arguments', 'formals-named', 'implicit-return', 'call-normal', 'local-left-assignment', 'newlines', 'binary-operator', 'infix-calls', 'numbers']), shell, code, [criterion], `a <- function(x) { x + i }
i <- 4
a(5)`)
			}
		})
	})
	describe('Functions with multiple definitions', () => {
		const code = `a <- b <- function() { x }
x <- 2
a()
b()`
		assertSliced(label('Include only b-definition', ['name-normal', 'normal-definition', 'implicit-return', 'call-normal', 'local-left-assignment', 'newlines', 'binary-operator', 'infix-calls', 'numbers', 'return-value-of-assignments']),
			shell, code, ['3@a'], `a <- b <- function() { x }
x <- 2
a()`)
		assertSliced(label('Include only b-definition', ['name-normal', 'normal-definition', 'implicit-return', 'call-normal', 'local-left-assignment', 'newlines', 'binary-operator', 'infix-calls', 'numbers']),
			shell, code, ['4@b'], `b <- function() { x }
x <- 2
b()`)
	})
	describe('Functions with named arguments', () => {
		const code = `a <- function(x=4) { x }
a(x = 3)`
		assertSliced(label('Must include function definition', ['name-normal', 'local-left-assignment', 'formals-default', 'implicit-return', 'newlines', 'named-arguments', 'numbers']),
			shell, code, ['2@a'], code)

		assertSliced(label('Must work for same named arguments too', ['name-normal', 'local-left-assignment', 'numbers', 'named-arguments', 'newlines']),
			shell, 'a <- 3\nb <- foo(a=a)', ['2@b'], 'a <- 3\nb <- foo(a=a)')

		assertSliced(label('Must work for same named arguments nested', ['name-normal', 'local-left-assignment', 'formals-default', 'named-arguments', 'accessing-exported-names', 'implicit-return', 'newlines', 'strings']), shell, `
f <- function(some_variable="hello") {
  result <- some::other(some_variable=some_variable)
  result
}
    `, ['4@result'], `function(some_variable="hello") {
    result <- some::other(some_variable=some_variable)
    result
}`)


		const lateCode = `f <- function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }
f()
`
		assertSliced(label('Late bindings of parameter in body', ['name-normal', 'local-left-assignment', 'formals-default', 'numbers', 'implicit-return', 'binary-operator', 'infix-calls', 'call-normal', 'semicolons']),
			shell, lateCode, ['2@f'], `f <- function(a=b, m=3) {
        b <- 1
        a + 1
    }
f()`)
		const lateCodeB = `f <- function(a=b, b=3) { b <- 1; a; b <- 5; a + 1 }
f()
`
		assertSliced(label('Late bindings of parameter in parameters', ['name-normal', 'local-left-assignment', 'formals-default', 'newlines','binary-operator', 'infix-calls', 'numbers', 'call-normal', 'semicolons']),
			shell, lateCodeB, ['2@f'], `f <- function(a=b, b=3) { a + 1 }
f()`)
		assertSliced(label('Parameters binding context', ['name-normal', 'local-left-assignment', 'formals-default', 'implicit-return', 'newlines', 'numbers', 'call-normal']),
			shell, `f <- function(a=y) { a }
a <- 5
y <- 3
y <- 4
f()`, ['5@f'], `f <- function(a=y) { a }
y <- 4
f()`)

		assertSliced(label('Named argument collides with variable', ['name-normal', 'local-left-assignment', 'numbers', 'unnamed-arguments', 'named-arguments', 'newlines']), shell, 'x <- 100\nlist(123, x = 200, 234)\nprint(x)',
			['3@x'], 'x <- 100\nprint(x)')
	})
	describe('Functions with nested definitions', () => {
		describe('Simple Function pass with return', () => {
			const code = `a <- function() { a <- 2; return(function() { 1 }) }
b <- a()
b()`
			assertSliced(label('Must include outer function', ['name-normal', 'local-left-assignment', 'normal-definition', 'numbers', 'return', 'implicit-return', 'call-normal', 'newlines', 'semicolons']),
				shell, code, ['2@a'], `a <- function() { return(function() { 1 }) }
a()`)
			assertSliced(label('Must include linked function', ['name-normal', 'local-left-assignment', 'normal-definition', 'return', 'implicit-return', 'numbers', 'newlines', 'call-normal']),
				shell, code, ['3@b'], `a <- function() { return(function() { 1 }) }
b <- a()
b()`)
		})
		describe('Functions binding multiple scopes', () => {
			const code = `
a <- function() { x <- function() { z + y }; y <- 12; return(x) }
y <- 5
z <- 5
u <- a()
u()`
			assertSliced(label('Must include function shell', ['name-normal', 'local-left-assignment', 'normal-definition', 'implicit-return', 'numbers', 'binary-operator', 'infix-calls', 'return', 'newlines', 'call-normal', 'semicolons']),
				shell, code, ['5@a'], `a <- function() {
        x <- function() { }
        return(x)
    }
a()`)
			assertSliced(label('Must include function shell on call', ['name-normal', 'local-left-assignment', 'normal-definition', 'newlines', 'return', 'call-normal']), shell, code, ['6@u'], `a <- function() {
        x <- function() { z + y }
        y <- 12
        return(x)
    }
z <- 5
u <- a()
u()`)
		})
	})
	describe('Anonymous Functions', () => {
		assertSliced(label('keep anonymous', ['name-normal', 'local-left-assignment', 'normal-definition', 'binary-operator', 'infix-calls', 'implicit-return', 'call-anonymous', 'unnamed-arguments']),
			shell, `
x <- (function() {
  x <- 4
  x - 5
  3
 })()
cat(x)
    `, ['7@x'], `x <- (function() { 3 })()
cat(x)`)
	})
	describe('Higher-order Functions', () => {
		const code = `a <- function() { x <- 3; i }
i <- 4
b <- function(f) { i <- 5; f() }
b(a)`
		const caps: SupportedFlowrCapabilityId[] = ['name-normal', 'local-left-assignment', 'normal-definition', 'implicit-return', 'newlines', 'numbers', 'formals-named', 'call-normal', 'unnamed-arguments']
		assertSliced(label('Only i, not bound in context', caps), shell, code, ['1@i'], 'i')
		assertSliced(label('Slice of b is independent', caps), shell, code, ['3@b'], 'b <- function(f) { }')
		assertSliced(label('Slice of b-call uses function', caps), shell, code, ['4@b'], `a <- function() { i }
b <- function(f) {
        i <- 5
        f()
    }
b(a)`)
		assertSliced(label('Directly call returned function', ['name-normal', 'local-left-assignment', 'formals-named', 'normal-definition', 'implicit-return', 'return', 'unnamed-arguments', 'newlines', 'numbers', 'call-normal']),
			shell, `m <- 12
a <- function(x) {
  b <- function() { function() { x } }
  return(b())
}
res <- a(m)()`, ['6@res'], `m <- 12
a <- function(x) {
        b <- function() { function() { x } }
        return(b())
    }
res <- a(m)()`)
		assertSliced(label('Higher order anonymous function', ['name-normal', 'local-left-assignment', 'formals-named', 'implicit-return', 'normal-definition', 'call-anonymous', 'binary-operator', 'infix-calls', 'newlines']),
			shell, `a <- function(b) {
  b
}
x <- a(function() 2 + 3)() + a(function() 7)()`, ['4@x'], `a <- function(b) { b }
x <- a(function() 2 + 3)() + a(function() 7)()`)
	})
	describe('Side-Effects', () => {
		assertSliced(label('Important Side-Effect', ['name-normal', 'local-left-assignment', 'numbers', 'normal-definition', 'super-left-assignment', 'side-effects-in-function-call', 'implicit-return', 'call-normal', 'unnamed-arguments', 'newlines']), shell, `x <- 2
f <- function() { x <<- 3 }
f()
cat(x)
    `, ['4@x'], `f <- function() x <<- 3
f()
cat(x)`)

		assertSliced(label('Unimportant Side-Effect', ['name-normal', 'local-left-assignment', 'numbers', 'super-left-assignment', 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'call-normal', 'unnamed-arguments', 'newlines']), shell, `f <- function() { y <<- 3 }
f()
cat(x)
    `, ['3@x'], 'cat(x)')
		assertSliced(label('Nested Side-Effect For Last', ['name-normal', 'local-left-assignment', 'normal-definition', 'newlines', 'implicit-return', 'numbers', 'call-normal', 'side-effects-in-function-call']), shell, `f <- function() {
  a <- function() { x }
  x <- 3
  a()
  x <- 2
  a()
}
b <- f()
    `, ['8@b'], `f <- function() {
        a <- function() { x }
        x <- 2
        a()
    }
b <- f()`)
		// that it contains x <- 2 is an error in the current implementation as this happens due to the 'reads' edge from the closure linking
		// however, this read edge should not apply when the call happens within the same scope
		assertSliced(label('Nested Side-Effect For First', ['name-normal', 'local-left-assignment', 'normal-definition', 'implicit-return', 'numbers', 'call-normal', 'newlines', 'side-effects-in-function-call']), shell, `f <- function() {
  a <- function() { x }
  x <- 3
  b <- a()
  x <- 2
  a()
  b
}
b <- f()
    `, ['9@b'], `f <- function() {
        a <- function() { x }
        x <- 3
        b <- a()
        x <- 2
        b
    }
b <- f()`)
	})
	describe('Early return of function', () => {
		const code = `x <- (function() {
  g <- function() { y }
  y <- 5
  if(z) 
  	return(g)
  y <- 3
  g
})()
res <- x()`
		assertSliced(label('Double return points', ['name-normal', 'local-left-assignment', 'call-anonymous', 'normal-definition', 'implicit-return', 'numbers', 'if', 'return', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['9@res'], `
x <- (function() {
        g <- function() { y }
        y <- 5
        if(z) return(g)
        y <- 3
        g
    })()
res <- x()`.trim())
	})
	describe('Recursive functions', () => {
		const code = `f <- function() { f() }
f()`
		assertSliced(label('Endless recursion', ['name-normal', 'local-left-assignment', 'normal-definition', 'implicit-return', 'call-normal', 'newlines']), shell, code, ['2@f'], code)
	})
	describe('Uninteresting calls', () => {
		const code = `
a <- list(1,2,3,4)
a[3]
print(a[2])
    `
		assertSliced(label('Must include function shell', ['name-normal', 'local-left-assignment', 'unnamed-arguments', 'single-bracket-access', 'newlines']), shell, code, ['3@a'], `a <- list(1,2,3,4)
a`)
	})
	describe('Global vs. local definitions', () => {
		const localCode = `
a <- function() { x = x + 5; cat(x) }
x <- 3
a()
cat(x)`
		const localCaps: SupportedFlowrCapabilityId[] = ['name-normal', 'normal-definition', 'local-equal-assignment', 'binary-operator', 'infix-calls', 'semicolons', 'unnamed-arguments', 'newlines', 'call-normal', 'numbers']
		assertSliced(label('Local redefinition has no effect', localCaps), shell, localCode, ['5@x'], `x <- 3
cat(x)`)
		assertSliced(label('Local redefinition must be kept as part of call', localCaps), shell, localCode, ['4@a'], `a <- function() {
        x = x + 5
        cat(x)
    }
x <- 3
a()`)
		const globalCode = `
a <- function() { x <<- x + 5; cat(x) }
x <- 3
a()
cat(x)`
		assertSliced(label('But the global redefinition remains', ['name-normal', 'local-left-assignment', 'numbers', 'normal-definition', 'implicit-return', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'call-normal', 'unnamed-arguments']), shell, globalCode, ['5@x'], `a <- function() x <<- x + 5
x <- 3
a()
cat(x)`)
		const globalCodeWithoutLocal = `
a <- function() { x <<- 5; cat(x) }
x <- 3
a()
cat(x)`
		assertSliced(label('The local assignment is only needed if the global reads', ['name-normal', 'local-left-assignment', 'function-definitions', 'super-left-assignment', 'numbers', 'newlines', 'call-normal', 'unnamed-arguments']), shell, globalCodeWithoutLocal, ['5@x'], `a <- function() x <<- 5
a()
cat(x)`)

		assertSliced(label('Must work with nested globals', ['name-normal', 'local-left-assignment', 'normal-definition', 'formals-named', 'side-effects-in-function-call', 'return-value-of-assignments', 'newlines', 'numbers', 'call-normal', 'unnamed-arguments']),
			shell, `a <- function() { function(b) x <<- b }
y <- 5
x <- 2
a()(y)
cat(x)`, ['5@x'], `a <- function() { function(b) x <<- b }
y <- 5
a()(y)
cat(x)`)

		assertSliced(label('Must work with nested globals and known assignments not-happening', ['name-normal', 'local-left-assignment', 'normal-definition', 'formals-named', 'if', 'logical', 'super-left-assignment', 'return-value-of-assignments', 'implicit-return', 'newlines', 'call-normal', 'unnamed-arguments']),
			shell, `a <- function() { function(b) { if(FALSE) { x <<- b } } }
y <- 5
x <- 2
a()(y)
cat(x)`, ['5@x'], `x <- 2
cat(x)`)

		assertSliced(label('Must work with nested globals and maybe assignments', ['name-normal', 'local-left-assignment', 'normal-definition', 'formals-named', 'if', 'call-normal', 'binary-operator', 'infix-calls', 'numbers', 'super-left-assignment', 'return-value-of-assignments', 'newlines', 'unnamed-arguments']),
			shell, `a <- function() { function(b) { if(runif() > .5) { x <<- b } } }
y <- 5
x <- 2
a()(y)
cat(x)`, ['5@x'], `a <- function() { function(b) if(runif() > .5) { x <<- b } }
y <- 5
x <- 2
a()(y)
cat(x)`)
	})
	describe('Using strings for definitions', () => {
		const code = `
'a' <- function() { x <- 3; 4 }
'a'()
a()
a <- function() { x <- 3; 5 }
'a'()
a()
\`a\`()
    `
		const caps: SupportedFlowrCapabilityId[] = ['name-quoted', 'local-left-assignment', 'normal-definition', 'name-normal', 'numbers', 'semicolons', 'implicit-return', 'call-normal', 'newlines', 'name-escaped']
		assertSliced(label('Must link with string/string', caps), shell, code, ['3@\'a\''], `'a' <- function() { 4 }
'a'()`)
		assertSliced(label('Must link with string/no-string', caps), shell, code, ['4@a'], `'a' <- function() { 4 }
a()`)
		assertSliced(label('Must link with no-string/string', caps), shell, code, ['6@\'a\''], `a <- function() { 5 }
'a'()`)
		// the common case:
		assertSliced(label('Must link with no-string/no-string', caps), shell, code, ['7@a'], `a <- function() { 5 }
a()`)
		assertSliced(label('Try with special backticks', caps), shell, code, ['8@`a`'], `a <- function() { 5 }
\`a\`()`)
	})
	describe('Using own infix operators', () => {
		const code = `
\`%a%\` <- function(x, y) { x + y }
\`%a%\`(3, 4)

'%b%' <- function(x, y) { x * y }
'%b%'(3, 4)

cat(3 %a% 4)
cat(4 %b% 5)
      `
		const caps: SupportedFlowrCapabilityId[] = ['name-escaped', 'name-quoted', 'infix-calls', 'formals-named', 'implicit-return', 'newlines', 'unnamed-arguments', 'special-operator']
		assertSliced(label('Must link with backticks', caps), shell, code, ['8:7'], `\`%a%\` <- function(x, y) { x + y }
cat(3 %a% 4)`)
		assertSliced(label('Must link with backticks', caps), shell, code, ['9:7'], `'%b%' <- function(x, y) { x * y }
cat(4 %b% 5)`)
		assertSliced(label('Must work with assigned custom pipes too', ['name-normal', 'local-left-assignment', 'infix-calls', 'numbers', 'special-operator']),
			shell, 'a <- b %>% c %>% d', ['1@a'], 'a <- b %>% c %>% d')
	})
	describe('Using own alias infix operators', () => {
		const code = `
"%a%" <- function(x, y) { x + y }
"%a%" <- pkg::"%a%"
cat(4 %a% 5)
      `
		assertSliced(label('Must link alias but not namespace origin', ['name-quoted', 'local-left-assignment', 'formals-named', 'implicit-return', 'infix-calls', 'special-operator', 'accessing-exported-names', 'newlines', 'unnamed-arguments']),
			shell, code, ['4:1'], `"%a%" <- pkg::"%a%"
cat(4 %a% 5)`)
	})
	describe('Using own alias infix operators with namespace', () => {
		const code = `
pkg::"%a%" <- function(x, y) { x + y }
"%a%" <- pkg::"%a%"
cat(4 %a% 5)
      `
		assertSliced(label('Must link alias with namespace', ['accessing-exported-names', 'name-quoted', 'local-left-assignment', 'formals-named', 'implicit-return', 'binary-operator', 'infix-calls', 'special-operator', 'unnamed-arguments']),
			shell, code, ['4:1'], `pkg::"%a%" <- function(x, y) { x + y }
"%a%" <- pkg::"%a%"
cat(4 %a% 5)`)
	})
}))
