import { assertReconstructed, withShell } from '../../_helper/shell'
import type { NodeId } from '../../../../src'

describe('Simple', withShell(shell => {
	describe('Constant assignments', () => {
		for(const [id, code] of [
			[0, 'x <- 5'],
			[0, 'x <- 5; y <- 9'],
			[2, '{ x <- 5 }'],
			[2, '{ x <- 5; y <- 9 }']
		] as const) {
			assertReconstructed(code, shell, code, id, 'x <- 5')
		}
	})
	describe('Nested Assignments', () => {
		for(const [code, id, expected] of [
			['12 + (supi <- 42)', 0, '12 + (supi <- 42)' ],
			['y <- x <- 42', 1, 'x <- 42' ],
			['y <- x <- 42', 0, 'y <- x <- 42' ],
			['for (i in 1:20) { x <- 5 }', 6, 'x <- 5' ]
		] as const) {
			assertReconstructed(code, shell, code, id, expected)
		}
	})

	describe('Access', () => {
		for(const [code, id, expected] of [
			/* we are interested in 'a' not in the result of the access*/
			['a[3]', 0, 'a' ],
			['a[x]', 1, 'x' ]
		] as const) {
			assertReconstructed(code, shell, code, id, expected)
		}
	})

	describe('Loops', () => {
		describe('repeat', () => {
			const pool: [string, NodeId | NodeId[], string][] = [
				['repeat { x }', 2, 'x'],
				['repeat { x <- 5; y <- 9 }', 2, 'x <- 5'],
				['repeat { x <- 5; y <- 9 }', [2, 4, 6], 'x <- 5\n9']
			]
			for(const [code, id, expected] of pool) {
				assertReconstructed(code, shell, code, id, expected)
			}
		})

		describe('while', () => {
			const pool: [string, NodeId | NodeId[], string][] = [
				['while(TRUE) { x }', 3, 'x'],
				['while(TRUE) { x <- 5 }', 3, 'x <- 5'],
				['while(TRUE) { x <- 5; y <- 9 }', 3, 'x <- 5'],
				['while(TRUE) { x <- 5; y <- 9 }', [10, 3], 'while(TRUE) x <- 5'],
				['while(TRUE) { x <- 5; y <- 9 }', [10, 3, 5], 'while(TRUE) x <- 5'],
				['while(TRUE) { x <- 5; y <- 9 }', [10, 6], 'while(TRUE) y <- 9'],
				['while(TRUE) { x <- 5; y <- 9 }', [3, 4, 6], 'x <- 5\ny <- 9'],
				['while(x + 2 > 3) { x <- 0 }', [7], 'x <- 0'],
				['while(x + 2 > 3) { x <- 0 }', [0, 7], 'while(x + 2 > 3) x <- 0']
			]
			for(const [code, id, expected] of pool) {
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
			const pool: [string, NodeId | NodeId[], string][] = [
				[largeFor, 0, 'for(i in 1:20) {}'],
				[largeFor, 6, 'y <- 9'],
				[largeFor, [6, 16], 'for(i in 1:20) y <- 9'],
				[largeFor, [6, 9], 'y <- 9\nx <- 5'],
				[largeFor, [6, 12, 16], `for(i in 1:20) {
    y <- 9
    12 -> x
}`],
			]

			for(const [code, id, expected] of pool) {
				assertReconstructed(`${JSON.stringify(id)}: ${code}`, shell, code, id, expected)
			}
		})
	})
	describe('Failures in practice', () => {
		assertReconstructed('Reconstruct expression list in call', shell, `
a <- foo({
    a <- b()

    c <- 3
    })`, 0, `a <- foo({
    a <- b()

    c <- 3
    })`)
		assertReconstructed('Reconstruct access in pipe (variable)', shell, `
ls <- x[[1]] %>% st_cast()
class(ls)`, 2, 'x')
		assertReconstructed('Reconstruct access in pipe (access)', shell, `
ls <- x[[1]] %>% st_cast()
class(ls)`, 13, 'class(ls)')
	})
}))
