import { assertReconstructed, withShell } from '../../helper/shell'

describe('Simple', withShell(shell => {
  describe('Constant assignments', () => {
    for (const code of [
      'x <- 5',
      'x <- 5; y <- 9',
      '{ x <- 5 }',
      '{ x <- 5; y <- 9 }'
    ]) {
      assertReconstructed(code, shell, code, '0', 'x <- 5')
    }
  })
  describe('Nested Assignments', () => {
    for (const [code, id, expected] of [
      ['12 + (supi <- 42)', '0', '12 + (supi <- 42)' ],
      ['y <- x <- 42', '1', 'y <- x <- 42' ],
      ['for (i in 1:20) { x <- 5 }', '4', 'x <- 5' ]
    ]) {
      assertReconstructed(code, shell, code, id, expected)
    }
  })

  describe('Loops', () => {
    describe('repeat', () => {
      const pool: [string, string | string[], string][] = [
        ['repeat { x }', '0', 'repeat x'],
        ['repeat { x <- 5; y <- 9 }', '0', 'repeat x <- 5'],
        ['repeat { x <- 5; y <- 9 }', ['0', '1', '4'], 'repeat {\n    x <- 5\n    y <- 9\n}']
      ]
      for (const [code, id, expected] of pool) {
        assertReconstructed(code, shell, code, id, expected)
      }
    })

    describe('while', () => {
      const pool: [string, string | string[], string][] = [
        ['while(TRUE) { x }', '1', 'x'],
        ['while(TRUE) { x <- 5 }', '1', 'x <- 5'],
        ['while(TRUE) { x <- 5; y <- 9 }', '1', 'x <- 5'],
        ['while(TRUE) { x <- 5; y <- 9 }', '0', 'while(TRUE) {}'],
        ['while(TRUE) { x <- 5; y <- 9 }', ['0', '1'], 'while(TRUE) x <- 5'],
        ['while(TRUE) { x <- 5; y <- 9 }', ['0', '1', '2'], 'while(TRUE) x <- 5'],
        ['while(TRUE) { x <- 5; y <- 9 }', ['0', '4'], 'while(TRUE) y <- 9'],
        ['while(TRUE) { x <- 5; y <- 9 }', ['0', '1', '4'], 'while(TRUE) {\n    x <- 5\n    y <- 9\n}'],
        ['while(x + 2 > 3) { x <- 0 }', ['0'], 'while(x + 2 > 3) {}'],
        ['while(x + 2 > 3) { x <- 0 }', ['5'], 'x <- 0'],
        ['while(x + 2 > 3) { x <- 0 }', ['0', '5'], 'while(x + 2 > 3) x <- 0']
      ]
      for (const [code, id, expected] of pool) {
        assertReconstructed(code, shell, code, id, expected)
      }
    })

    describe('for', () => {
      const largeFor = `
      for (i in 1:20) { 
        y <- 9
        x <- 5
        12 -> x
      }
    `
      const pool: [string, string | string[], string][] = [
        [largeFor, '0', 'for(i in 1:20) {}'],
        [largeFor, '4', 'y <- 9'],
        // TODO: always brace option?
        [largeFor, ['0', '4'], 'for(i in 1:20) y <- 9'],
        [largeFor, ['0', '4', '7'], `for(i in 1:20) {
    y <- 9
    x <- 5
}`],
        [largeFor, ['0', '4', '10'], `for(i in 1:20) {
    y <- 9
    12 -> x
}`],
      ]

      for (const [code, id, expected] of pool) {
        assertReconstructed(`${JSON.stringify(id)}: ${code}`, shell, code, id, expected)
      }
    })
  })
}))
