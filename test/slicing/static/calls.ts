import { assertSliced, withShell } from '../../helper/shell'

// TODO: test something like a <- function() { x };  x <- 3; y <- 2; a()

describe('With Call', withShell(shell => {
  describe('Previously defined call', () => {
    const code = `i <- 4
a <- function(x) { x }
a(i)`
    for (const criterion of ['3:1', '3@a'] as const) {
      assertSliced(JSON.stringify(code), shell, code, [criterion], code)
    }
    const constFunction = `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`
    // TODO: reconstruct must recurse into the function body and slice must trace function calls
    assertSliced('Function call with constant function', shell, constFunction, ['3:1'], `i <- 4
a <- function(x) { 1 }
a(i)`)
  })
}))
