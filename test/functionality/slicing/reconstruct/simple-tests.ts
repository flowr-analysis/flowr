import { assertReconstructed, withShell } from '../../_helper/shell'
import type { NodeId } from '../../../../src'
import { OperatorDatabase } from '../../../../src'
import { label } from '../../_helper/label'
import type { SupportedFlowrCapabilityId } from '../../../../src/r-bridge/data'

describe('Simple', withShell(shell => {
	describe('Constant assignments', () => {
		for(const [id, code, caps] of [
			[0, 'x <- 5', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities]],
			[0, 'x <- 5; y <- 9', ['name-normal', 'numbers', 'semicolons', ...OperatorDatabase['<-'].capabilities]],
			[2, '{ x <- 5 }', ['grouping', 'name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities]],
			[2, '{ x <- 5; y <- 9 }', ['grouping', 'name-normal', 'numbers', 'semicolons', ...OperatorDatabase['<-'].capabilities]],
		] as [number, string, SupportedFlowrCapabilityId[]][]){
			assertReconstructed(label(code, caps), shell, code, id, 'x <- 5')
		}
	})
	describe('Nested Assignments', () => {
		for(const [code, id, expected, caps] of [
			['12 + (supi <- 42)', 0, '12 + (supi <- 42)', ['grouping', 'name-normal', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['+'].capabilities]],
			['y <- x <- 42', 1, 'x <- 42', ['name-normal', 'numbers', 'return-value-of-assignments', ...OperatorDatabase['<-'].capabilities] ],
			['y <- x <- 42', 0, 'y <- x <- 42', ['name-normal', 'numbers', 'return-value-of-assignments', ...OperatorDatabase['<-'].capabilities] ],
			['for (i in 1:20) { x <- 5 }', 6, 'x <- 5', ['for-loop', 'name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities] ]
		] as [string, number, string, SupportedFlowrCapabilityId[]][]) {
			assertReconstructed(label(code, caps), shell, code, id, expected)
		}
	})

	describe('Access', () => {
		for(const [code, id, expected, caps] of [
			/* we are interested in 'a' not in the result of the access*/
			['a[3]', 0, 'a', ['single-bracket-access', 'numbers', 'name-normal'] ],
			['a[x]', 1, 'x', ['single-bracket-access', 'name-normal'] ]
		] as [string, number, string, SupportedFlowrCapabilityId[]][]) {
			assertReconstructed(label(code, caps), shell, code, id, expected)
		}
	})

	describe('Loops', () => {
		describe('repeat', () => {
			const pool: [string, NodeId | NodeId[], string, SupportedFlowrCapabilityId[]][] = [
				['repeat { x }', 2, 'x', ['repeat-loop', 'name-normal']],
				['repeat { x <- 5; y <- 9 }', 2, 'x <- 5', ['repeat-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'semicolons', 'numbers']],
				['repeat { x <- 5; y <- 9 }', [2, 4, 6], 'x <- 5\n9', ['repeat-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'semicolons', 'numbers']]
			]
			for(const [code, id, expected, caps] of pool) {
				assertReconstructed(label(code, caps), shell, code, id, expected)
			}
		})

		describe('while', () => {
			const fiveNineCaps: SupportedFlowrCapabilityId[] = ['while-loop', 'logical', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons']
			const pool: [string, NodeId | NodeId[], string, SupportedFlowrCapabilityId[]][] = [
				['while(TRUE) { x }', 3, 'x', ['while-loop', 'logical', 'name-normal']],
				['while(TRUE) { x <- 5 }', 3, 'x <- 5', ['while-loop', 'logical', 'name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities]],
				['while(TRUE) { x <- 5; y <- 9 }', 3, 'x <- 5', fiveNineCaps],
				['while(TRUE) { x <- 5; y <- 9 }', [10, 3], 'while(TRUE) x <- 5', fiveNineCaps],
				['while(TRUE) { x <- 5; y <- 9 }', [10, 3, 5], 'while(TRUE) x <- 5', fiveNineCaps],
				['while(TRUE) { x <- 5; y <- 9 }', [10, 6], 'while(TRUE) y <- 9', fiveNineCaps],
				['while(TRUE) { x <- 5; y <- 9 }', [3, 4, 6], 'x <- 5\ny <- 9', fiveNineCaps],
				['while(x + 2 > 3) { x <- 0 }', [7], 'x <- 0', ['while-loop', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers']],
				['while(x + 2 > 3) { x <- 0 }', [0, 7], 'while(x + 2 > 3) x <- 0', ['while-loop', 'binary-operator', 'infix-calls', ...OperatorDatabase['+'].capabilities, 'name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers']]
			]
			for(const [code, id, expected, caps] of pool) {
				assertReconstructed(label(code, caps), shell, code, id, expected)
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
			const caps: SupportedFlowrCapabilityId[] = ['for-loop', 'name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, ...OperatorDatabase['->'].capabilities, 'newlines']
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
				assertReconstructed(label(`${JSON.stringify(id)}: ${code}`, caps), shell, code, id, expected)
			}
		})
	})
	describe('Failures in practice', () => {
		assertReconstructed(label('Reconstruct expression list in call', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'unnamed-arguments', 'call-normal', 'newlines']), shell, `
a <- foo({
    a <- b()

    c <- 3
    })`, 0, `a <- foo({
    a <- b()

    c <- 3
    })`)

		const caps: SupportedFlowrCapabilityId[] = ['name-normal', ...OperatorDatabase['<-'].capabilities, 'double-bracket-access', 'numbers', 'infix-calls', 'binary-operator', 'call-normal', 'newlines', 'unnamed-arguments']
		assertReconstructed(label('Reconstruct access in pipe (variable)', caps), shell, `
ls <- x[[1]] %>% st_cast()
class(ls)`, 2, 'x')
		assertReconstructed(label('Reconstruct access in pipe (access)', caps), shell, `
ls <- x[[1]] %>% st_cast()
class(ls)`, 13, 'class(ls)')
	})
}))
