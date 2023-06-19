import { assertSliced, withShell } from '../../helper/shell'

describe('With Call', withShell(shell => {
  describe('Previously defined call', () => {
    const code = `i <- 4
a <- function(x) { x }
a(i)`
    assertSliced(code, shell, code, [{ line: 3, column: 1 }], code)
    const constFunction = `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`
    // TODO: reconstruct must recurse into the function body and slice must trace function calls
    assertSliced('Function call with constant function', shell, constFunction, [{ line: 3, column: 1 }], `i <- 4
a <- function(x) { x <- 2; 1 }
a(i)`)
  })
}))
