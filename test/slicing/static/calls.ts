import { assertSliced, withShell } from '../../helper/shell'

// TODO: test something like a <- function() { x };  x <- 3; y <- 2; a()

describe('With Call', withShell(shell => {
  describe('Previously defined call', () => {
    const code = `i <- 4
a <- function(x) { x }
a(i)`
    assertSliced(JSON.stringify(code), shell, code, ['3:1'], code)
    const constFunction = `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`
    // TODO: reconstruct must recurse into the function body and slice must trace function calls
    assertSliced('Function call with constant function', shell, constFunction, ['3:1'], `i <- 4
a <- function(x) { 1 }
a(i)`)
  })
}))
