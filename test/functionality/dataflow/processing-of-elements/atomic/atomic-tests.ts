/**
 * Here we cover dataflow extraction for atomic statements (no expression lists).
 * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
 * This will not include functions!
 */
import { assertDataflow, withShell } from '../../../_helper/shell'
import { EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow'
import { RAssignmentOpPool, RNonAssignmentBinaryOpPool, RUnaryOpPool } from '../../../_helper/provider'
import { appendEnvironments, define } from '../../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../../src/dataflow/internal/process/functions/argument'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { MIN_VERSION_PIPE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('Atomic (dataflow information)', withShell((shell) => {
	describe('uninteresting leafs', () => {
		for(const input of ['42', '"test"', 'TRUE', 'NA', 'NULL']) {
			assertDataflow(input, shell, input, emptyGraph())
		}
	})

	assertDataflow('simple variable', shell,
		'xylophone',
		emptyGraph().uses('0', 'xylophone')
	)

	describe('access', () => {
		describe('const access', () => {
			assertDataflow('single constant', shell,
				'a[2]',
				emptyGraph().uses('0', 'a', 'maybe')
					.uses('2', `${UnnamedArgumentPrefix}2`)
					.reads('0', '2')
			)
			assertDataflow('double constant', shell,
				'a[[2]]',
				emptyGraph().uses('0', 'a', 'maybe')
					.uses('2', `${UnnamedArgumentPrefix}2`)
					.reads('0', '2')
			)
			assertDataflow('dollar constant', shell,
				'a$b',
				emptyGraph().uses('0', 'a', 'maybe')
			)
			assertDataflow('at constant', shell,
				'a@b',
				emptyGraph().uses('0', 'a', 'maybe')
			)
			assertDataflow('chained constant', shell,
				'a[2][3]',
				emptyGraph().uses('0', 'a', 'maybe')
					.uses('2', `${UnnamedArgumentPrefix}2`)
					.reads('0', '2')
					.uses('5', `${UnnamedArgumentPrefix}5`)
					.reads('0', '5')
			)
			assertDataflow('chained mixed constant', shell,
				'a[2]$a',
				emptyGraph().uses('0', 'a', 'maybe')
					.uses('2', `${UnnamedArgumentPrefix}2`)
					.reads('0', '2')
			)
		})
		assertDataflow('chained bracket access with variables', shell,
			'a[x][y]',
			emptyGraph()
				.uses('0', 'a', 'maybe')
				.uses('1', 'x')
				.uses('4', 'y')
				.uses('2', `${UnnamedArgumentPrefix}2`)
				.uses('5', `${UnnamedArgumentPrefix}5`)
				.reads('0', '2')
				.reads('0', '5')
				.reads('2', '1')
				.reads('5', '4')
		)
		assertDataflow('assign on access', shell,
			'a[x] <- 5',
			emptyGraph()
				.definesVariable('0', 'a', LocalScope, 'maybe')
				.uses('1', 'x')
				.uses('2', `${UnnamedArgumentPrefix}2`)
				.reads('0', '2')
				.reads('2', '1')
		)
	})

	describe('unary operators', () => {
		for(const opSuite of RUnaryOpPool) {
			describe(`${opSuite.label} operations`, () => {
				for(const op of opSuite.pool) {
					const inputDifferent = `${op.str}x`
					assertDataflow(`${op.str}x`, shell,
						inputDifferent,
						emptyGraph().uses('0', 'x')
					)
				}
			})
		}
	})

	// these will be more interesting whenever we have more information on the edges (like modification etc.)
	describe('non-assignment binary operators', () => {
		for(const opSuite of RNonAssignmentBinaryOpPool) {
			describe(`${opSuite.label}`, () => {
				for(const op of opSuite.pool) {
					describe(`${op.str}`, () => {
						const inputDifferent = `x ${op.str} y`
						assertDataflow(`${inputDifferent} (different variables)`,
							shell,
							inputDifferent,
							emptyGraph().uses('0', 'x').uses('1', 'y')
						)

						const inputSame = `x ${op.str} x`
						assertDataflow(`${inputSame} (same variables)`,
							shell,
							inputSame,
							emptyGraph()
								.uses('0', 'x')
								.uses('1', 'x')
								.addEdge('0', '1', EdgeType.SameReadRead, 'always')
						)
					})
				}
			})
		}
	})

	describe('Pipes', () => {
		describe('Passing one argument', () => {
			assertDataflow('No parameter function', shell, 'x |> f()',
				emptyGraph()
					.uses('0', 'x')
					.addVertex({
						tag:  'function-call',
						id:   '3',
						name: 'f',
						args: [{ name: `${UnnamedArgumentPrefix}1`, scope: LocalScope, nodeId: '1', used: 'always' }]
					})
					.uses('1', `${UnnamedArgumentPrefix}1`)
					.addEdge('3', '1', EdgeType.Argument, 'always')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow('Nested calling', shell, 'x |> f() |> g()',
				emptyGraph()
					.uses('0', 'x')
					.addVertex({
						tag:  'function-call',
						id:   '3',
						name: 'f',
						args: [{ name: `${UnnamedArgumentPrefix}1`, scope: LocalScope, nodeId: '1', used: 'always' }]
					})
					.addVertex({
						tag:  'function-call',
						id:   '7',
						name: 'g',
						args: [{ name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, nodeId: '5', used: 'always' }]
					})
					.uses('1', `${UnnamedArgumentPrefix}1`)
					.uses('5', `${UnnamedArgumentPrefix}5`)
					.addEdge('3', '1', EdgeType.Argument, 'always')
					.addEdge('7', '5', EdgeType.Argument, 'always')
					.reads('5', '3')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow('Multi-Parameter function', shell, 'x |> f(y,z)',
				emptyGraph()
					.uses('0', 'x')
					.addVertex({
						tag:  'function-call',
						id:   '7',
						name: 'f',
						args: [
							{ name: `${UnnamedArgumentPrefix}1`, scope: LocalScope, nodeId: '1', used: 'always' },
							{ name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, nodeId: '4', used: 'always' },
							{ name: `${UnnamedArgumentPrefix}6`, scope: LocalScope, nodeId: '6', used: 'always' }
						]
					})
					.uses('1', `${UnnamedArgumentPrefix}1`)
					.uses('4', `${UnnamedArgumentPrefix}4`)
					.uses('6', `${UnnamedArgumentPrefix}6`)
					.uses('0', 'x')
					.uses('3', 'y')
					.uses('5', 'z')
					.addEdge('7', '1', EdgeType.Argument, 'always')
					.addEdge('7', '4', EdgeType.Argument, 'always')
					.addEdge('7', '6', EdgeType.Argument, 'always')
					.reads('1', '0')
					.reads('4', '3')
					.reads('6', '5'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
		})
	})

	describe('assignments', () => {
		for(const op of RAssignmentOpPool) {
			describe(`${op.str}`, () => {
				const scope = op.str.length > 2 ? GlobalScope : LocalScope // love it
				const swapSourceAndTarget = op.str === '->' || op.str === '->>'

				const constantAssignment = swapSourceAndTarget ? `5 ${op.str} x` : `x ${op.str} 5`
				assertDataflow(`${constantAssignment} (constant assignment)`,
					shell,
					constantAssignment,
					emptyGraph().definesVariable(swapSourceAndTarget ? '1' : '0', 'x', scope)
				)

				const variableAssignment = `x ${op.str} y`
				const dataflowGraph = emptyGraph()
				if(swapSourceAndTarget) {
					dataflowGraph
						.uses('0', 'x')
						.definesVariable('1', 'y', scope)
						.addEdge('1', '0', EdgeType.DefinedBy, 'always')
				} else {
					dataflowGraph
						.definesVariable('0', 'x', scope)
						.uses('1', 'y')
						.addEdge('0', '1', EdgeType.DefinedBy, 'always')
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
						.uses('0', 'x')
						.definesVariable('1', 'x', scope)
						.addEdge('1', '0', EdgeType.DefinedBy, 'always')
				} else {
					circularGraph
						.definesVariable('0', 'x', scope)
						.uses('1', 'x')
						.addEdge('0', '1', EdgeType.DefinedBy, 'always')
				}

				assertDataflow(`${circularAssignment} (circular assignment)`,
					shell,
					circularAssignment,
					circularGraph
				)
			})
		}
		describe('nested assignments', () => {
			assertDataflow('"x <- y <- 1"', shell,
				'x <- y <- 1',
				emptyGraph()
					.definesVariable('0', 'x')
					.definesVariable('1', 'y')
					.addEdge('0', '1', EdgeType.DefinedBy, 'always')
			)
			assertDataflow('"1 -> x -> y"', shell,
				'1 -> x -> y',
				emptyGraph()
					.definesVariable('1', 'x')
					.definesVariable('3', 'y')
					.addEdge('3', '1', EdgeType.DefinedBy, 'always')
			)
			// still by indirection (even though y is overwritten?)
			assertDataflow('"x <- 1 -> y"', shell,
				'x <- 1 -> y',
				emptyGraph()
					.definesVariable('0', 'x')
					.definesVariable('2', 'y')
					.addEdge('0', '2', EdgeType.DefinedBy, 'always')
			)
			assertDataflow('"x <- y <- z"', shell,
				'x <- y <- z',
				emptyGraph()
					.definesVariable('0', 'x')
					.definesVariable('1', 'y')
					.uses('2', 'z')
					.addEdge('0', '1', EdgeType.DefinedBy, 'always')
					.addEdge('1', '2', EdgeType.DefinedBy, 'always')
					.addEdge('0', '2', EdgeType.DefinedBy, 'always')
			)
			assertDataflow('nested global assignments', shell,
				'x <<- y <<- z',
				emptyGraph()
					.definesVariable('0', 'x', GlobalScope)
					.definesVariable('1', 'y', GlobalScope)
					.uses('2', 'z')
					.addEdge('0', '1', EdgeType.DefinedBy, 'always')
					.addEdge('1', '2', EdgeType.DefinedBy, 'always')
					.addEdge('0', '2', EdgeType.DefinedBy, 'always')
			)
			assertDataflow('nested global mixed with local assignments', shell,
				'x <<- y <- y2 <<- z',
				emptyGraph()
					.definesVariable('0', 'x', GlobalScope)
					.definesVariable('1', 'y')
					.definesVariable('2', 'y2', GlobalScope)
					.uses('3', 'z')
					.addEdge('0', '1', EdgeType.DefinedBy, 'always')
					.addEdge('0', '2', EdgeType.DefinedBy, 'always')
					.addEdge('0', '3', EdgeType.DefinedBy, 'always')
					.addEdge('1', '2', EdgeType.DefinedBy, 'always')
					.addEdge('1', '3', EdgeType.DefinedBy, 'always')
					.addEdge('2', '3', EdgeType.DefinedBy, 'always')
			)
		})

		describe('known impact assignments', () => {
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
								.definesVariable(assignment.defId[0], 'x', scope)
								.uses(assignment.readId[0], 'x')
							)

							const whileCode = build('x', 'while (x) 3')
							assertDataflow(`"${whileCode}"`, shell, whileCode, emptyGraph()
								.definesVariable(assignment.defId[1], 'x', scope)
								.uses(assignment.readId[1], 'x'))

							const forCode = build('x', 'for (x in 1:4) 3')
							assertDataflow(`"${forCode}"`, shell, forCode,
								emptyGraph()
									.definesVariable(assignment.defId[2], 'x', scope)
									.definesVariable(assignment.readId[2], 'x')
							)
						}
					})
				}
			})
		})
		describe('assignment with function call', () => {
			const environmentWithX = define(
				{ name: 'x', nodeId: '4', kind: EdgeType.Argument, definedAt: '4', scope: LocalScope, used: 'always' },
				LocalScope,
				initializeCleanEnvironments()
			)
			assertDataflow('define call with multiple args should only be defined by the call-return', shell, 'a <- foo(x=3,y,z)',
				emptyGraph()
					.definesVariable('0', 'a')
					.addVertex({
						tag:  'function-call',
						id:   '9',
						name: 'foo',
						args: [
							['x', { name: 'x', nodeId: '4', scope: LocalScope, used: 'always' }],
							{ name: `${UnnamedArgumentPrefix}6`, nodeId: '6', scope: LocalScope, used: 'always' },
							{ name: `${UnnamedArgumentPrefix}8`, nodeId: '8', scope: LocalScope, used: 'always' },
						]
					})
					.uses('4', 'x')
					.uses('5', 'y', 'always', environmentWithX)
					.uses('6', `${UnnamedArgumentPrefix}6`, 'always', environmentWithX)
					.uses('7', 'z', 'always', environmentWithX)
					.uses('8', `${UnnamedArgumentPrefix}8`, 'always', environmentWithX)
					.addEdge('0', '9', EdgeType.DefinedBy, 'always')
					.addEdge('9', '4', EdgeType.Argument, 'always')
					.addEdge('9', '6', EdgeType.Argument, 'always')
					.addEdge('9', '8', EdgeType.Argument, 'always')
					.reads('6', '5')
					.reads('8', '7')
			)
		})
	})

	describe('if-then-else', () => {
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
						emptyGraph().uses('0', 'x')
					)
					assertDataflow('compare cond. symbol in then', shell,
						`if (x > 5) ${b.func('y')}`,
						emptyGraph().uses('0', 'x')
							.uses('3', 'y', 'maybe')
					)
					assertDataflow('all variables', shell,
						`if (x > y) ${b.func('z')}`,
						emptyGraph()
							.uses('0', 'x')
							.uses('1', 'y')
							.uses('3', 'z', 'maybe')
					)
					assertDataflow('all variables, some same', shell,
						`if (x > y) ${b.func('x')}`,
						emptyGraph()
							.uses('0', 'x')
							.uses('1', 'y')
							.uses('3', 'x', 'maybe')
							.addEdge('0', '3', EdgeType.SameReadRead, 'maybe')
					)
					assertDataflow('all same variables', shell,
						`if (x > x) ${b.func('x')}`,
						emptyGraph()
							.uses('0', 'x')
							.uses('1', 'x')
							.uses('3', 'x', 'maybe')
							.addEdge('0', '1', EdgeType.SameReadRead, 'always')
							// theoretically, they just have to be connected, so 0 is just hardcoded
							.addEdge('0', '3', EdgeType.SameReadRead, 'maybe')
					)
					assertDataflow('definition in if', shell,
						`if (x <- 3) ${b.func('x')}`,
						emptyGraph()
							.definesVariable('0', 'x', LocalScope)
							.uses('3', 'x', 'maybe', define({ name: 'x', definedAt: '2', used: 'always', kind: 'variable', scope: LocalScope, nodeId: '0'}, LocalScope, initializeCleanEnvironments()) )
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
						emptyGraph().uses('0', 'x')
					)
					assertDataflow('compare cond. symbol in then', shell,
						'if (x > 5) { y } else { 42 }',
						emptyGraph().uses('0', 'x').uses('3', 'y', 'maybe')
					)
					assertDataflow('compare cond. symbol in then & else', shell,
						'if (x > 5) { y } else { z }',
						emptyGraph()
							.uses('0', 'x')
							.uses('3', 'y', 'maybe')
							.uses('5', 'z', 'maybe')
					)
					assertDataflow('all variables', shell,
						'if (x > y) { z } else { a }',
						emptyGraph()
							.uses('0', 'x')
							.uses('1', 'y')
							.uses('3', 'z', 'maybe')
							.uses('5', 'a', 'maybe')
					)
					assertDataflow('all variables, some same', shell,
						'if (y > x) { x } else { y }',
						emptyGraph()
							.uses('0', 'y')
							.uses('1', 'x')
							.uses('3', 'x', 'maybe')
							.uses('5', 'y', 'maybe')
							.addEdge('1', '3', EdgeType.SameReadRead, 'maybe')
							.addEdge('0', '5', EdgeType.SameReadRead, 'maybe')
					)
					assertDataflow('all same variables', shell,
						'if (x > x) { x } else { x }',
						emptyGraph()
							.uses('0', 'x')
							.uses('1', 'x')
							.uses('3', 'x', 'maybe')
							.uses('5', 'x', 'maybe')
							// 0 is just hardcoded, they actually just have to be connected
							.addEdge('0', '1', EdgeType.SameReadRead, 'always')
							.addEdge('0', '3', EdgeType.SameReadRead, 'maybe')
							.addEdge('0', '5', EdgeType.SameReadRead, 'maybe')
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
				.definesVariable('0', 'y')
				.definesVariable('4', 'y', LocalScope, 'always', environmentWithY)
				.addVertex({ id: '3', tag: 'use', name: 'x', scope: LocalScope, environment: environmentWithY })
				.addVertex({ id: '8', tag: 'use', name: 'y', scope: LocalScope, environment: appendEnvironments(environmentWithY, environmentWithOtherY) })
				.reads('8', '0')
				.reads('8', '4')
				.addEdge('0', '4', EdgeType.SameDefDef, 'always')
		)
	})

	describe('loops', () => {
		describe('for', () => {
			assertDataflow('simple constant for-loop', shell,
				'for(i in 1:10) { 1 }',
				emptyGraph().definesVariable('0', 'i')
			)
			assertDataflow('using loop variable in body', shell,
				'for(i in 1:10) { i }',
				emptyGraph()
					.definesVariable('0', 'i')
					.uses('4', 'i', 'maybe', define({ name: 'i', definedAt: '6', used: 'always', kind: 'variable', scope: LocalScope, nodeId: '0'}, LocalScope, initializeCleanEnvironments()))
					.reads('4', '0', 'maybe')
			)
		})

		describe('repeat', () => {
			assertDataflow('simple constant repeat', shell,
				'repeat 2',
				emptyGraph()
			)
			assertDataflow('using loop variable in body', shell,
				'repeat x',
				emptyGraph().uses('0', 'x')
			)
			assertDataflow('using loop variable in body', shell,
				'repeat { x <- 1 }',
				emptyGraph().definesVariable('0', 'x')
			)
			assertDataflow('using variable in body', shell,
				'repeat { x <- y }',
				emptyGraph()
					.definesVariable('0', 'x')
					.uses('1', 'y')
					.addEdge('0', '1', EdgeType.DefinedBy, 'always')
			)
		})
	})
}))
