/**
 * Here we cover dataflow extraction for atomic statements (no expression lists).
 * Yet, some constructs (like for-loops) require the combination of statements, they are included as well.
 * This will not include functions!
 */
import { assertDataflow, withShell } from '../../../_helper/shell'
import { MIN_VERSION_PIPE } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { label } from '../../../_helper/label'
import { emptyGraph } from '../../../_helper/dataflow/dataflowgraph-builder'
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder'
import { AssignmentOperators, BinaryNonAssignmentOperators, UnaryOperatorPool } from '../../../_helper/provider'
import { EmptyArgument, OperatorDatabase } from '../../../../../src'
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data'
import type { FunctionArgument } from '../../../../../src/dataflow'
import { startAndEndsWith } from '../../../../../src/util/strings'
import { BuiltIn } from '../../../../../src/dataflow'

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
			assertDataflow(label(input, [id]), shell, input,
				emptyGraph().constant('0')
			)
		}
	})

	assertDataflow(label('Simple Variable', ['name-normal']), shell,
		'xylophone', emptyGraph().use('0', 'xylophone')
	)

	describe('Access', () => {
		describe('Access with Constant', () => {
			assertDataflow(label('Single Constant', ['name-normal', 'numbers', 'single-bracket-access']),
				shell,'a[2]',  emptyGraph()
					.use('0', 'a', { controlDependency: [] })
					.argument('3', '0')
					.call('3', '[', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: ['0', '1', BuiltIn], onlyBuiltIn: true })
					.argument('3', '1')
					.constant('1')
			)
			assertDataflow(label('double constant', ['name-normal', 'numbers', 'double-bracket-access']),
				shell, 'a[[2]]',  emptyGraph()
					.use('0', 'a', { controlDependency: [] })
					.argument('3', '0')
					.argument('3', '1')
					.constant('1')
					.call('3', '[[', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: ['0', '1', BuiltIn], onlyBuiltIn: true })
			)
			assertDataflow(label('dollar constant', ['name-normal', 'dollar-access']),
				shell, 'a$b',  emptyGraph()
					.use('0', 'a', { controlDependency: [] })
					.argument('3', '0')
					.argument('3', '1')
					.call('3', '$', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: ['0',  BuiltIn], onlyBuiltIn: true })
					.constant('1')
			)
			assertDataflow(label('at constant', ['name-normal', 'slot-access']),
				shell, 'a@b', emptyGraph()
					.use('0', 'a', { controlDependency: [] })
					.argument('3', '0')
					.call('3', '@', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: ['0', BuiltIn], onlyBuiltIn: true })
					.argument('3', '1')
					.constant('1')
			)
			assertDataflow(label('chained constant', ['name-normal', 'numbers', 'single-bracket-access']), shell,
				'a[2][3]', emptyGraph()
					.use('0', 'a', { controlDependency: [] })
					.argument('3', '0')
					.call('3', '[', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn, '0', '1'], onlyBuiltIn: true })
					.argument('3', '1')
					.argument('6', '3')
					.call('6', '[', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: ['3', '4', BuiltIn], onlyBuiltIn: true })
					.argument('6', '4')
					.constant('1')
					.constant('4')

			)
			assertDataflow(label('chained mixed constant', ['dollar-access', 'single-bracket-access', 'name-normal', 'numbers']), shell,
				'a[2]$a', emptyGraph()
					.use('0', 'a', { controlDependency: [] })
					.argument('3', '0')
					.call('3', '[', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn, '0', '1'], onlyBuiltIn: true })
					.argument('3', '1')
					.argument('6', '3')
					.call('6', '$', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: ['3', BuiltIn], onlyBuiltIn: true })
					.argument('6', '4')
					.constant('1')
					.constant('4')
			)
		})
		assertDataflow(label('chained bracket access with variables', ['name-normal', 'single-bracket-access', ...OperatorDatabase['<-'].capabilities]), shell,
			'a[x][y]', emptyGraph()
				.use('0', 'a', { controlDependency: [] })
				.use('1', 'x')
				.use('4', 'y')
				.argument('3', ['0', '1'])
				.call('3', '[', [argumentInCall('0', { controlDependency: [] }), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn, '0', '1'], onlyBuiltIn: true })
				.argument('6', ['3', '4'])
				.call('6', '[', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: ['3', '4', BuiltIn], onlyBuiltIn: true })
		)
		assertDataflow(label('assign on access', ['name-normal', 'single-bracket-access', ...OperatorDatabase['<-'].capabilities, 'replacement-functions']), shell,
			'a[x] <- 5',  emptyGraph()
				.use('1', 'x')
				.call('3', '[<-', [argumentInCall('0'), argumentInCall('1'), argumentInCall('4')], { returns: ['0'], reads: ['1', BuiltIn], onlyBuiltIn: true })
				.constant('4')
				.defineVariable('0', 'a', { definedBy: ['4', '3'] })
		)
	})

	describe('Unary Operators', () => {
		for(const op of UnaryOperatorPool) {
			const inputDifferent = `${op}x`
			const opData = OperatorDatabase[op]
			assertDataflow(label(`${op}x`, ['unary-operator', 'name-normal', ...opData.capabilities]), shell,
				inputDifferent,
				emptyGraph()
					.use('0', 'x')
					.call('1', op, [argumentInCall('0')], { reads: [BuiltIn] })
			)
		}
	})

	// these will be more interesting whenever we have more information on the edges (like modification etc.)
	describe('Non-Assignment Binary Operators', () => {
		for(const op of BinaryNonAssignmentOperators.filter(x => !startAndEndsWith(x, '%'))) {
			describe(`${op}`, () => {
				const inputDifferent = `x ${op} y`
				const inputSame = `x ${op} x`

				const capabilities = OperatorDatabase[op].capabilities
				if(capabilities.includes('non-strict-logical-operators')) {
					assertDataflow(label(`${inputDifferent} (different variables)`, ['name-normal', ...capabilities]),
						shell,
						inputDifferent,
						emptyGraph()
							.use('0', 'x')
							.use('1', 'y', { controlDependency: ['2'] })
							.call('2', op, [argumentInCall('0'), argumentInCall('1', { controlDependency: ['2'] })], { returns: [], reads: [BuiltIn] })
					)

					assertDataflow(label(`${inputSame} (same variables)`, ['name-normal', ...capabilities]),
						shell, inputSame,
						emptyGraph()
							.use('0', 'x')
							.sameRead('0', '1')
							.use('1', 'x', { controlDependency: ['2'] })
							.call('2', op, [argumentInCall('0'), argumentInCall('1', { controlDependency: ['2'] })], { returns: [], reads: [BuiltIn] })
					)
				} else {
					assertDataflow(label(`${inputDifferent} (different variables)`, ['name-normal', ...capabilities]),
						shell,
						inputDifferent,
						emptyGraph()
							.call('2', op, [argumentInCall('0'), argumentInCall('1')], { reads: [BuiltIn] })
							.use('0', 'x').use('1', 'y')
					)

					assertDataflow(label(`${inputSame} (same variables)`, ['name-normal', ...capabilities]),
						shell,
						inputSame,
						emptyGraph()
							.call('2', op, [argumentInCall('0'), argumentInCall('1')], { reads: [BuiltIn] })
							.use('0', 'x').use('1', 'x')
							.sameRead('0', '1')
					)
				}
			})
		}
	})

	describe('Assignment Operators', () => {
		for(const op of AssignmentOperators) {
			describe(`${op}`, () => {
				const swapSourceAndTarget = op === '->' || op === '->>'
				const [variableId, constantId] = swapSourceAndTarget ? ['1', '0'] : ['0', '1']

				const args: FunctionArgument[] = [argumentInCall('0'), argumentInCall('1')]

				const constantAssignment = swapSourceAndTarget ? `5 ${op} x` : `x ${op} 5`
				assertDataflow(label(`${constantAssignment} (constant assignment)`, ['name-normal', ...OperatorDatabase[op].capabilities, 'numbers']),
					shell, constantAssignment,
					emptyGraph()
						.call('2', op, args, { reads: [BuiltIn], returns: [`${variableId}`] })
						.defineVariable(variableId, 'x', { definedBy: [constantId, '2'] })
						.constant(constantId)
				)

				const variableAssignment = `x ${op} y`
				const dataflowGraph = emptyGraph()
					.call('2', op, args, { reads: [BuiltIn], returns: [`${variableId}`] })
				if(swapSourceAndTarget) {
					dataflowGraph
						.use('0', 'x')
						.defineVariable('1', 'y', { definedBy: ['0', '2'] })
				} else {
					dataflowGraph
						.defineVariable('0', 'x', { definedBy: ['1', '2'] })
						.use('1', 'y')
				}
				assertDataflow(label(`${variableAssignment} (variable assignment)`, ['name-normal', ...OperatorDatabase[op].capabilities]),
					shell,
					variableAssignment,
					dataflowGraph
				)

				const circularAssignment = `x ${op} x`

				const circularGraph = emptyGraph()
					.call('2', op, args, { reads: [BuiltIn], returns: [`${variableId}`] })
				if(swapSourceAndTarget) {
					circularGraph
						.use('0', 'x')
						.defineVariable('1', 'x', { definedBy: ['0', '2'] })
				} else {
					circularGraph
						.defineVariable('0', 'x', { definedBy: ['1', '2'] })
						.use('1', 'x')
				}

				assertDataflow(label(`${circularAssignment} (circular assignment)`, ['name-normal', ...OperatorDatabase[op].capabilities, 'return-value-of-assignments']),
					shell, circularAssignment,
					circularGraph
				)
			})
		}
		describe('Nested Assignments', () => {
			assertDataflow(label('"x <- y <- 1"', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments']),
				shell, 'x <- y <- 1', emptyGraph()
					.call('3', '<-', [argumentInCall('1'), argumentInCall('2')], { returns: ['1'], reads: [BuiltIn] })
					.argument('3', ['2', '1'])
					.argument('4', '3')
					.call('4', '<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [BuiltIn] })
					.argument('4', '0')
					.sameRead('4', '3')
					.constant('2')
					.defineVariable('1', 'y', { definedBy: ['2', '3'] })
					.defineVariable('0', 'x', { definedBy: ['3', '4'] })
			)
			assertDataflow(label('"1 -> x -> y"', ['name-normal', 'numbers', 'local-right-assignment', 'return-value-of-assignments']),
				shell, '1 -> x -> y', emptyGraph()
					.call('2', '->', [argumentInCall('0'), argumentInCall('1')], { returns: ['1'], reads: [BuiltIn] })
					.argument('2', ['0', '1'])
					.argument('4', '2')
					.call('4', '->', [argumentInCall('2'), argumentInCall('3')], { returns: ['3'], reads: [BuiltIn] })
					.argument('4', '3')
					.sameRead('4', '2')
					.constant('0')
					.defineVariable('1', 'x', { definedBy: ['0', '2'] })
					.defineVariable('3', 'y', { definedBy: ['2', '4'] })
			)
			assertDataflow(label('"x <- 1 -> y"', ['name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'local-right-assignment', 'return-value-of-assignments']),
				shell, 'x <- 1 -> y', emptyGraph()
					.call('3', '->', [argumentInCall('1'), argumentInCall('2')], { returns: ['2'], reads: [BuiltIn] })
					.argument('3', ['1', '2'])
					.argument('4', '3')
					.call('4', '<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [BuiltIn] })
					.argument('4', '0')
					.constant('1')
					.defineVariable('2', 'y', { definedBy: ['1', '3'] })
					.defineVariable('0', 'x', { definedBy: ['3', '4'] })
			)
			assertDataflow(label('"x <- y <- z"', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments']),
				shell, 'x <- y <- z', emptyGraph()
					.use('2', 'z')
					.argument('3', '2')
					.call('3', '<-', [argumentInCall('1'), argumentInCall('2')], { returns: ['1'], reads: [BuiltIn] })
					.argument('3', '1')
					.argument('4', '3')
					.call('4', '<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [BuiltIn] })
					.argument('4', '0')
					.sameRead('4', '3')
					.defineVariable('1', 'y', { definedBy: ['2', '3'] })
					.defineVariable('0', 'x', { definedBy: ['3', '4'] })
			)
			assertDataflow(label('Nested Global Assignments', ['name-normal', ...OperatorDatabase['<<-'].capabilities, 'return-value-of-assignments']),
				shell, 'x <<- y <<- z', emptyGraph()
					.use('2', 'z')
					.argument('3', '2')
					.call('3', '<<-', [argumentInCall('1'), argumentInCall('2')], { returns: ['1'], reads: [BuiltIn] })
					.argument('3', '1')
					.argument('4', '3')
					.call('4', '<<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [BuiltIn] })
					.argument('4', '0')
					.sameRead('4', '3')
					.defineVariable('1', 'y', { definedBy: ['2', '3'] })
					.defineVariable('0', 'x', { definedBy: ['3', '4'] })
			)
			assertDataflow(label('Nested Global Mixed with Local Assignments', ['name-normal', ...OperatorDatabase['<<-'].capabilities, ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments']),
				shell, 'x <<- y <- y2 <<- z', emptyGraph()
					.use('3', 'z')
					.argument('4', '3')
					.call('4', '<<-', [argumentInCall('2'), argumentInCall('3')], { returns: ['2'], reads: [BuiltIn] })
					.argument('4', '2')
					.sameRead('4', '6')
					.argument('5', '4')
					.call('5', '<-', [argumentInCall('1'), argumentInCall('4')], { returns: ['1'], reads: [BuiltIn] })
					.argument('5', '1')
					.argument('6', '5')
					.call('6', '<<-', [argumentInCall('0'), argumentInCall('5')], { returns: ['0'], reads: [BuiltIn] })
					.argument('6', '0')
					.defineVariable('2', 'y2', { definedBy: ['3', '4'] })
					.defineVariable('1', 'y', { definedBy: ['4', '5'] })
					.defineVariable('0', 'x', { definedBy: ['5', '6'] })
			)
			assertDataflow(label('Use Assignment on Target Side', ['numbers', 'single-bracket-access', 'replacement-functions', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments']),
				shell, 'a[x] <- x <- 3', emptyGraph()
					.use('1', 'x')
					.call('6', '<-', [argumentInCall('4'), argumentInCall('5')], { returns: ['4'], reads: [BuiltIn] })
					.argument('6', ['5', '4'])
					.argument('3', '1')
					.argument('3', '6')
					.call('3', '[<-', [argumentInCall('0'), argumentInCall('1'), argumentInCall('6')], { returns: ['0'], reads: ['1', BuiltIn], onlyBuiltIn: true })
					.argument('3', '0')
					.constant('5')
					.defineVariable('4', 'x', { definedBy: ['5', '6'] })
					.defineVariable('0', 'a', { definedBy: ['6', '3'] })
			)
			assertDataflow(label('Use Assignment on Target Side (inv)', ['numbers', 'single-bracket-access', 'replacement-functions', 'name-normal', 'local-right-assignment', 'return-value-of-assignments']),
				shell, '3 -> x -> a[x]', emptyGraph()
					.use('4', 'x')
					.call('2', '->', [argumentInCall('0'), argumentInCall('1')], { returns: ['1'], reads: [BuiltIn] })
					.argument('2', ['0', '1'])
					.argument('6', '4')
					.argument('6', '2')
					.call('6', '[<-', [argumentInCall('3'), argumentInCall('4'), argumentInCall('2')], { returns: ['3'], reads: ['4', BuiltIn], onlyBuiltIn: true })
					.argument('6', '3')
					.constant('0')
					.defineVariable('1', 'x', { definedBy: ['0', '2'] })
					.defineVariable('3', 'a', { definedBy: ['2', '6'] })
			)
		})

		describe('Known Impact Assignments', () => {
			describe('Loops Return Invisible Null', () => {
				describe('With <-', () => {
					assertDataflow(label('Repeat', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments', 'repeat-loop']),
						shell, 'x <- repeat x', emptyGraph()
							.use('1', 'x')
							.argument('3', '1')
							.call('3', 'repeat', [argumentInCall('1')], { returns: [], reads: [BuiltIn] })
							.nse('3', '1')
							.argument('4', '3')
							.call('4', '<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [BuiltIn] })
							.argument('4', '0')
							.defineVariable('0', 'x', { definedBy: ['3', '4'] })
					)

					assertDataflow(label('While', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments', 'while-loop', 'numbers']),
						shell, 'x <- while (x) 3', emptyGraph()
							.use('1', 'x')
							.argument('4', '1')
							.call('4', 'while', [argumentInCall('1'), argumentInCall('2', { controlDependency: ['4'] })], { returns: [], reads: [BuiltIn, '1'], onlyBuiltIn: true })
							.argument('4', '2')
							.nse('4', '2')
							.argument('5', '4')
							.call('5', '<-', [argumentInCall('0'), argumentInCall('4')], { returns: ['0'], reads: [BuiltIn] })
							.argument('5', '0')
							.constant('2', { controlDependency: ['4'] })
							.defineVariable('0', 'x', { definedBy: ['4', '5'] })
					)

					assertDataflow(label('For', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments', 'for-loop', 'numbers', 'built-in-sequencing']),
						shell, 'x <- for (i in 1:4) 3',  emptyGraph()
							.use('1', 'i')
							.call('4', ':', [argumentInCall('2'), argumentInCall('3')], { returns: [], reads: [BuiltIn] })
							.argument('4', ['2', '3'])
							.argument('7', '1')
							.argument('7', '4')
							.call('7', 'for', [argumentInCall('1'), argumentInCall('4'), argumentInCall('5', { controlDependency: ['7'] })], { returns: [], reads: [BuiltIn, '1', '4'], onlyBuiltIn: true })
							.argument('7', '5')
							.nse('7', '5')
							.argument('8', '7')
							.call('8', '<-', [argumentInCall('0'), argumentInCall('7')], { returns: ['0'], reads: [BuiltIn] })
							.argument('8', '0')
							.constant('2')
							.constant('3')
							.constant('5', { controlDependency: ['7'] })
							.defineVariable('0', 'x', { definedBy: ['7', '8'] })
					)
				})
			})
		})
		describe('Assignment with Function Call', () => {
			assertDataflow(label('define call with multiple args should only be defined by the call-return', ['name-normal', 'numbers', 'unnamed-arguments', 'call-normal', ...OperatorDatabase['<-'].capabilities, 'return-value-of-assignments']),
				shell, 'a <- foo(x=3,y,z)',  emptyGraph()
					.reads('4', '3')
					.use('5', 'y')
					.use('7', 'z')
					.call('9', 'foo', [argumentInCall('4', { name: 'x' }), argumentInCall('5'), argumentInCall('7')], { returns: [], reads: [] })
					.argument('10', '9')
					.call('10', '<-', [argumentInCall('0'), argumentInCall('9')], { returns: ['0'], reads: [BuiltIn] })
					.argument('10', '0')
					.constant('3')
					.defineVariable('0', 'a', { definedBy: ['9', '10'] })
			)
		})
	})

	describe('Pipes', () => {
		describe('Passing one argument', () => {
			assertDataflow(label('No parameter function', ['built-in-pipe-and-pipe-bind', 'name-normal', 'call-normal']),
				shell, 'x |> f()',  emptyGraph()
					.use('0', 'x')
					.argument('3', '0')
					.call('3', 'f', [argumentInCall('0')], { returns: [], reads: [] })
					.argument('4', '0')
					.argument('4', '3')
					.call('4', '|>', [argumentInCall('0'), argumentInCall('3')], { returns: [], reads: [BuiltIn] }),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow(label('Nested calling', ['built-in-pipe-and-pipe-bind', 'call-normal', 'built-in-pipe-and-pipe-bind', 'name-normal']),
				shell, 'x |> f() |> g()', emptyGraph()
					.use('0', 'x')
					.argument('3', '0')
					.call('3', 'f', [argumentInCall('0')], { returns: [], reads: [] })
					.argument('4', '0')
					.argument('4', '3')
					.call('4', '|>', [argumentInCall('0'), argumentInCall('3')], { returns: [], reads: [BuiltIn] })
					.argument('7', '4')
					.call('7', 'g', [argumentInCall('4')], { returns: [], reads: [] })
					.argument('8', '4')
					.argument('8', '7')
					.call('8', '|>', [argumentInCall('4'), argumentInCall('7')], { returns: [], reads: [BuiltIn] }),
				{ minRVersion: MIN_VERSION_PIPE }
			)
			assertDataflow(label('Multi-Parameter function', ['built-in-pipe-and-pipe-bind', 'call-normal', 'built-in-pipe-and-pipe-bind', 'name-normal', 'unnamed-arguments']),
				shell, 'x |> f(y,z)',  emptyGraph()
					.use('0', 'x')
					.use('3', 'y')
					.use('5', 'z')
					.argument('7', '0')
					.argument('7', '3')
					.argument('7', '5')
					.call('7', 'f', [argumentInCall('0'), argumentInCall('3'), argumentInCall('5')], { returns: [], reads: [] })
					.argument('8', '0')
					.argument('8', '7')
					.call('8', '|>', [argumentInCall('0'), argumentInCall('7')], { returns: [], reads: [BuiltIn] }),
				{ minRVersion: MIN_VERSION_PIPE }
			)
		})
	})


	describe('if-then-else', () => {
		// spacing issues etc. are dealt with within the parser; however, braces are not allowed to introduce scoping artifacts
		describe('if-then, no else', () => {
			assertDataflow(label('completely constant', ['if', 'logical', 'numbers']),
				shell, 'if (TRUE) 1',
				emptyGraph()
					.call('3', 'if', [argumentInCall('0'), argumentInCall('1', { controlDependency: ['3'] }), EmptyArgument], { returns: ['1'], reads: ['0', BuiltIn], onlyBuiltIn: true })
					.constant('0')
					.constant('1', { controlDependency: ['3'] })
			)
			assertDataflow(label('Compare Condition', ['if', 'logical', 'numbers', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > 5) 1',  emptyGraph()
					.use('0', 'x')
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('5', 'if', [argumentInCall('2'), argumentInCall('3', { controlDependency: ['5'] }), EmptyArgument], { returns: ['3'], reads: ['2', BuiltIn], onlyBuiltIn: true })
					.constant('1')
					.constant('3', { controlDependency: ['5'] })
			)
			assertDataflow(label('compare cond. symbol in then', ['if', 'logical', 'numbers', 'name-normal', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > 5) y',  emptyGraph()
					.use('0', 'x')
					.use('3', 'y', { controlDependency: ['5'] })
					.argument('2', '0')
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('5', 'if', [argumentInCall('2'), argumentInCall('3', { controlDependency: ['5'] }), EmptyArgument], { returns: ['3'], reads: ['2', BuiltIn], onlyBuiltIn: true })
					.constant('1')
			)
			assertDataflow(label('all variables', ['if', 'logical', 'name-normal', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > y) z',  emptyGraph()
					.use('0', 'x')
					.use('1', 'y')
					.use('3', 'z', { controlDependency: ['5'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('5', 'if', [argumentInCall('2'), argumentInCall('3', { controlDependency: ['5'] }), EmptyArgument], { returns: ['3'], reads: ['2', BuiltIn], onlyBuiltIn: true })
			)
			assertDataflow(label('all variables, some same', ['if', 'logical', 'name-normal', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > y) x', emptyGraph()
					.use('0', 'x')
					.sameRead('0', '3')
					.use('1', 'y')
					.use('3', 'x', { controlDependency: ['5'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('5', 'if', [argumentInCall('2'), argumentInCall('3', { controlDependency: ['5'] }), EmptyArgument], { returns: ['3'], reads: ['2', BuiltIn], onlyBuiltIn: true })
			)
			assertDataflow(label('all same variables', ['if', 'logical', 'name-normal', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > x) x', emptyGraph()
					.use('0', 'x')
					// theoretically, they just have to be connected, so 0 is just hardcoded
					.sameRead('0', ['1', '3'])
					.use('1', 'x')
					.use('3', 'x', { controlDependency: ['5'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('5', 'if', [argumentInCall('2'), argumentInCall('3', { controlDependency: ['5'] }), EmptyArgument], { returns: ['3'], reads: ['2', BuiltIn], onlyBuiltIn: true })
			)
			assertDataflow(label('definition in if', ['if', 'logical', 'name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities]),
				shell, 'if (x <- 3) x', emptyGraph()
					.use('3', 'x', { controlDependency: ['5'] })
					.reads('3', '0')
					.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
					.call('5', 'if', [argumentInCall('2'), argumentInCall('3', { controlDependency: ['5'] }), EmptyArgument], { returns: ['3'], reads: ['2', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
					.constant('1')
					.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			)
		})

		describe('if-then, with else', () => {
			assertDataflow(label('completely constant', ['if', 'logical', 'numbers', 'grouping']),
				shell, 'if (TRUE) { 1 } else { 2 }',
				emptyGraph()
					.call('4', '{', [argumentInCall('3', { controlDependency: ['9'] })], { returns: ['3'], reads: [BuiltIn], controlDependency: ['9'] })
					.argument('4', '3')
					.call('9', 'if', [argumentInCall('0'), argumentInCall('4', { controlDependency: ['9'] }), EmptyArgument], { returns: ['4'], reads: [BuiltIn] })
					.argument('9', ['4', '0'])
					.reads('9', '0')
					.constant('0')
					.constant('3', { controlDependency: ['9'] })
			)
			assertDataflow(label('compare cond.', ['if', 'logical', 'numbers', 'name-normal', 'grouping', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > 5) { 1 } else { 42 }',
				emptyGraph()
					.use('0', 'x')
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('6', '{', [argumentInCall('5', { controlDependency: ['11'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['11'] })
					.sameRead('6', '10')
					.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
					.call('11', 'if', [argumentInCall('2'), argumentInCall('6', { controlDependency: ['11'] }), argumentInCall('10', { controlDependency: ['11'] })], { returns: ['6', '10'], reads: [BuiltIn] })
					.reads('11', '2')
					.constant('1')
					.constant('5', { controlDependency: ['11'] })
					.constant('9', { controlDependency: ['11'] })
			)
			assertDataflow(label('compare cond. symbol in then', ['if', 'logical', 'numbers', 'name-normal', 'grouping', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > 5) { y } else { 42 }',
				emptyGraph()
					.use('0', 'x')
					.use('5', 'y', { controlDependency: ['11'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.argument('2', ['1'])
					.call('6', '{', [argumentInCall('5', { controlDependency: ['11'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['11'] })
					.argument('6', '5')
					.sameRead('6', '10')
					.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
					.argument('10', '9')
					.call('11', 'if', [argumentInCall('2'), argumentInCall('6', { controlDependency: ['11'] }), argumentInCall('10', { controlDependency: ['11'] })], { returns: ['6', '10'], reads: [BuiltIn] })
					.argument('11', ['6', '10', '2'])
					.reads('11', '2')
					.constant('1')
					.constant('9', { controlDependency: ['11'] })
			)
			assertDataflow(label('compare cond. symbol in then & else', ['if', 'logical', 'numbers', 'name-normal', 'grouping', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > 5) { y } else { z }', emptyGraph()
					.use('0', 'x')
					.use('5', 'y', { controlDependency: ['11'] })
					.use('9', 'z', { controlDependency: ['11'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('6', '{', [argumentInCall('5', { controlDependency: ['11'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['11'] })
					.sameRead('6', '10')
					.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
					.call('11', 'if', [argumentInCall('2'), argumentInCall('6', { controlDependency: ['11'] }), argumentInCall('10', { controlDependency: ['11'] })], { returns: ['6', '10'], reads: ['2', BuiltIn], onlyBuiltIn: true })
					.constant('1')
			)
			assertDataflow(label('all variables', ['if', 'logical', 'name-normal', 'grouping', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > y) { z } else { a }', emptyGraph()
					.use('0', 'x')
					.use('1', 'y')
					.use('5', 'z', { controlDependency: ['11'] })
					.use('9', 'a', { controlDependency: ['11'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('6', '{', [argumentInCall('5', { controlDependency: ['11'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['11'] })
					.sameRead('6', '10')
					.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
					.call('11', 'if', [argumentInCall('2'), argumentInCall('6', { controlDependency: ['11'] }), argumentInCall('10', { controlDependency: ['11'] })], { returns: ['6', '10'], reads: ['2', BuiltIn], onlyBuiltIn: true })
			)
			assertDataflow(label('all variables, some same', ['if', 'logical', 'name-normal', 'grouping', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (y > x) { x } else { y }', emptyGraph()
					.use('0', 'y')
					.sameRead('0', '9')
					.use('1', 'x')
					.sameRead('1', '5')
					.use('5', 'x', { controlDependency: ['11'] })
					.use('9', 'y', { controlDependency: ['11'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('6', '{', [argumentInCall('5', { controlDependency: ['11'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['11'] })
					.sameRead('6', '10')
					.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
					.call('11', 'if', [argumentInCall('2'), argumentInCall('6', { controlDependency: ['11'] }), argumentInCall('10', { controlDependency: ['11'] })], { returns: ['6', '10'], reads: ['2', BuiltIn], onlyBuiltIn: true })
			)
			assertDataflow(label('all same variables', ['if', 'logical', 'name-normal', 'grouping', ...OperatorDatabase['>'].capabilities]),
				shell, 'if (x > x) { x } else { x }',  emptyGraph()
					.use('0', 'x')
					.sameRead('0', ['1', '5', '9'])
					.use('1', 'x')
					.use('5', 'x', { controlDependency: ['11'] })
					.use('9', 'x', { controlDependency: ['11'] })
					.call('2', '>', [argumentInCall('0'), argumentInCall('1')], { returns: [], reads: [BuiltIn] })
					.call('6', '{', [argumentInCall('5', { controlDependency: ['11'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['11'] })
					.sameRead('6', '10')
					.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
					.call('11', 'if', [argumentInCall('2'), argumentInCall('6', { controlDependency: ['11'] }), argumentInCall('10', { controlDependency: ['11'] })], { returns: ['6', '10'], reads: ['2', BuiltIn], onlyBuiltIn: true })
			)
		})
	})
	describe('Inline Non-Strict Boolean Operations', () => {
		assertDataflow(label('rhs has to depend on x', ['name-normal', 'logical', 'numbers', 'semicolons', ...OperatorDatabase['&&'].capabilities, ...OperatorDatabase['<-'].capabilities]),
			shell, 'y <- 15; x && (y <- 13); y',
			emptyGraph()
				.use('3', 'x')
				.use('11', 'y')
				.reads('11', ['0', '6'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.argument('2', ['1', '0'])
				.call('8', '<-', [argumentInCall('6', { controlDependency: ['10'] }), argumentInCall('7', { controlDependency: ['10'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('y', '0', '2') })
				.argument('8', ['7', '6'])
				.call('9', '(', [argumentInCall('8', { controlDependency: ['10'] })], { returns: ['8'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('y', '0', '2').defineVariable('y', '6', '8', ['10']) })
				.call('10', '&&', [argumentInCall('3'), argumentInCall('9', { controlDependency: ['10'] })], { returns: [], reads: [BuiltIn], environment: defaultEnv().defineVariable('y', '0', '2').defineVariable('y', '6', '8', ['10']) })
				.argument('10', ['3', '9'])
				.constant('1')
				.defineVariable('0', 'y', { definedBy: ['1', '2'] })
				.constant('7', { controlDependency: ['10'] })
				.defineVariable('6', 'y', { definedBy: ['7', '8'], controlDependency: ['10'] })
		)
	})

	describe('Loops', () => {
		describe('For', () => {
			assertDataflow(label('simple constant for-loop', ['for-loop', 'numbers', 'name-normal', 'built-in-sequencing', 'grouping']),
				shell, 'for(i in 1:10) { 1 }',
				emptyGraph()
					.use('0', 'i')
					.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { returns: [], reads: [BuiltIn] })
					.argument('3', ['1', '2'])
					.call('7', '{', [argumentInCall('6', { controlDependency: ['8'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['8'] })
					.argument('7', '6')
					.nse('8', '7')
					.call('8', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('7', { controlDependency: ['8'] })], { returns: [], reads: [BuiltIn] })
					.reads('8', ['0', '3'])
					.constant('1')
					.constant('2')
					.constant('6', { controlDependency: ['8'] })
			)
			assertDataflow(label('using loop variable in body', ['for-loop', 'numbers', 'name-normal', 'built-in-sequencing', 'grouping']),
				shell, 'for(i in 1:10) { i }',
				emptyGraph()
					.use('0', 'i')
					.sameRead('0', '6')
					.use('6', 'i', { controlDependency: ['8'] })
					.call('3', ':', [argumentInCall('1'), argumentInCall('2')], { returns: [], reads: [BuiltIn] })
					.argument('3', ['1', '2'])
					.call('7', '{', [argumentInCall('6', { controlDependency: ['8'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['8'] })
					.argument('7', '6')
					.nse('8', '7')
					.call('8', 'for', [argumentInCall('0'), argumentInCall('3'), argumentInCall('7', { controlDependency: ['8'] })], { returns: [], reads: [BuiltIn] })
					.argument('8', ['0', '3', '7'])
					.reads('8', ['0', '3'])
					.constant('1')
					.constant('2')
			)
		})

		describe('Repeat', () => {
			assertDataflow(label('simple constant repeat', ['repeat-loop', 'numbers']),
				shell, 'repeat 2',  emptyGraph()
					.call('2', 'repeat', [argumentInCall('0')], { returns: [], reads: [BuiltIn] })
					.nse('2', '0')
					.constant('0')
			)
			assertDataflow(label('using loop variable in body', ['repeat-loop', 'name-normal']),
				shell, 'repeat x',  emptyGraph()
					.use('0', 'x')
					.call('2', 'repeat', [argumentInCall('0')], { returns: [], reads: [BuiltIn] })
					.nse('2', '0')
			)
			assertDataflow(label('using loop variable in body', ['repeat-loop', 'name-normal', 'numbers', ...OperatorDatabase['<-'].capabilities, 'grouping']),
				shell,  'repeat { x <- 1 }',  emptyGraph()
					.call('4', '<-', [argumentInCall('2'), argumentInCall('3')], { returns: ['2'], reads: [BuiltIn] })
					.call('5', '{', [argumentInCall('4')], { returns: ['4'], reads: [BuiltIn] })
					.call('6', 'repeat', [argumentInCall('5')], { returns: [], reads: [BuiltIn] })
					.nse('6', '5')
					.constant('3')
					.defineVariable('2', 'x', { definedBy: ['3', '4'] })
			)
			assertDataflow(label('using variable in body', ['repeat-loop', 'name-normal', ...OperatorDatabase['<-'].capabilities, 'grouping']),
				shell, 'repeat { x <- y }',  emptyGraph()
					.use('3', 'y')
					.call('4', '<-', [argumentInCall('2'), argumentInCall('3')], { returns: ['2'], reads: [BuiltIn] })
					.call('5', '{', [argumentInCall('4')], { returns: ['4'], reads: [BuiltIn] })
					.call('6', 'repeat', [argumentInCall('5')], { returns: [], reads: [BuiltIn] })
					.nse('6', '5')
					.defineVariable('2', 'x', { definedBy: ['3', '4'] })
			)
		})
	})
}))
