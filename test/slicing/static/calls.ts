import { assertSliced, withShell } from '../../helper/shell'

describe('With Call', withShell(shell => {
  describe('Simple', () => {
    const code = `i <- 4
a <- function(x) { x }
a(i)`
    for (const criterion of ['3:1', '3@a'] as const) {
      assertSliced(JSON.stringify(code), shell, code, [criterion], code)
    }
    const constFunction = `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`
    assertSliced('Function call with constant function', shell, constFunction, ['3:1'], `i <- 4
a <- function(x) { 1 }
a(i)`)
    // TODO: should we really keep that open? edge case?
    assertSliced('Slice function definition', shell, constFunction, ['2@a'], `a <- function(x) { }`)
    assertSliced('Slice within function', shell, constFunction, ['2:20'], `x <- 2`)
    assertSliced('Multiple unknown calls', shell, `
foo(x, y)
foo(x, 3)
    `, ['3@foo'], `foo(x, 3)`)
    assertSliced('Multiple unknown calls sharing known def', shell, `
x. <- function (x) { x } 
foo(x, x.(y))
foo(x, x.(3))
    `, ['4@foo'], `x. <- function(x) { x }
foo(x, x.(3))`)
    assertSliced('Using ...', shell, `
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
        assertSliced('Must include read', shell, code, [criterion], code)
      }
    })
    describe('Read variable defined after', () => {
      const code = `a <- function(x) { x + i }
i <- 4
a(5)`
      for(const criterion of ['3:1', '3@a'] as const) {
        assertSliced('Must include read', shell, code, [criterion], code)
      }
    })
    describe('Read variable defined before and after', () => {
      const code = `i <- 3
a <- function(x) { x + i }
i <- 4
a(5)`
      for(const criterion of ['4:1', '4@a'] as const) {
        assertSliced('Only keep second definition', shell, code, [criterion], `a <- function(x) { x + i }
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
    // TODO: at the moment we do not remove the second `b` in that case
    assertSliced('Include only b-definition', shell, code, ['3@a'], `a <- b <- function() { x }
x <- 2
a()`)
    assertSliced('Include only b-definition', shell, code, ['4@b'], `b <- function() { x }
x <- 2
b()`)
  })
  describe('Functions with named arguments', () => {
    const code = `a <- function(x=4) { x }
a(x = 3)`
    assertSliced('Must include function definition', shell, code, ['2@a'], code)

    const lateCode = `f <- function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }
f()
`
    assertSliced('Late bindings of parameter in body', shell, lateCode, ['2@f'], `f <- function(a=b, m=3) {
        b <- 1
        a + 1
    }
f()`)
    const lateCodeB = `f <- function(a=b, b=3) { b <- 1; a; b <- 5; a + 1 }
f()
`
    assertSliced('Late bindings of parameter in parameters', shell, lateCodeB, ['2@f'], `f <- function(a=b, b=3) { a + 1 }
f()`)
    assertSliced('Parameters binding context', shell, `f <- function(a=y) { a }
a <- 5
y <- 3
y <- 4
f()`, ['5@f'], `f <- function(a=y) { a }
y <- 4
f()`)
  })
  describe('Functions with nested definitions', () => {
    describe('Simple Function pass with return', () => {
      // TODO: limitation, does not work with <<- or anything which modifies the static resolutions at the moment
      const code = `a <- function() { a <- 2; return(function() { 1 }) }
b <- a()
b()`
      assertSliced('Must include outer function', shell, code, ['2@a'], `a <- function() { return(function() { 1 }) }
a()`)
      assertSliced('Must include linked function', shell, code, ['3@b'], `a <- function() { return(function() { 1 }) }
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
      assertSliced('Must include function shell', shell, code, ['5@a'], `a <- function() {
        x <- function() { }
        return(x)
    }
a()`)
      assertSliced('Must include function shell on call', shell, code, ['6@u'], `a <- function() {
        x <- function() { z + y }
        y <- 12
        return(x)
    }
z <- 5
u <- a()
u()`)
    })
  })
  describe('Higher-order functions', () => {
    const code = `a <- function() { x <- 3; i }
i <- 4
b <- function(f) { i <- 5; f() }
b(a)`
    assertSliced('Only i, not bound in context', shell, code, ['1@i'], `i`)
    assertSliced('Slice of b is independent', shell, code, ['3@b'], `b <- function(f) { }`)
    assertSliced('Slice of b-call uses function', shell, code, ['4@b'], `a <- function() { i }
b <- function(f) {
        i <- 5
        f()
    }
b(a)`)
    assertSliced('Directly call returned function', shell, `m <- 12
a <- function(x) {
  b <- function() { function() { x } }
  return(b())
}
a(m)()`, ['$23' /* we can't directly slice the second call as the "a" name would take the inner call */], `m <- 12
a <- function(x) {
        b <- function() { function() { x } }
        return(b())
    }
a(m)()`)
  })
  describe('Recursive functions', () => {
    const code = `f <- function() { f() }
f()`
    assertSliced('Endless recursion', shell, code, ['2@f'], code)
  })
  // TODO: we cant slice against objects within external files etc. problems e.g. in Code NAT MC.R of Zenodo 47
  describe('Uninteresting calls', () => {
    const code = `
a <- list(1,2,3,4)
a[3]
print(a[2])
    `
    assertSliced('Must include function shell', shell, code, ['3@a'], `a <- list(1,2,3,4)
a[3]`)
  })
}))
