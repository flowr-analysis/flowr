import { assertDataflow, withShell } from '../../../_helper/shell'
import { MIN_VERSION_LAMBDA } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { emptyGraph } from '../../../_helper/dataflow/dataflowgraph-builder'
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder'
import {
	UnnamedFunctionCallPrefix
} from '../../../../../src/dataflow/internal/process/functions/call/unnamed-call-handling'
import { EmptyArgument } from '../../../../../src'
import { BuiltIn } from '../../../../../src/dataflow'

describe('Function Call', withShell(shell => {
	describe('Calling previously defined functions', () => {
		assertDataflow('Calling function a', shell, 'i <- 4; a <- function(x) { x }\na(i)',  emptyGraph()
			.use('8', 'x', undefined, false)
			.reads('8', '4')
			.use('13', 'i', undefined)
			.reads('13', '0')
			.definesOnCall('13', '4')
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
			.sameRead('2', '11')
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '4', '5') }, false)
			.call('11', '<-', [argumentInCall('3'), argumentInCall('10')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('i', '0', '2') })
			.call('15', 'a', [argumentInCall('13')], { returns: ['9'], reads: ['3'], environment: defaultEnv().defineVariable('i', '0', '2').defineFunction('a', '3', '11') })
			.calls('15', '10')
			.constant('1')
			.defineVariable('0', 'i', { definedBy: ['1', '2'] })
			.defineVariable('4', 'x', { definedBy: [] }, false)
			.defineFunction('10', '10', ['9'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '9',
				graph:             new Set(['4', '8', '9']),
				environment:       defaultEnv().pushEnv().defineParameter('x', '4', '5')
			})
			.defineVariable('3', 'a', { definedBy: ['10', '11'] })
		)

		assertDataflow('Calling function a with an indirection', shell, 'i <- 4; a <- function(x) { x }\nb <- a\nb(i)',
			emptyGraph()
				.use('8', 'x', undefined, false)
				.reads('8', '4')
				.use('13', 'a', undefined)
				.reads('13', '3')
				.use('16', 'i', undefined)
				.reads('16', '0')
				.definesOnCall('16', '4')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', ['11', '14'])
				.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '4', '5') }, false)
				.call('11', '<-', [argumentInCall('3'), argumentInCall('10')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('i', '0', '2') })
				.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { returns: ['12'], reads: [BuiltIn], environment: defaultEnv().defineVariable('i', '0', '2').defineFunction('a', '3', '11') })
				.call('18', 'b', [argumentInCall('16')], { returns: ['9'], reads: ['12'], environment: defaultEnv().defineVariable('i', '0', '2').defineFunction('a', '3', '11').defineVariable('b', '12', '14') })
				.calls('18', '10')
				.constant('1')
				.defineVariable('0', 'i', { definedBy: ['1', '2'] })
				.defineVariable('4', 'x', { definedBy: [] }, false)
				.defineFunction('10', '10', ['9'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					entryPoint:        '9',
					graph:             new Set(['4', '8', '9']),
					environment:       defaultEnv().pushEnv().defineParameter('x', '4', '5')
				})
				.defineVariable('3', 'a', { definedBy: ['10', '11'] })
				.defineVariable('12', 'b', { definedBy: ['13', '14'] })
		)

		assertDataflow('Calling with a constant function', shell, `i <- 4
a <- function(x) { x <- x; x <- 3; 1 }
a(i)`,  emptyGraph()
			.use('9', 'x', undefined, false)
			.reads('9', '4')
			.use('19', 'i', undefined)
			.reads('19', '0')
			.definesOnCall('19', '4')
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
			.sameRead('2', '17')
			.call('10', '<-', [argumentInCall('8'), argumentInCall('9')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '4', '5') }, false)
			.sameRead('10', '13')
			.call('13', '<-', [argumentInCall('11'), argumentInCall('12')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineVariable('x', '8', '10') }, false)
			.call('15', '{', [argumentInCall('10'), argumentInCall('13'), argumentInCall('14')], { returns: ['14'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineVariable('x', '11', '13') }, false)
			.call('17', '<-', [argumentInCall('3'), argumentInCall('16')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('i', '0', '2') })
			.call('21', 'a', [argumentInCall('19')], { returns: ['15'], reads: ['3'], environment: defaultEnv().defineVariable('i', '0', '2').defineFunction('a', '3', '17') })
			.calls('21', '16')
			.constant('1')
			.defineVariable('0', 'i', { definedBy: ['1', '2'] })
			.defineVariable('4', 'x', { definedBy: [] }, false)
			.sameDef('4', ['8', '11'])
			.defineVariable('8', 'x', { definedBy: ['9', '10'] }, false)
			.sameDef('8', '11')
			.constant('12', undefined, false)
			.defineVariable('11', 'x', { definedBy: ['12', '13'] }, false)
			.constant('14', undefined, false)
			.defineFunction('16', '16', ['15'], {
				out:               [],
				in:                [{ nodeId: '14', name: undefined, controlDependencies: [] }],
				unknownReferences: [],
				entryPoint:        '15',
				graph:             new Set(['4', '9', '8', '10', '12', '11', '13', '14', '15']),
				environment:       defaultEnv().pushEnv().defineVariable('x', '11', '13')
			})
			.defineVariable('3', 'a', { definedBy: ['16', '17'] })
		)
	})

	describe('Directly calling a function', () => {
		const outGraph = emptyGraph()
			.use('6', 'x', undefined, false)
			.reads('6', '2')
			.call('8', '+', [argumentInCall('6'), argumentInCall('7')], { returns: [], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '2', '3') }, false)
			.reads('8', ['6', '7'])
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '2', '3') }, false)
			.call('11', '(', [argumentInCall('10')], { returns: ['10'], reads: [BuiltIn] })
			.call('14', `${UnnamedFunctionCallPrefix}14`, [argumentInCall('12')], { returns: ['9'], reads: ['11'] })
			.calls('14', ['11', '10'])
			.defineVariable('2', 'x', { definedBy: [] }, false)
			.constant('7', undefined, false)
			.defineFunction('10', '10', ['9'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '9',
				graph:             new Set(['2', '6', '7', '8', '9']),
				environment:       defaultEnv().pushEnv().defineParameter('x', '2', '3')
			})
			.constant('12', undefined)
			.definesOnCall('12', '2')

		assertDataflow('Calling with constant argument using lambda', shell, '(\\(x) { x + 1 })(2)',
			outGraph,
			{ minRVersion: MIN_VERSION_LAMBDA }
		)
		assertDataflow('Calling with constant argument', shell, '(function(x) { x + 1 })(2)',
			outGraph
		)

		assertDataflow('Calling a function which returns another', shell, `a <- function() { function() { 42 } }
a()()`,  emptyGraph()
			.call('6', '{', [argumentInCall('5')], { returns: ['5'], reads: [BuiltIn], environment: defaultEnv().pushEnv().pushEnv() }, false)
			.call('8', '{', [argumentInCall('7')], { returns: ['7'], reads: [BuiltIn], environment: defaultEnv().pushEnv() }, false)
			.call('10', '<-', [argumentInCall('0'), argumentInCall('9')], { returns: ['0'], reads: [BuiltIn] })
			.call('12', 'a', [], { returns: ['8'], reads: ['0'], environment: defaultEnv().defineFunction('a', '0', '10') })
			.calls('12', '9')
			.call('13', `${UnnamedFunctionCallPrefix}13`, [], { returns: ['6'], reads: ['12'], environment: defaultEnv().defineFunction('a', '0', '10') })
			.calls('13', ['12', '7'])
			.constant('5', undefined, false)
			.defineFunction('7', '7', ['6'], {
				out:               [],
				in:                [{ nodeId: '5', name: undefined, controlDependencies: [] }],
				unknownReferences: [],
				entryPoint:        '6',
				graph:             new Set(['5', '6']),
				environment:       defaultEnv().pushEnv().pushEnv()
			}, { environment: defaultEnv().pushEnv() }, false)
			.defineFunction('9', '9', ['8'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '8',
				graph:             new Set(['7', '8']),
				environment:       defaultEnv().pushEnv()
			})
			.defineVariable('0', 'a', { definedBy: ['9', '10'] })
		)
	})

	describe('Argument which is expression', () => {
		assertDataflow('Calling with 1 + x', shell, 'foo(1 + x)', emptyGraph()
			.use('2', 'x')
			.call('3', '+', [argumentInCall('1'), argumentInCall('2')], { returns: [], reads: [BuiltIn] })
			.reads('3', ['1', '2'])
			.call('5', 'foo', [argumentInCall('3')], { returns: [], reads: [] })
			.constant('1')
		)
	})

	describe('Argument which is anonymous function call', () => {
		assertDataflow('Calling with a constant function', shell, 'f(function() { 3 })',  emptyGraph()
			.call('4', '{', [argumentInCall('3')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().pushEnv() }, false)
			.call('7', 'f', [argumentInCall('5')], { returns: [], reads: [] })
			.constant('3', undefined, false)
			.defineFunction('5', '5', ['4'], {
				out:               [],
				in:                [{ nodeId: '3', name: undefined, controlDependencies: [] }],
				unknownReferences: [],
				entryPoint:        '4',
				graph:             new Set(['3', '4']),
				environment:       defaultEnv().pushEnv()
			})
		)
	})

	describe('Multiple out refs in arguments', () => {
		assertDataflow('Calling \'seq\'', shell, 'seq(1, length(pkgnames), by = stepsize)',
			emptyGraph()
				.use('4', 'pkgnames')
				.use('9', 'stepsize')
				.use('10', 'by')
				.reads('10', '9')
				.call('6', 'length', [argumentInCall('4')], { returns: [], reads: [] })
				.call('11', 'seq', [argumentInCall('1'), argumentInCall('6'), argumentInCall('10', { name: 'by' } )], { returns: [], reads: [] })
				.argument('11', '10')
				.constant('1')
		)
	})

	describe('Late function bindings', () => {
		assertDataflow('Late binding of y', shell, 'a <- function() { y }\ny <- 12\na()',  emptyGraph()
			.use('3', 'y', undefined, false)
			.call('4', '{', [argumentInCall('3')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().pushEnv() }, false)
			.call('6', '<-', [argumentInCall('0'), argumentInCall('5')], { returns: ['0'], reads: [BuiltIn] })
			.sameRead('6', '9')
			.call('9', '<-', [argumentInCall('7'), argumentInCall('8')], { returns: ['7'], reads: [BuiltIn], environment: defaultEnv().defineFunction('a', '0', '6') })
			.call('11', 'a', [], { returns: ['4'], reads: ['0', '7'], environment: defaultEnv().defineFunction('a', '0', '6').defineVariable('y', '7', '9') })
			.calls('11', '5')
			.defineFunction('5', '5', ['4'], {
				out:               [],
				in:                [{ nodeId: '3', name: 'y', controlDependencies: [] }],
				unknownReferences: [],
				entryPoint:        '4',
				graph:             new Set(['3', '4']),
				environment:       defaultEnv().pushEnv()
			})
			.defineVariable('0', 'a', { definedBy: ['5', '6'] })
			.constant('8')
			.defineVariable('7', 'y', { definedBy: ['8', '9'] })
		)
	})

	describe('Deal with empty calls', () => {
		assertDataflow('Not giving first parameter', shell, `a <- function(x=3,y) { y }
a(,3)`,  emptyGraph()
			.use('8', 'y', undefined, false)
			.reads('8', '4')
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '1', '3').defineParameter('y', '4', '5') }, false)
			.call('11', '<-', [argumentInCall('0'), argumentInCall('10')], { returns: ['0'], reads: [BuiltIn] })
			.call('15', 'a', [EmptyArgument, argumentInCall('13')], { returns: ['9'], reads: ['0'], environment: defaultEnv().defineFunction('a', '0', '11') })
			.calls('15', '10')
			.defineVariable('1', 'x', { definedBy: ['2'] }, false)
			.constant('2', undefined, false)
			.defineVariable('4', 'y', { definedBy: [] }, false)
			.defineFunction('10', '10', ['9'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				entryPoint:        '9',
				graph:             new Set(['1', '2', '4', '8', '9']),
				environment:       defaultEnv().pushEnv().defineParameter('x', '1', '3').defineParameter('y', '4', '5')
			})
			.defineVariable('0', 'a', { definedBy: ['10', '11'] })
			.constant('13')
			.definesOnCall('13', '4')
		)
	})
	describe('Reuse parameters in call', () => {
		assertDataflow('Not giving first argument', shell, 'a(x=3, x)',  emptyGraph()
			.use('3', 'x')
			.reads('3', '2')
			.use('4', 'x')
			.call('6', 'a', [argumentInCall('3', { name: 'x' } ), argumentInCall('4')], { returns: [], reads: [] })
			.argument('6', '3')
			.constant('2')
		)
	})
	describe('Define in parameters', () => {
		assertDataflow('Support assignments in function calls', shell, 'foo(x <- 3); x',  emptyGraph()
			.use('6', 'x')
			.reads('6', '1')
			.call('3', '<-', [argumentInCall('1'), argumentInCall('2')], { returns: ['1'], reads: [BuiltIn] })
			.call('5', 'foo', [argumentInCall('3')], { returns: [], reads: [] })
			.constant('2')
			.defineVariable('1', 'x', { definedBy: ['2', '3'] })
		)
	})
}))