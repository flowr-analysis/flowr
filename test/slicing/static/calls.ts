import { assertSliced, withShell } from '../../helper/shell'

// TODO: test something like a <- function() { x };  x <- 3; y <- 2; a()

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
}))
