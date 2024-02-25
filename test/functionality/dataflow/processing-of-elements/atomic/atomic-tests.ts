/**
 * Here we cover dataflow extraction for atomic statements (no expression lists).
 * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
 * This will not include functions!
 */
import { assertDataflow, withShell } from '../../../_helper/shell'
import { DataflowGraph, EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow/v1'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool, RUnaryOpPool } from '../../../_helper/provider'
import { appendEnvironments, define } from '../../../../../src/dataflow/common/environments'
import { UnnamedArgumentPrefix } from '../../../../../src/dataflow/v1/internal/process/functions/argument'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/common/environments/scopes'
import { MIN_VERSION_PIPE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { label } from '../../../_helper/label'
import type { FlowrCapabilityId } from '../../../../../src/r-bridge/data'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { unnamedArgument } from '../../../_helper/environment-builder'

describe('Atomic (dataflow information)', withShell(shell => {
	describe('Uninteresting Leafs', () => {
		for(const [input, id] of [
			['42', 'numbers'],
			['-3.14', 'numbers'],
			['"test"', 'strings'],
			['\'test\'', 'strings'],
			['TRUE', 'logical'],
			['FALSE', 'logical'],
			['NA', 'numbers'],
			['NULL', 'null'],
			['Inf', 'inf-and-nan'],
			['NaN', 'inf-and-nan']
		] as [string, FlowrCapabilityId][]) {
			assertDataflow(label(input, id), shell, input, new DataflowGraph())
		}
	})

	assertDataflow(label('simple variable', 'name-normal'), shell,
		'xylophone',
		emptyGraph().use('0', 'xylophone')
	)

	describe('access', () => {
		describe('const access', () => {
			assertDataflow(label('single constant', 'name-normal', 'numbers', 'single-bracket-access'),
				shell,'a[2]',
				emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('2', unnamedArgument('2'))
					.reads('0', '2')
			)
			assertDataflow(label('double constant', 'name-normal', 'numbers', 'double-bracket-access'),
				shell, 'a[[2]]',
				emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('2', unnamedArgument('2'))
					.reads('0', '2')
			)
			assertDataflow(label('dollar constant', 'name-normal', 'dollar-access'),
				shell, 'a$b',
				emptyGraph().use('0', 'a', { when: 'maybe' })
			)
			assertDataflow(label('at constant','name-normal', 'slotted-access'),
				shell, 'a@b',
				emptyGraph().use('0', 'a', { when: 'maybe' })
			)
			assertDataflow(label('chained constant', 'name-normal', 'numbers', 'single-bracket-access'), shell,
				'a[2][3]',
				emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('2', unnamedArgument('2'))
					.reads('0', '2')
					.use('5', unnamedArgument('5'))
					.reads('0', '5')
			)
			assertDataflow(label('chained mixed constant', 'dollar-access', 'single-bracket-access', 'name-normal', 'numbers'), shell,
				'a[2]$a',
				emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('2', unnamedArgument('2'))
					.reads('0', '2')
			)
		})
		assertDataflow(label('chained bracket access with variables', 'name-normal', 'single-bracket-access'), shell,
			'a[x][y]',
			emptyGraph()
				.use('0', 'a', { when: 'maybe' })
				.use('1', 'x')
				.use('4', 'y')
				.use('2', unnamedArgument('2'))
				.use('5', unnamedArgument('5'))
				.reads('0', '2')
				.reads('0', '5')
				.reads('2', '1')
				.reads('5', '4')
		)
		assertDataflow(label('assign on access', 'name-normal', 'single-bracket-access', 'local-left-assignment'), shell,
			'a[x] <- 5',
			emptyGraph()
				.defineVariable('0', 'a', LocalScope, { when: 'maybe' })
				.use('1', 'x')
				.use('2', unnamedArgument('2'))
				.reads('0', '2')
				.reads('2', '1')
		)
	})

	describe(label('unary operators', 'unary-operator', 'name-normal'), () => {
		for(const opSuite of RUnaryOpPool) {
			describe(`${opSuite.label} operations`, () => {
				for(const op of opSuite.pool) {
					const inputDifferent = `${op.str}x`
					assertDataflow(label(`${op.str}x`, 'unary-operator', 'name-normal'), shell,
						inputDifferent,
						emptyGraph().use('0', 'x')
					)
				}
			})
		}
	})

	// these will be more interesting whenever we have more information on the edges (like modification etc.)
	describe(label('non-assignment binary operators', 'binary-operator', 'name-normal'), () => {
		for(const opSuite of RNonAssignmentBinaryOpPool) {
			describe(`${opSuite.label}`, () => {
				for(const op of opSuite.pool) {
					describe(`${op.str}`, () => {
						const inputDifferent = `x ${op.str} y`
						assertDataflow(label(`${inputDifferent} (different variables)`, 'binary-operator', 'name-normal'),
							shell,
							inputDifferent,
							emptyGraph().use('0', 'x').use('1', 'y')
						)

						const inputSame = `x ${op.str} x`
						assertDataflow(label(`${inputSame} (same variables)`, 'binary-operator', 'name-normal'),
							shell,
							inputSame,
							emptyGraph()
								.use('0', 'x')
								.use('1', 'x')
								.sameRead('0', '1')
						)
					})
				}
			})
		}
	})

	describe(label('Pipes', 'built-in-pipe-and-pipe-bind', 'function-calls', 'name-normal'), () => {
		describe('Passing one argument', () => {
			assertDataflow(label('No parameter function', 'built-in-pipe-and-pipe-bind'), shell, 'x |> f()',
				emptyGraph()
					.use('0', 'x')
					.call('3', 'f', [
						{ name: unnamedArgument('1'), scope: LocalScope, nodeId: '1', used: 'always' }
					])
					.use('1', unnamedArgument('1'))
					.argument('3', '1')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow(label('Nested calling', 'built-in-pipe-and-pipe-bind', 'normal', 'name-normal'), shell, 'x |> f() |> g()',
				emptyGraph()
					.use('0', 'x')
					.call('3', 'f', [
						{ name: unnamedArgument('1'), scope: LocalScope, nodeId: '1', used: 'always' }
					])
					.call('7', 'g', [
						{ name: unnamedArgument('5'), scope: LocalScope, nodeId: '5', used: 'always' }
					])
					.use('1', unnamedArgument('1'))
					.use('5', unnamedArgument('5'))
					.argument('3', '1')
					.argument('7', '5')
					.reads('5', '3')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow(label('Multi-Parameter function', 'built-in-pipe-and-pipe-bind', 'normal', 'name-normal', 'unnamed-arguments'), shell, 'x |> f(y,z)',
				emptyGraph()
					.use('0', 'x')
					.call('7', 'f', [
						{ name: unnamedArgument('1'), scope: LocalScope, nodeId: '1', used: 'always' },
						{ name: unnamedArgument('4'), scope: LocalScope, nodeId: '4', used: 'always' },
						{ name: unnamedArgument('6'), scope: LocalScope, nodeId: '6', used: 'always' }
					])
					.use('1', unnamedArgument('1'))
					.use('4', unnamedArgument('4'))
					.use('6', unnamedArgument('6'))
					.use('0', 'x')
					.use('3', 'y')
					.use('5', 'z')
					.argument('7', '1')
					.argument('7', '4')
					.argument('7', '6')
					.reads('1', '0')
					.reads('4', '3')
					.reads('6', '5'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
		})
	})

	describe(label('assignments', 'local-right-assignment', 'super-right-assignment', 'name-normal', 'numbers', 'assignments-and-bindings'), () => {
		for(const op of RAssignmentOpPool) {
			describe(`${op.str}`, () => {
				const scope = op.str.length > 2 ? GlobalScope : LocalScope // love it
				const swapSourceAndTarget = op.str === '->' || op.str === '->>'

				const constantAssignment = swapSourceAndTarget ? `5 ${op.str} x` : `x ${op.str} 5`
				assertDataflow(`${constantAssignment} (constant assignment)`,
					shell,
					constantAssignment,
					emptyGraph().defineVariable(swapSourceAndTarget ? '1' : '0', 'x', scope)
				)

				const variableAssignment = `x ${op.str} y`
				const dataflowGraph = emptyGraph()
				if(swapSourceAndTarget) {
					dataflowGraph
						.use('0', 'x')
						.defineVariable('1', 'y', scope)
						.definedBy('1', '0')
				} else {
					dataflowGraph
						.defineVariable('0', 'x', scope)
						.use('1', 'y')
						.definedBy('0', '1')
				}
				assertDataflow(`${variableAssignment} (variable assignment)`,
					shell,
					variableAssignment,
					dataflowGraph
				)

				const circularAssignment = `x ${op.str} x`

				const circularGraph = emptyGraph()
				if(swapSourceAndTarget) {
					circularGraph
						.use('0', 'x')
						.defineVariable('1', 'x', scope)
						.definedBy('1', '0')
				} else {
					circularGraph
						.defineVariable('0', 'x', scope)
						.use('1', 'x')
						.definedBy('0', '1')
				}

				assertDataflow(`${circularAssignment} (circular assignment)`,
					shell,
					circularAssignment,
					circularGraph
				)
			})
		}
		describe(label('nested assignments', 'local-left-assignment', 'local-right-assignment', 'numbers', 'name-normal', 'super-left-assignment', 'super-right-assignment'), () => {
			assertDataflow('"x <- y <- 1"', shell,
				'x <- y <- 1',
				emptyGraph()
					.defineVariable('0', 'x')
					.defineVariable('1', 'y')
					.definedBy('0', '1')
			)
			assertDataflow('"1 -> x -> y"', shell,
				'1 -> x -> y',
				emptyGraph()
					.defineVariable('1', 'x')
					.defineVariable('3', 'y')
					.definedBy('3', '1')
			)
			// still by indirection (even though y is overwritten?)
			assertDataflow('"x <- 1 -> y"', shell,
				'x <- 1 -> y',
				emptyGraph()
					.defineVariable('0', 'x')
					.defineVariable('2', 'y')
					.definedBy('0', '2')
			)
			assertDataflow('"x <- y <- z"', shell,
				'x <- y <- z',
				emptyGraph()
					.defineVariable('0', 'x')
					.defineVariable('1', 'y')
					.use('2', 'z')
					.definedBy('0', '1')
					.definedBy('1', '2')
					.definedBy('0', '2')
			)
			assertDataflow('nested global assignments', shell,
				'x <<- y <<- z',
				emptyGraph()
					.defineVariable('0', 'x', GlobalScope)
					.defineVariable('1', 'y', GlobalScope)
					.use('2', 'z')
					.definedBy('0', '1')
					.definedBy('1', '2')
					.definedBy('0', '2')
			)
			assertDataflow('nested global mixed with local assignments', shell,
				'x <<- y <- y2 <<- z',
				emptyGraph()
					.defineVariable('0', 'x', GlobalScope)
					.defineVariable('1', 'y')
					.defineVariable('2', 'y2', GlobalScope)
					.use('3', 'z')
					.definedBy('0', '1')
					.definedBy('0', '2')
					.definedBy('0', '3')
					.definedBy('1', '2')
					.definedBy('1', '3')
					.definedBy('2', '3')
			)
		})

		describe(label('known impact assignments', 'super-left-assignment', 'local-right-assignment', 'name-normal', 'numbers', 'repeat-loop', 'while-loop', 'for-loop'), () => {
			describe('loops return invisible null', () => {
				for(const assignment of [ { str: '<-', defId: ['0','0','0'], readId: ['1','1','1'], swap: false },
					{ str: '<<-', defId: ['0','0','0'], readId: ['1','1','1'], swap: false }, { str: '=', defId: ['0','0','0'], readId: ['1','1','1'], swap: false },
					/* two for parenthesis necessary for precedence */
					{ str: '->', defId: ['3', '4', '7'], readId: ['0','0','0'], swap: true }, { str: '->>', defId: ['3', '4', '7'], readId: ['0','0','0'], swap: true }] ) {
					describe(`${assignment.str}`, () => {
						const scope = assignment.str.length > 2 ? GlobalScope : LocalScope

						for(const wrapper of [(x: string) => x, (x: string) => `{ ${x} }`]) {
							const build = (a: string, b: string) => assignment.swap ? `(${wrapper(b)}) ${assignment.str} ${a}` : `${a} ${assignment.str} ${wrapper(b)}`

							const repeatCode = build('x', 'repeat x')
							assertDataflow(`"${repeatCode}"`, shell, repeatCode, emptyGraph()
								.defineVariable(assignment.defId[0], 'x', scope)
								.use(assignment.readId[0], 'x')
							)

							const whileCode = build('x', 'while (x) 3')
							assertDataflow(`"${whileCode}"`, shell, whileCode, emptyGraph()
								.defineVariable(assignment.defId[1], 'x', scope)
								.use(assignment.readId[1], 'x'))

							const forCode = build('x', 'for (x in 1:4) 3')
							assertDataflow(`"${forCode}"`, shell, forCode,
								emptyGraph()
									.defineVariable(assignment.defId[2], 'x', scope)
									.defineVariable(assignment.readId[2], 'x')
							)
						}
					})
				}
			})
		})
		describe(label('assignment with function call', 'name-normal', 'numbers', 'local-left-assignment', 'local-equal-assignment'), () => {
			const environmentWithX = define(
				{ name: 'x', nodeId: '4', kind: EdgeType.Argument, definedAt: '4', scope: LocalScope, used: 'always' },
				LocalScope,
				initializeCleanEnvironments()
			)
			assertDataflow(label('define call with multiple args should only be defined by the call-return', 'local-left-assignment', 'named-arguments', 'unnamed-arguments','normal', 'name-normal'),
				shell,
				'a <- foo(x=3,y,z)',
				emptyGraph()
					.defineVariable('0', 'a')
					.call('9', 'foo', [
						['x', { name: 'x', nodeId: '4', scope: LocalScope, used: 'always' }],
						{ name: unnamedArgument('6'), nodeId: '6', scope: LocalScope, used: 'always' },
						{ name: unnamedArgument('8'), nodeId: '8', scope: LocalScope, used: 'always' },
					])
					.use('4', 'x')
					.use('5', 'y', { environment: environmentWithX })
					.use('6', unnamedArgument('6'), { environment: environmentWithX })
					.use('7', 'z', { environment: environmentWithX })
					.use('8', unnamedArgument('8'), { environment: environmentWithX })
					.definedBy('0', '9')
					.argument('9', '4')
					.argument('9', '6')
					.argument('9', '8')
					.reads('6', '5')
					.reads('8', '7')
			)
		})
	})

	describe(label('if-then-else', 'if', 'name-normal', 'numbers', 'binary-operator', 'local-left-assignment'), () => {
		// spacing issues etc. are dealt with within the parser, however, braces are not allowed to introduce scoping artifacts
		for(const b of [
			{ label: 'without braces', func: (x: string) => `${x}` },
			{ label: 'with braces', func: (x: string) => `{ ${x} }` },
		]) {
			describe(`Variant ${b.label}`, () => {
				describe('if-then, no else', () => {
					assertDataflow('completely constant', shell,
						`if (TRUE) ${b.func('1')}`,
						emptyGraph()
					)
					assertDataflow('compare cond.', shell,
						`if (x > 5) ${b.func('1')}`,
						emptyGraph().use('0', 'x')
					)
					assertDataflow('compare cond. symbol in then', shell,
						`if (x > 5) ${b.func('y')}`,
						emptyGraph().use('0', 'x')
							.use('3', 'y', { when: 'maybe' })
					)
					assertDataflow('all variables', shell,
						`if (x > y) ${b.func('z')}`,
						emptyGraph()
							.use('0', 'x')
							.use('1', 'y')
							.use('3', 'z', { when: 'maybe' })
					)
					assertDataflow('all variables, some same', shell,
						`if (x > y) ${b.func('x')}`,
						emptyGraph()
							.use('0', 'x')
							.use('1', 'y')
							.use('3', 'x', { when: 'maybe' })
							.sameRead('0', '3', 'maybe')
					)
					assertDataflow('all same variables', shell,
						`if (x > x) ${b.func('x')}`,
						emptyGraph()
							.use('0', 'x')
							.use('1', 'x')
							.use('3', 'x', { when: 'maybe' })
							.sameRead('0', '1')
							// theoretically, they just have to be connected, so 0 is just hardcoded
							.sameRead('0', '3', 'maybe')
					)
					assertDataflow('definition in if', shell,
						`if (x <- 3) ${b.func('x')}`,
						emptyGraph()
							.defineVariable('0', 'x', LocalScope)
							.use('3', 'x', { when: 'maybe', environment: define({ name: 'x', definedAt: '2', used: 'always', kind: 'variable', scope: LocalScope, nodeId: '0' }, LocalScope, initializeCleanEnvironments()) })
							.reads('3', '0')
					)
				})

				describe('if-then, with else', () => {
					assertDataflow('completely constant', shell,
						'if (TRUE) { 1 } else { 2 }',
						emptyGraph()
					)
					assertDataflow('compare cond.', shell,
						'if (x > 5) { 1 } else { 42 }',
						emptyGraph().use('0', 'x')
					)
					assertDataflow('compare cond. symbol in then', shell,
						'if (x > 5) { y } else { 42 }',
						emptyGraph().use('0', 'x').use('3', 'y', { when: 'maybe' })
					)
					assertDataflow('compare cond. symbol in then & else', shell,
						'if (x > 5) { y } else { z }',
						emptyGraph()
							.use('0', 'x')
							.use('3', 'y', { when: 'maybe' })
							.use('5', 'z', { when: 'maybe' })
					)
					assertDataflow('all variables', shell,
						'if (x > y) { z } else { a }',
						emptyGraph()
							.use('0', 'x')
							.use('1', 'y')
							.use('3', 'z', { when: 'maybe' })
							.use('5', 'a', { when: 'maybe' })
					)
					assertDataflow('all variables, some same', shell,
						'if (y > x) { x } else { y }',
						emptyGraph()
							.use('0', 'y')
							.use('1', 'x')
							.use('3', 'x', { when: 'maybe' })
							.use('5', 'y', { when: 'maybe' })
							.sameRead('1', '3', 'maybe')
							.sameRead('0', '5', 'maybe')
					)
					assertDataflow('all same variables', shell,
						'if (x > x) { x } else { x }',
						emptyGraph()
							.use('0', 'x')
							.use('1', 'x')
							.use('3', 'x', { when: 'maybe' })
							.use('5', 'x', { when: 'maybe' })
							// 0 is just hardcoded, they actually just have to be connected
							.sameRead('0', '1')
							.sameRead('0', '3', 'maybe')
							.sameRead('0', '5', 'maybe')
					)
				})
			})
		}
	})
	describe('inline non-strict boolean operations', () => {
		const environmentWithY = define(
			{ name: 'y', nodeId: '0', kind: 'variable', definedAt: '2', scope: LocalScope, used: 'always' },
			LocalScope,
			initializeCleanEnvironments()
		)
		const environmentWithOtherY = define(
			{ name: 'y', nodeId: '4', kind: 'variable', definedAt: '6', scope: LocalScope, used: 'always' },
			LocalScope,
			initializeCleanEnvironments()
		)
		assertDataflow('define call with multiple args should only be defined by the call-return', shell, 'y <- 15; x && (y <- 13); y',
			emptyGraph()
				.defineVariable('0', 'y')
				.defineVariable('4', 'y', LocalScope, { environment: environmentWithY })
				.use('3', 'x', { environment: environmentWithY })
				.use('8', 'y', { environment: appendEnvironments(environmentWithY, environmentWithOtherY) })
				.reads('8', '0')
				.reads('8', '4')
				.sameDef('0', '4')
		)
	})

	describe('loops', () => {
		describe(label('for', 'numbers', 'name-normal', 'for-loop'), () => {
			assertDataflow('simple constant for-loop', shell,
				'for(i in 1:10) { 1 }',
				emptyGraph().defineVariable('0', 'i')
			)
			assertDataflow('using loop variable in body', shell,
				'for(i in 1:10) { i }',
				emptyGraph()
					.defineVariable('0', 'i')
					.use('4', 'i', { when: 'maybe', environment: define({ name: 'i', definedAt: '6', used: 'always', kind: 'variable', scope: LocalScope, nodeId: '0' }, LocalScope, initializeCleanEnvironments()) })
					.reads('4', '0', 'maybe')
			)
		})

		describe(label('repeat', 'numbers', 'name-normal', 'local-left-assignment', 'repeat-loop'), () => {
			assertDataflow('simple constant repeat', shell,
				'repeat 2',
				emptyGraph()
			)
			assertDataflow('using loop variable in body', shell,
				'repeat x',
				emptyGraph().use('0', 'x')
			)
			assertDataflow('using loop variable in body', shell,
				'repeat { x <- 1 }',
				emptyGraph().defineVariable('0', 'x')
			)
			assertDataflow('using variable in body', shell,
				'repeat { x <- y }',
				emptyGraph()
					.defineVariable('0', 'x')
					.use('1', 'y')
					.definedBy('0', '1')
			)
		})
	})
}))
