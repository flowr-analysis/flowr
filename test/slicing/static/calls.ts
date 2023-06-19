import { assertSliced, withShell } from '../../helper/shell'

describe('With Call', withShell(shell => {
  describe('Previously defined call', () => {
    const code = `i <- 4
a <- function(x) { x }
a(i)`
    assertSliced(code, shell, code, [{ line: 3, column: 1 }], code)
  })
}))
