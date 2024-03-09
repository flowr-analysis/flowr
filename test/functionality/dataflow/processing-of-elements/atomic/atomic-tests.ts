/**
 * Here we cover dataflow extraction for atomic statements (no expression lists).
 * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
 * This will not include functions!
 */
import { assertDataflow, withShell } from '../../../_helper/shell'
import { MIN_VERSION_PIPE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { label } from '../../../_helper/label'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { argumentInCall, defaultEnvironment, unnamedArgument } from '../../../_helper/environment-builder'
import { AssignmentOperators, BinaryNonAssignmentOperators, UnaryOperatorPool } from '../../../_helper/provider'
import { OperatorDatabase } from '../../../../../src'
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data'
import type { FunctionArgument } from '../../../../../src/dataflow'
import { BuiltIn } from '../../../../../src/dataflow'
import { startAndEndsWith } from '../../../../../src/util/strings'

describe('Atomic (dataflow information)', withShell(shell => {
	describe('Uninteresting Leafs', () => {
		for(const [input, id] of [
			['42', 'numbers'],
			['"test"', 'strings'],
			['\'test\'', 'strings'],
			['TRUE', 'logical'],
			['FALSE', 'logical'],
			['NA', 'numbers'],
			['NULL', 'null'],
			['Inf', 'inf-and-nan'],
			['NaN', 'inf-and-nan']
		] as [string, SupportedFlowrCapabilityId][]) {
			assertDataflow(label(input, [id]), shell, input, emptyGraph())
		}
	})

	assertDataflow(label('Simple Variable', ['name-normal']), shell,
		'xylophone', emptyGraph().use('0', 'xylophone')
	)

	describe('Access', () => {
		describe('Access with Constant', () => {
			assertDataflow(label('single constant', ['name-normal', 'numbers', 'single-bracket-access']),
				shell,'a[2]', emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('0-arg', unnamedArgument('0-arg'))
					.use('2', unnamedArgument('2'))
					.call('3', '[', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
					])
					.returns('3', '0-arg')
					.argument('3', '0-arg')
					.argument('3', '2')
					.reads('3', BuiltIn)
					.reads('0-arg', '0')
			)
			assertDataflow(label('double constant', ['name-normal', 'numbers', 'double-bracket-access']),
				shell, 'a[[2]]', emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('0-arg', unnamedArgument('0-arg'))
					.use('2', unnamedArgument('2'))
					.call('3', '[[', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
					])
					.returns('3', '0-arg')
					.argument('3', '0-arg')
					.argument('3', '2')
					.reads('3', BuiltIn)
					.reads('0-arg', '0')
			)
			assertDataflow(label('dollar constant', ['name-normal', 'dollar-access']),
				shell, 'a$b', emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('0-arg', unnamedArgument('0-arg'))
					.use('2', unnamedArgument('2'))
					.call('3', '$', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
					])
					.returns('3', '0-arg')
					.argument('3', '0-arg')
					.argument('3', '2')
					.reads('3', BuiltIn)
					.reads('0-arg', '0')
			)
			assertDataflow(label('at constant', ['name-normal', 'slot-access']),
				shell, 'a@b', emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('0-arg', unnamedArgument('0-arg'))
					.use('2', unnamedArgument('2'))
					.call('3', '@', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
					])
					.returns('3', '0-arg')
					.argument('3', '0-arg')
					.argument('3', '2')
					.reads('3', BuiltIn)
					.reads('0-arg', '0')
			)
			assertDataflow(label('chained constant', ['name-normal', 'numbers', 'single-bracket-access']), shell,
				'a[2][3]', emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('0-arg', unnamedArgument('0-arg'))
					.use('2', unnamedArgument('2'))
					.call('3', '[', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
					])
					.returns('3', '0-arg')
					.argument('3', '0-arg')
					.argument('3', '2')
					.reads('3', BuiltIn)
					.reads('0-arg', '0')
				// and now the outer access
					.call('6', '[', [
						{ name: unnamedArgument('3-arg'), nodeId: '3-arg', used: 'always' },
						{ name: unnamedArgument('5'), nodeId: '5', used: 'always' }
					])
					.returns('6', '3-arg')
					.use( '3-arg', unnamedArgument('3-arg'))
					.use('5', unnamedArgument('5'))
					.argument('6', '3-arg')
					.argument('6', '5')
					.reads('6', BuiltIn)
					.reads('3-arg', '3')
					.reads('3-arg', '0')
			)
			assertDataflow(label('chained mixed constant', ['dollar-access', 'single-bracket-access', 'name-normal', 'numbers']), shell,
				'a[2]$a', emptyGraph().use('0', 'a', { when: 'maybe' })
					.use('0-arg', unnamedArgument('0-arg'))
					.use('2', unnamedArgument('2'))
					.call('3', '[', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
					])
					.returns('3', '0-arg')
					.argument('3', '0-arg')
					.argument('3', '2')
					.reads('3', BuiltIn)
					.reads('0-arg', '0')
					// and now the outer access
					.call('6', '$', [
						{ name: unnamedArgument('3-arg'), nodeId: '3-arg', used: 'always' },
						{ name: unnamedArgument('5'), nodeId: '5', used: 'always' }
					])
					.returns('6', '3-arg')
					.use( '3-arg', unnamedArgument('3-arg'))
					.use('5', unnamedArgument('5'))
					.argument('6', '3-arg')
					.argument('6', '5')
					.reads('6', BuiltIn)
					.reads('3-arg', '3')
					.reads('3-arg', '0')
			)
		})
		assertDataflow(label('Chained bracket access with variables', ['name-normal', 'single-bracket-access']), shell,
			'a[x][y]', emptyGraph().use('0', 'a', { when: 'maybe' })
				.use('0-arg', unnamedArgument('0-arg'))
				.use('2', unnamedArgument('2'))
				.use('1', 'x')
				.reads('2', '1')
				.call('3', '[', [
					{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
					{ name: unnamedArgument('2'), nodeId: '2', used: 'always' }
				])
				.returns('3', '0-arg')
				.argument('3', '0-arg')
				.argument('3', '2')
				.reads('3', BuiltIn)
				.reads('0-arg', '0')
				// and now the outer access
				.call('6', '[', [
					{ name: unnamedArgument('3-arg'), nodeId: '3-arg', used: 'always' },
					{ name: unnamedArgument('5'), nodeId: '5', used: 'always' }
				])
				.returns('6', '3-arg')
				.use( '3-arg', unnamedArgument('3-arg'))
				.use('5', unnamedArgument('5'))
				.use('4', 'y')
				.reads('5', '4')
				.argument('6', '3-arg')
				.argument('6', '5')
				.reads('6', BuiltIn)
				.reads('3-arg', '3')
				.reads('3-arg', '0')
		)
		// TODO: replacement function
		assertDataflow(label('Assign on Access', ['name-normal', 'single-bracket-access', 'local-left-assignment']), shell,
			'a[x] <- 5',
			emptyGraph()
				.defineVariable('0', 'a', { when: 'maybe' })
				.use('1', 'x')
				.use('2', unnamedArgument('2'))
				.reads('0', '2')
				.reads('2', '1')
		)
	})

	describe('Unary Operators', () => {
		for(const op of UnaryOperatorPool) {
			const inputDifferent = `${op}x`
			const opData = OperatorDatabase[op]
			assertDataflow(label(`${op}x`, ['unary-operator', 'name-normal', ...opData.capabilities]), shell,
				inputDifferent,
				emptyGraph().use('0', 'x')
			)
		}
	})

	// these will be more interesting whenever we have more information on the edges (like modification etc.)
	describe('non-assignment binary operators', () => {
		for(const op of BinaryNonAssignmentOperators.filter(x => !startAndEndsWith(x, '%'))) {
			describe(`${op}`, () => {
				const inputDifferent = `x ${op} y`
				assertDataflow(label(`${inputDifferent} (different variables)`, ['binary-operator', 'infix-calls', 'function-calls', 'name-normal']),
					shell,
					inputDifferent,
					emptyGraph().use('0', 'x').use('1', 'y')
				)

				const inputSame = `x ${op} x`
				assertDataflow(label(`${inputSame} (same variables)`, ['binary-operator', 'infix-calls', 'function-calls', 'name-normal']),
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

	describe('Pipes', () => {
		describe('Passing one argument', () => {
			assertDataflow('No parameter function', shell, 'x |> f()',
				emptyGraph()
					.use('0', 'x')
					.call('3', 'f', [argumentInCall('1')])
					.use('1', unnamedArgument('1'))
					.argument('3', '1')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow('Nested calling', shell, 'x |> f() |> g()',
				emptyGraph()
					.use('0', 'x')
					.call('3', 'f', [argumentInCall('1')])
					.call('7', 'g', [argumentInCall('5')])
					.use('1', unnamedArgument('1'))
					.use('5', unnamedArgument('5'))
					.argument('3', '1')
					.argument('7', '5')
					.reads('5', '3')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow('Multi-Parameter function', shell, 'x |> f(y,z)',
				emptyGraph()
					.use('0', 'x')
					.call('7', 'f', [argumentInCall('1'), argumentInCall('4'), argumentInCall('6')])
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

	describe('Assignments Operators', () => {
		for(const op of AssignmentOperators) {
			describe(`${op}`, () => {
				const swapSourceAndTarget = op === '->' || op === '->>'
				const id = swapSourceAndTarget ? '1' : '0'

				let args: FunctionArgument[] = [
					{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
					{ name: unnamedArgument('1-arg'), nodeId: '1-arg', used: 'always' }
				]
				if(swapSourceAndTarget) {
					args = args.reverse()
				}

				const constantAssignment = swapSourceAndTarget ? `5 ${op} x` : `x ${op} 5`
				assertDataflow(`${constantAssignment} (constant assignment)`,
					shell,
					constantAssignment, emptyGraph()
						.defineVariable(id, 'x')
						.call('2', op, args)
						.use('0-arg', unnamedArgument('0-arg'))
						.use('1-arg', unnamedArgument('1-arg'))
						.argument('2', '0-arg')
						.argument('2', '1-arg')
						.reads(`${id}-arg`, id)
						.reads('2',  BuiltIn)
						.returns('2', id)
				)

				const variableAssignment = `x ${op} y`
				const dataflowGraph = emptyGraph()
					.call('2', op, args)
					.use('0-arg', unnamedArgument('0-arg'))
					.use('1-arg', unnamedArgument('1-arg'))
					.argument('2', '0-arg')
					.argument('2', '1-arg')
					.reads('1-arg', '1')
					.reads('0-arg', '0')
					.reads('2',  BuiltIn)
					.returns('2', id)
				if(swapSourceAndTarget) {
					dataflowGraph
						.use('0', 'x')
						.defineVariable('1', 'y')
						.definedBy('1', '0')
				} else {
					dataflowGraph
						.defineVariable('0', 'x')
						.use('1', 'y')
						.definedBy('0', '1')
				}
				assertDataflow(`${variableAssignment} (variable assignment)`,
					shell,
					variableAssignment,
					dataflowGraph
				)

				const circularAssignment = `x ${op} x`

				const circularGraph = emptyGraph()
					.call('2', op, args)
					.use('0-arg', unnamedArgument('0-arg'))
					.use('1-arg', unnamedArgument('1-arg'))
					.argument('2', '0-arg')
					.argument('2', '1-arg')
					.reads('1-arg', '1')
					.reads('0-arg', '0')
					.reads('2',  BuiltIn)
					.returns('2', id)
				if(swapSourceAndTarget) {
					circularGraph
						.use('0', 'x')
						.defineVariable('1', 'x')
						.definedBy('1', '0')
				} else {
					circularGraph
						.defineVariable('0', 'x')
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
		describe('Nested Assignments', () => {
			assertDataflow('"x <- y <- 1"', shell,
				'x <- y <- 1',
				emptyGraph()
					.defineVariable('0', 'x')
					.defineVariable('1', 'y')
					.use('0-arg', unnamedArgument('0-arg'))
					.use('1-arg', unnamedArgument('1-arg'))
					.call('2', '<-', [
						{ name: unnamedArgument('0-arg'), nodeId: '0-arg', used: 'always' },
						{ name: unnamedArgument('1-arg'), nodeId: '1-arg', used: 'always' }
					])
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
					.defineVariable('0', 'x')
					.defineVariable('1', 'y')
					.use('2', 'z')
					.definedBy('0', '1')
					.definedBy('1', '2')
					.definedBy('0', '2')
			)
			assertDataflow('nested global mixed with local assignments', shell,
				'x <<- y <- y2 <<- z',
				emptyGraph()
					.defineVariable('0', 'x')
					.defineVariable('1', 'y')
					.defineVariable('2', 'y2')
					.use('3', 'z')
					.definedBy('0', '1')
					.definedBy('0', '2')
					.definedBy('0', '3')
					.definedBy('1', '2')
					.definedBy('1', '3')
					.definedBy('2', '3')
			)
		})

		describe('known impact assignments', () => {
			describe('loops return invisible null', () => {
				for(const assignment of [ { str: '<-', defId: ['0','0','0'], readId: ['1','1','1'], swap: false },
					{ str: '<<-', defId: ['0','0','0'], readId: ['1','1','1'], swap: false }, { str: '=', defId: ['0','0','0'], readId: ['1','1','1'], swap: false },
					/* two for parenthesis necessary for precedence */
					{ str: '->', defId: ['3', '4', '7'], readId: ['0','0','0'], swap: true }, { str: '->>', defId: ['3', '4', '7'], readId: ['0','0','0'], swap: true }] ) {
					describe(`${assignment.str}`, () => {
						for(const wrapper of [(x: string) => x, (x: string) => `{ ${x} }`]) {
							const build = (a: string, b: string) => assignment.swap ? `(${wrapper(b)}) ${assignment.str} ${a}` : `${a} ${assignment.str} ${wrapper(b)}`

							const repeatCode = build('x', 'repeat x')
							assertDataflow(`"${repeatCode}"`, shell, repeatCode, emptyGraph()
								.defineVariable(assignment.defId[0], 'x')
								.use(assignment.readId[0], 'x')
							)

							const whileCode = build('x', 'while (x) 3')
							assertDataflow(`"${whileCode}"`, shell, whileCode, emptyGraph()
								.defineVariable(assignment.defId[1], 'x')
								.use(assignment.readId[1], 'x'))

							const forCode = build('x', 'for (x in 1:4) 3')
							assertDataflow(`"${forCode}"`, shell, forCode,
								emptyGraph()
									.defineVariable(assignment.defId[2], 'x')
									.defineVariable(assignment.readId[2], 'x')
							)
						}
					})
				}
			})
		})
		describe('assignment with function call', () => {
			const environmentWithX = defaultEnvironment().defineArgument('x', '4', '4')
			assertDataflow('define call with multiple args should only be defined by the call-return', shell, 'a <- foo(x=3,y,z)',
				emptyGraph()
					.defineVariable('0', 'a')
					.call('9', 'foo', [
						argumentInCall('4', 'x'),
						argumentInCall('6'),
						argumentInCall('8')
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

	describe('Pipes', () => {
		describe('Passing one argument', () => {
			assertDataflow(label('No parameter function', ['built-in-pipe-and-pipe-bind']), shell, 'x |> f()',
				emptyGraph()
					.use('0', 'x')
					.call('3', 'f', [
						{ name: unnamedArgument('1'), nodeId: '1', used: 'always' }
					])
					.use('1', unnamedArgument('1'))
					.argument('3', '1')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow(label('Nested calling', ['built-in-pipe-and-pipe-bind', 'call-normal', 'built-in-pipe-and-pipe-bind', 'name-normal']), shell, 'x |> f() |> g()',
				emptyGraph()
					.use('0', 'x')
					.call('3', 'f', [
						{ name: unnamedArgument('1'), nodeId: '1', used: 'always' }
					])
					.call('7', 'g', [
						{ name: unnamedArgument('5'), nodeId: '5', used: 'always' }
					])
					.use('1', unnamedArgument('1'))
					.use('5', unnamedArgument('5'))
					.argument('3', '1')
					.argument('7', '5')
					.reads('5', '3')
					.reads('1', '0'),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow(label('Multi-Parameter function', ['built-in-pipe-and-pipe-bind', 'call-normal', 'built-in-pipe-and-pipe-bind', 'name-normal', 'unnamed-arguments']), shell, 'x |> f(y,z)',
				emptyGraph()
					.use('0', 'x')
					.call('7', 'f', [
						{ name: unnamedArgument('1'), nodeId: '1', used: 'always' },
						{ name: unnamedArgument('4'), nodeId: '4', used: 'always' },
						{ name: unnamedArgument('6'), nodeId: '6', used: 'always' }
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
							.defineVariable('0', 'x')
							.use('3', 'x', { when: 'maybe', environment: defaultEnvironment().defineVariable('x', '0', '2') })
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
		const environmentWithY = defaultEnvironment().defineVariable('y', '0', '2')
		const environmentWithOtherY = defaultEnvironment().defineVariable('y', '4', '6')
		assertDataflow('define call with multiple args should only be defined by the call-return', shell, 'y <- 15; x && (y <- 13); y',
			emptyGraph()
				.defineVariable('0', 'y')
				.defineVariable('4', 'y', { environment: environmentWithY })
				.use('3', 'x', { environment: environmentWithY })
				.use('8', 'y', { environment: environmentWithY.appendWritesOf(environmentWithOtherY) })
				.reads('8', '0')
				.reads('8', '4')
				.sameDef('0', '4')
		)
	})

	describe('loops', () => {
		describe('for', () => {
			assertDataflow('simple constant for-loop', shell,
				'for(i in 1:10) { 1 }',
				emptyGraph().defineVariable('0', 'i')
			)
			assertDataflow('using loop variable in body', shell,
				'for(i in 1:10) { i }',
				emptyGraph()
					.defineVariable('0', 'i')
					.use('4', 'i', { when: 'maybe', environment: defaultEnvironment().defineVariable('i', '0', '6') })
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
