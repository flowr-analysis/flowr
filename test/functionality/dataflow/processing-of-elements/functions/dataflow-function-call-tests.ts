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
			.argument('2', ['1', '0'])
			.sameRead('2', '11')
			.argument('9', '8')
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '4', '5') }, false)
			.call('11', '<-', [argumentInCall('3'), argumentInCall('10')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('i', '0', '2') })
			.argument('11', ['10', '3'])
			.argument('15', '13')
			.call('15', 'a', [argumentInCall('13')], { returns: ['9'], reads: ['3'], environment: defaultEnv().defineVariable('i', '0', '2').defineFunction('a', '3', '11') })
			.calls('15', '10')
			.constant('1')
			.defineVariable('0', 'i', { definedBy: ['1', '2'] })
			.defineVariable('4', 'x', { definedBy: [] }, false)
			.defineFunction('10', '10', ['9'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				breaks:            [],
				nexts:             [],
				returns:           [],
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
					breaks:            [],
					nexts:             [],
					returns:           [],
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
			.argument('2', ['1', '0'])
			.sameRead('2', '17')
			.argument('10', '9')
			.call('10', '<-', [argumentInCall('8'), argumentInCall('9')], { returns: ['8'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineParameter('x', '4', '5') }, false)
			.argument('10', '8')
			.sameRead('10', '13')
			.call('13', '<-', [argumentInCall('11'), argumentInCall('12')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineVariable('x', '8', '10') }, false)
			.argument('13', ['12', '11'])
			.argument('15', '10')
			.argument('15', '13')
			.call('15', '{', [argumentInCall('10'), argumentInCall('13'), argumentInCall('14')], { returns: ['14'], reads: [BuiltIn], environment: defaultEnv().pushEnv().defineVariable('x', '11', '13') }, false)
			.argument('15', '14')
			.call('17', '<-', [argumentInCall('3'), argumentInCall('16')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('i', '0', '2') })
			.argument('17', ['16', '3'])
			.argument('21', '19')
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
				in:                [{ nodeId: '14', name: undefined, controlDependency: [] }],
				unknownReferences: [],
				breaks:            [],
				nexts:             [],
				returns:           [],
				entryPoint:        '15',
				graph:             new Set(['4', '9', '8', '10', '12', '11', '13', '14', '15']),
				environment:       defaultEnv().pushEnv().defineVariable('x', '11', '13')
			})
			.defineVariable('3', 'a', { definedBy: ['16', '17'] })
		)
	})

	describe('Directly calling a function', () => {
		const envWithXParameter = defaultEnv().pushEnv().defineParameter('x', '0', '1')
		const outGraph = emptyGraph()
			.call('9', `${UnnamedFunctionCallPrefix}9`,[argumentInCall('8')])
			.defineFunction('6', '6', ['4'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				breaks:            [],
				nexts:             [],
				returns:           [],
				entryPoint:        '6',
				environment:       envWithXParameter,
				graph:             new Set(['0', '2'])
			},
			{ environment: defaultEnv() })
			.defineVariable('0', 'x', { },  false)
			.use('2', 'x', { }, false)
			.exit('4', '+', { environment: envWithXParameter }, false)
			.relates('2', '4')
			.reads('2', '0')

			.argument('9', '8')
			.calls('9', '6')
			.returns('9', '4')
			.definesOnCall('8', '0')

		assertDataflow('Calling with constant argument using lambda', shell, '(\\(x) { x + 1 })(2)',
			outGraph,
			{ minRVersion: MIN_VERSION_LAMBDA }
		)
		assertDataflow('Calling with constant argument', shell, '(function(x) { x + 1 })(2)',
			outGraph
		)

		const envWithADefined = defaultEnv().defineFunction('a', '0', '6')

		assertDataflow('Calling a function which returns another', shell, `a <- function() { function() { 42 } }
a()()`,
		emptyGraph()
			.call('9', `${UnnamedFunctionCallPrefix}9`, [], { environment: envWithADefined })
			.call('8', 'a', [], { environment: envWithADefined })
			.defineVariable('0', 'a')
			.defineFunction('5', '5', ['3'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				breaks:            [],
				nexts:             [],
				returns:           [],
				entryPoint:        '5',
				environment:       defaultEnv().pushEnv(),
				graph:             new Set(['3'])
			},
			{ environment: defaultEnv() }
			)
			.defineFunction('3', '3', ['1'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				breaks:            [],
				nexts:             [],
				returns:           [],
				entryPoint:        '3',
				environment:       defaultEnv().pushEnv().pushEnv(),
				graph:             new Set()
			},
			{ environment: defaultEnv().pushEnv() }, false)
			.exit('1', '42', { environment: defaultEnv().pushEnv().pushEnv() }, false)
			.calls('9', '8')
			.reads('8', '0')
			.definedBy('0', '5')
			.calls('8', '5')
			.returns('8', '3')
			.calls('9', '3')
			.returns('9', '1')
		)
	})

	describe('Argument which is expression', () => {
		assertDataflow('Calling with 1 + x', shell, 'foo(1 + x)',
			emptyGraph()
				.call('5', 'foo', [argumentInCall('4')], { environment: defaultEnv() })
				.use('2', 'x')
				.reads('4', '2')
				.argument('5', '4')
		)
	})

	describe('Argument which is anonymous function call', () => {
		assertDataflow('Calling with a constant function', shell, 'f(function() { 3 })',
			emptyGraph()
				.call('5', 'f', [argumentInCall('4')], { environment: defaultEnv() })
				.defineFunction('3', '3', ['1'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					breaks:            [],
					nexts:             [],
					returns:           [],
					entryPoint:        '3',
					environment:       defaultEnv().pushEnv(),
					graph:             new Set()
				})
				.exit('1', '3', { environment: defaultEnv().pushEnv() }, false)
				.reads('4', '3')
				.argument('5', '4')
		)
	})

	describe('Multiple out refs in arguments', () => {
		assertDataflow('Calling \'seq\'', shell, 'seq(1, length(pkgnames), by = stepsize)',
			emptyGraph()
				.call('11', 'seq', [argumentInCall('2'), argumentInCall('7'), argumentInCall('10', { name: 'by' })],{ environment: defaultEnv() })
				.use('10', 'by')
				.argument('11', '2')
				.argument('11', '7')
				.argument('11', '10')
				.use('9', 'stepsize' )
				.reads('10', '9')
				.call('6', 'length', [argumentInCall('5')], { environment: defaultEnv() })
				.reads('7', '6')
				.argument('6', '5')
				.use('4', 'pkgnames' )
				.reads('5', '4')

		)
	})

	describe('Late function bindings', () => {
		const innerEnv = defaultEnv().pushEnv()
		const defWithA = defaultEnv().defineFunction('a', '0', '4')
		const defWithAY = defWithA.defineVariable('y', '5', '7')

		assertDataflow('Late binding of y', shell, 'a <- function() { y }\ny <- 12\na()',
			emptyGraph()
				.defineVariable('0', 'a')
				.defineVariable('5', 'y')
				.call('9', 'a', [], { environment: defWithAY })
				.defineFunction('3', '3', ['1'], {
					out:               [],
					in:                [{ nodeId: '1', name: 'y', controlDependency: undefined }],
					unknownReferences: [],
					breaks:            [],
					nexts:             [],
					returns:           [],
					entryPoint:        '3',
					environment:       innerEnv,
					graph:             new Set(['1'])
				})
				.use('1', 'y', { }, false)
				.definedBy('0', '3')
				.calls('9', '3')
				.reads('9', '0')
				.returns('9', '1')
				.reads('9', '5')
		)
	})

	describe('Deal with empty calls', () => {
		const withXParameter = defaultEnv()
			.pushEnv().defineParameter('x', '1', '3')
		const withXYParameter = withXParameter.defineParameter('y', '4', '5')
		const withADefined = defaultEnv().defineFunction('a', '0', '9')

		assertDataflow('Not giving first parameter', shell, `a <- function(x=3,y) { y }
a(,3)`, emptyGraph()
			.call('13', 'a', [
				EmptyArgument,
				{ nodeId: '12', controlDependency: undefined }
			],
			{ environment: withADefined })
			.defineVariable('0', 'a')
			.defineFunction('8', '8', ['6'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				breaks:            [],
				nexts:             [],
				returns:           [],
				entryPoint:        '8',
				environment:       withXYParameter,
				graph:             new Set(['1', '4', '6'])
			},
			{ environment: withXYParameter.popEnv() })
			.defineVariable('1', 'x', { },false)
			.defineVariable('4', 'y', { },false)
			.use('6', 'y', { }, false)
			.reads('6', '4')
			.reads('13', '0')
			.calls('13', '8')
			.definedBy('0', '8')
			.argument('13', '12')
			.returns('13', '6')
			.definesOnCall('12', '4')
		)
	})
	describe('Reuse parameters in call', () => {
		assertDataflow('Not giving first argument', shell, 'a(x=3, x)', emptyGraph()
			.call('6', 'a', [argumentInCall('3', { name: 'x' }), argumentInCall('5')])
			.use('3', 'x')
			.use('4', 'x')
			.argument('6', '3')
			.argument('6', '5')
			.reads('5', '4')
			.reads('4', '3')
		)
	})
	describe('Define in parameters', () => {
		assertDataflow('Support assignments in function calls', shell, 'foo(x <- 3); x', emptyGraph()
			.call('5', 'foo', [argumentInCall('4')])
			.defineVariable('1', 'x')
			.use('6', 'x')
			.argument('5', '4')
			.reads('4', '1')
			.reads('6', '1')
		)
	})
}))
