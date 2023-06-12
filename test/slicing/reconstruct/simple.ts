import { assertReconstructed, withShell } from '../../helper/shell'

describe('Simple', withShell(shell => {
  describe('Constant assignments', () => {
    for (const code of [
      'x <- 5',
      'x <- 5; y <- 9',
      '{ x <- 5 }',
      '{ x <- 5; y <- 9 }'
    ]) {
      assertReconstructed(code, shell, code, ['0'], 'x <- 5')
    }
  })
  describe('Nested Assignments', () => {
    for (const [code, id, expected] of [
      ['12 + (supi <- 42)', '0', '12 + (supi <- 42)' ],
      ['y <- x <- 42', '1', 'y <- x <- 42' ],
      ['for (i in 1:20) { x <- 5 }', '4', 'x <- 5' ],
      ['repeat x <- 5', '2', 'x <- 5' ],
      ['repeat { x <- 5 }', '2', 'x <- 5' ]
    ]) {
      assertReconstructed(code, shell, code, Array.isArray(id) ? id : [id], expected)
    }
  })

  describe('Loops', () => {
    const largeFor = `
      for (i in 1:20) { 
        y <- 9
        x <- 5
        12 -> x
      }
    `
    const pool: [string, string | string[], string][] = [
      [largeFor, '0', 'for(i in 1:20) {}' ],
      [largeFor, '4', 'y <- 9' ],
      // TODO: always brace option?
      [largeFor, ['0', '4'], 'for(i in 1:20) y <- 9' ],
      [largeFor, ['0', '4', '7'], `for(i in 1:20) {
    y <- 9
    x <- 5
}` ],
      [largeFor, ['0', '4', '10'], `for(i in 1:20) {
    y <- 9
    12 -> x
}` ],
    ]

    for (const [code, id, expected] of pool) {
      assertReconstructed(`${JSON.stringify(id)}: ${code}`, shell, code, Array.isArray(id) ? id : [id], expected)
    }
  })
}))
