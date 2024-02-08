import { assertDataflow, withShell } from '../../../_helper/shell'
import { DataflowGraph, EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow/v1'
import { define, popLocalEnvironment, pushLocalEnvironment } from '../../../../../src/dataflow/common/environments'
import { UnnamedArgumentPrefix } from '../../../../../src/dataflow/v1/internal/process/functions/argument'
import { UnnamedFunctionCallPrefix } from '../../../../../src/dataflow/v1/internal/process/functions/function-call'
import { LocalScope } from '../../../../../src/dataflow/common/environments/scopes'
import { MIN_VERSION_LAMBDA } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { label } from '../../../_helper/label'

describe('Function Call', withShell(shell => {
	describe('Calling previously defined functions', () => {
		const envWithXParamDefined = define(
			{nodeId: '4', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '5' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		const envWithFirstI = define(
			{nodeId: '0', scope: 'local', name: 'i', used: 'always', kind: 'variable', definedAt: '2' },
			LocalScope,
			initializeCleanEnvironments()
		)
		const envWithIA = define(
			{nodeId: '3', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '9' },
			LocalScope,
			envWithFirstI
		)
		assertDataflow(label('Calling function a', 'local-left-assignment', 'unnamed-arguments', 'normal'), shell, 'i <- 4; a <- function(x) { x }\na(i)',
			new DataflowGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
				.addVertex({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
				.addVertex({ tag: 'use', id: '11', name: 'i', environment: envWithIA })
				.addVertex({ tag: 'use', id: '12', name: `${UnnamedArgumentPrefix}12`, environment: envWithIA })
				.addVertex({
					tag:         'function-call',
					id:          '13',
					name:        'a',
					environment: envWithIA,
					args:        [{
						nodeId: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, used: 'always'
					}] })
				.addVertex({
					tag:         'function-definition',
					id:          '8',
					name:        '8',
					scope:       LocalScope,
					exitPoints:  [ '6' ],
					environment: popLocalEnvironment(envWithXParamDefined),
					subflow:     {
						out:               [],
						in:                [],
						unknownReferences: [],
						scope:             LocalScope,
						environments:      envWithXParamDefined,
						graph:             new Set(['4', '6']),
					}})
				.addVertex({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.addVertex({ tag: 'use', id: '6', name: 'x', environment: envWithXParamDefined}, false)
				.addEdge('6', '4', EdgeType.Reads, 'always')
				.addEdge('11', '0', EdgeType.Reads, 'always')
				.addEdge('3', '8', EdgeType.DefinedBy, 'always')
				.addEdge('13', '12', EdgeType.Argument, 'always')
				.addEdge('12', '11', EdgeType.Reads, 'always')
				.addEdge('13', '3', EdgeType.Reads, 'always')
				.addEdge('13', '8', EdgeType.Calls, 'always')
				.addEdge('13', '6', EdgeType.Returns, 'always')
				.addEdge('12', '4', EdgeType.DefinesOnCall, 'always')
		)
		const envWithIAB = define(
			{nodeId: '10', scope: 'local', name: 'b', used: 'always', kind: 'variable', definedAt: '12' },
			LocalScope,
			envWithIA
		)
		assertDataflow(label('Calling function a with an indirection', 'local-left-assignment', 'unnamed-arguments', 'normal'), 
		shell, 
		'i <- 4; a <- function(x) { x }\nb <- a\nb(i)',
			new DataflowGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
				.addVertex({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
				.addVertex({ tag: 'variable-definition', id: '10', name: 'b', scope: LocalScope, environment: envWithIA })
				.addVertex({ tag: 'use', id: '11', name: 'a', scope: LocalScope, environment: envWithIA })
				.addVertex({ tag: 'use', id: '14', name: 'i', environment: envWithIAB })
				.addVertex({ tag: 'use', id: '15', name: `${UnnamedArgumentPrefix}15`, environment: envWithIAB })
				.addVertex({
					tag:         'function-call',
					id:          '16',
					name:        'b',
					environment: envWithIAB,
					args:        [{
						nodeId: '15', name: `${UnnamedArgumentPrefix}15`, scope: LocalScope, used: 'always'
					}] })
				.addVertex({
					tag:         'function-definition',
					id:          '8',
					name:        '8',
					scope:       LocalScope,
					exitPoints:  [ '6' ],
					environment: popLocalEnvironment(envWithXParamDefined),
					subflow:     {
						out:               [],
						in:                [],
						unknownReferences: [],
						scope:             LocalScope,
						environments:      envWithXParamDefined,
						graph:             new Set(['4', '6'])
					}})
				.addVertex({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.addVertex({ tag: 'use', id: '6', name: 'x', environment: envWithXParamDefined}, false)
				.addEdge('6', '4', EdgeType.Reads, 'always')
				.addEdge('14', '0', EdgeType.Reads, 'always')
				.addEdge('3', '8', EdgeType.DefinedBy, 'always')
				.addEdge('10', '11', EdgeType.DefinedBy, 'always')
				.addEdge('11', '3', EdgeType.Reads, 'always')
				.addEdge('16', '15', EdgeType.Argument, 'always')
				.addEdge('15', '14', EdgeType.Reads, 'always')
				.addEdge('16', '10', EdgeType.Reads, 'always')
				.addEdge('16', '8', EdgeType.Calls, 'always')
				.addEdge('16', '6', EdgeType.Returns, 'always')
				.addEdge('15', '4', EdgeType.DefinesOnCall, 'always')
		)
		const envWithXConstDefined = define(
			{nodeId: '4', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '5' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))

		const envWithXDefinedForFunc = define(
			{nodeId: '6', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '8' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))

		const envWithLastXDefined = define(
			{nodeId: '9', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '11' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		const envWithIAndLargeA = define(
			{nodeId: '3', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '15' },
			LocalScope,
			envWithFirstI
		)
		assertDataflow(label('Calling with a constant function', 'unnamed-arguments', 'normal'), shell, `i <- 4
a <- function(x) { x <- x; x <- 3; 1 }
a(i)`, new DataflowGraph()
			.addVertex({ tag: 'variable-definition', id: '0', name: 'i', scope: LocalScope })
			.addVertex({ tag: 'variable-definition', id: '3', name: 'a', scope: LocalScope, environment: envWithFirstI })
			.addVertex({ tag: 'use', id: '17', name: 'i', environment: envWithIAndLargeA})
			.addVertex({ tag: 'use', id: '18', name: `${UnnamedArgumentPrefix}18`, environment: envWithIAndLargeA})
			.addEdge('17', '0', EdgeType.Reads, 'always')
			.addVertex({
				tag:         'function-call',
				id:          '19',
				name:        'a',
				environment: envWithIAndLargeA,
				args:        [{
					nodeId: '18', name: `${UnnamedArgumentPrefix}18`, scope: LocalScope, used: 'always'
				}]})
			.addVertex({
				tag:         'function-definition',
				id:          '14',
				name:        '14',
				environment: initializeCleanEnvironments(),
				scope:       LocalScope,
				exitPoints:  [ '12' ],
				subflow:     {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      envWithLastXDefined,
					graph:             new Set(['4', '6', '7', '9'])
				}})
			.addVertex({ tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
			.addVertex({ tag: 'variable-definition', id: '6', name: 'x', scope: LocalScope, environment: envWithXConstDefined }, false)
			.addVertex({ tag: 'variable-definition', id: '9', name: 'x', scope: LocalScope, environment: envWithXDefinedForFunc }, false)
			.addVertex({ tag: 'use', id: '7', name: 'x', environment: envWithXConstDefined}, false)
			.addVertex({ tag: 'exit-point', id: '12', name: '1', environment: envWithLastXDefined}, false)
			.addEdge('6', '7', EdgeType.DefinedBy, 'always')
			.addEdge('7', '4', EdgeType.Reads, 'always')
			.addEdge('6', '9', EdgeType.SameDefDef, 'always')
			.addEdge('4', '9', EdgeType.SameDefDef, 'always')
			.addEdge('4', '6', EdgeType.SameDefDef, 'always')

			.addEdge('3', '14', EdgeType.DefinedBy, 'always')
			.addEdge('19', '18', EdgeType.Argument, 'always')
			.addEdge('18', '17', EdgeType.Reads, 'always')
			.addEdge('19', '3', EdgeType.Reads, 'always')
			.addEdge('19', '14', EdgeType.Calls, 'always')
			.addEdge('19', '12', EdgeType.Returns, 'always')
			.addEdge('18', '4', EdgeType.DefinesOnCall, 'always')
		)
	})

	describe('Directly calling a function', () => {
		const envWithXParameter = define(
			{nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const outGraph = new DataflowGraph()
			.addVertex({
				tag:  'function-call',
				id:   '9',
				name: `${UnnamedFunctionCallPrefix}9`,
				args: [
					{ nodeId: '8', name: `${UnnamedArgumentPrefix}8`, scope: LocalScope, used: 'always' }
				]
			})
			.addVertex({
				tag:         'function-definition',
				id:          '6',
				name:        '6',
				environment: initializeCleanEnvironments(),
				scope:       LocalScope,
				exitPoints:  [ '4' ],
				subflow:     {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      envWithXParameter,
					graph:             new Set(['0', '2'])
				}
			})
			.addVertex({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
			.addVertex({ tag: 'use', id: '2', name: 'x', environment: envWithXParameter }, false)
			.addVertex({ tag: 'exit-point', id: '4', name: '+', environment: envWithXParameter }, false)
			.addEdge('2', '4', EdgeType.Relates, 'always')
			.addEdge('2', '0', EdgeType.Reads, 'always')

			.addVertex({ tag: 'use', id: '8', name: `${UnnamedArgumentPrefix}8`})
			.addEdge('9', '8', EdgeType.Argument, 'always')
			.addEdge('9', '6', EdgeType.Calls, 'always')
			.addEdge('9', '4', EdgeType.Returns, 'always')
			.addEdge('8', '0', EdgeType.DefinesOnCall, 'always')

		assertDataflow('Calling with constant argument using lambda', shell, '(\\(x) { x + 1 })(2)',
			outGraph,
			{ minRVersion: MIN_VERSION_LAMBDA }
		)
		assertDataflow('Calling with constant argument', shell, '(function(x) { x + 1 })(2)',
			outGraph
		)

		const envWithADefined = define(
			{nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '6' },
			LocalScope,
			initializeCleanEnvironments()
		)

		assertDataflow('Calling a function which returns another', shell, `a <- function() { function() { 42 } }
a()()`,
		new DataflowGraph()
			.addVertex({
				tag:         'function-call',
				id:          '9',
				name:        `${UnnamedFunctionCallPrefix}9`,
				environment: envWithADefined,
				args:        []
			})
			.addVertex({
				tag:         'function-call',
				id:          '8',
				name:        'a',
				environment: envWithADefined,
				args:        []
			})
			.addVertex({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
			.addVertex({
				tag:         'function-definition',
				id:          '5',
				name:        '5',
				environment: initializeCleanEnvironments(),
				scope:       LocalScope,
				exitPoints:  [ '3' ],
				subflow:     {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      pushLocalEnvironment(initializeCleanEnvironments()),
					graph:             new Set(['3'])

				}
			})
			.addVertex({
				tag:         'function-definition',
				id:          '3',
				name:        '3',
				environment: pushLocalEnvironment(initializeCleanEnvironments()),
				scope:       LocalScope,
				exitPoints:  [ '1' ],
				subflow:     {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())),
					graph:             new Set()
				}
			}, false)

			.addVertex({ tag: 'exit-point', id: '1', name: '42', environment: pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())) }, false)


			.addEdge('9', '8', EdgeType.Calls, 'always')
			.addEdge('8', '0', EdgeType.Reads, 'always')
			.addEdge('0', '5', EdgeType.DefinedBy, 'always')
			.addEdge('8', '5', EdgeType.Calls, 'always')
			.addEdge('8', '3', EdgeType.Returns, 'always')
			.addEdge('9', '3', EdgeType.Calls, 'always')
			.addEdge('9', '1', EdgeType.Returns, 'always')
		)
	})

	describe('Argument which is expression', () => {
		assertDataflow('Calling with 1 + x', shell, 'foo(1 + x)',
			new DataflowGraph()
				.addVertex({ tag: 'function-call', id: '5', name: 'foo', environment: initializeCleanEnvironments(), args: [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }]})
				.addVertex({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`})
				.addVertex({ tag: 'use', id: '2', name: 'x'})
				.addEdge('4', '2', EdgeType.Reads, 'always')
				.addEdge('5', '4', EdgeType.Argument, 'always')
		)
	})

	describe('Argument which is anonymous function call', () => {
		assertDataflow('Calling with a constant function', shell, 'f(function() { 3 })',
			new DataflowGraph()
				.addVertex({ tag: 'function-call', id: '5', name: 'f', environment: initializeCleanEnvironments(), args: [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }]})
				.addVertex({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`})
				.addVertex({
					tag:        'function-definition',
					id:         '3',
					name:       '3',
					scope:      LocalScope,
					exitPoints: [ '1' ],
					subflow:    {
						out:               [],
						in:                [],
						unknownReferences: [],
						scope:             LocalScope,
						environments:      pushLocalEnvironment(initializeCleanEnvironments()),
						graph:             new Set()
					}})
				.addVertex({ tag: 'exit-point', id: '1', name: '3', environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)

				.addEdge('4', '3', EdgeType.Reads, 'always')
				.addEdge('5', '4', EdgeType.Argument, 'always')
		)
	})

	describe('Multiple out refs in arguments', () => {
		assertDataflow('Calling \'seq\'', shell, 'seq(1, length(pkgnames), by = stepsize)',
			new DataflowGraph()
				.addVertex({
					tag:         'function-call',
					id:          '11',
					name:        'seq',
					environment: initializeCleanEnvironments(),
					args:        [
						{ nodeId: '2', name: `${UnnamedArgumentPrefix}2`, scope: LocalScope, used: 'always' },
						{ nodeId: '7', name: `${UnnamedArgumentPrefix}7`, scope: LocalScope, used: 'always' },
						['by', { nodeId: '10', name: 'by', scope: LocalScope, used: 'always' }],
					]
				})
				.addVertex({ tag: 'use', id: '2', name: `${UnnamedArgumentPrefix}2`})
				.addVertex({ tag: 'use', id: '7', name: `${UnnamedArgumentPrefix}7`})
				.addVertex({ tag: 'use', id: '10', name: 'by'})
				.addEdge('11', '2', EdgeType.Argument, 'always')
				.addEdge('11', '7', EdgeType.Argument, 'always')
				.addEdge('11', '10', EdgeType.Argument, 'always')
				.addVertex({ tag: 'use', id: '9', name: 'stepsize' })
				.addEdge('10', '9', EdgeType.Reads, 'always')
				.addVertex({
					tag:         'function-call',
					id:          '6',
					name:        'length',
					environment: initializeCleanEnvironments(),
					args:        [
						{ nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' }
					]
				})
				.addEdge('7', '6', EdgeType.Reads, 'always')
				.addVertex({ tag: 'use', id: '5', name: `${UnnamedArgumentPrefix}5`})
				.addEdge('6', '5', EdgeType.Argument, 'always')
				.addVertex({ tag: 'use', id: '4', name: 'pkgnames' })
				.addEdge('5', '4', EdgeType.Reads, 'always')

		)
	})

	describe('Late function bindings', () => {
		const innerEnv = pushLocalEnvironment(initializeCleanEnvironments())
		const defWithA = define(
			{ nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '4' },
			LocalScope,
			initializeCleanEnvironments()
		)
		const defWithAY = define(
			{ nodeId: '5', scope: 'local', name: 'y', used: 'always', kind: 'variable', definedAt: '7' },
			LocalScope,
			defWithA
		)

		assertDataflow('Late binding of y', shell, 'a <- function() { y }\ny <- 12\na()',
			new DataflowGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
				.addVertex({
					tag:         'variable-definition',
					id:          '5',
					name:        'y',
					scope:       LocalScope,
					environment: defWithA})
				.addVertex({
					tag:         'function-call',
					id:          '9',
					name:        'a',
					environment: defWithAY,
					args:        []
				})
				.addVertex({
					tag:        'function-definition',
					id:         '3',
					name:       '3',
					scope:      LocalScope,
					exitPoints: [ '1' ],
					subflow:    {
						out:               [],
						in:                [{ nodeId: '1', name: 'y', scope: LocalScope, used: 'always' }],
						unknownReferences: [],
						scope:             LocalScope,
						environments:      innerEnv,
						graph:             new Set(['1'])
					}})
				.addVertex({ tag: 'use', id: '1', name: 'y', scope: LocalScope, environment: innerEnv }, false)

				.addEdge('0', '3', EdgeType.DefinedBy, 'always')
				.addEdge('9', '3', EdgeType.Calls, 'always')
				.addEdge('9', '0', EdgeType.Reads, 'always')
				.addEdge('9', '1', EdgeType.Returns, 'always')
				.addEdge('9', '5', EdgeType.Reads, 'always')
		)
	})

	describe('Deal with empty calls', () => {
		const withXParameter = define(
			{ nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '3' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const withXYParameter = define(
			{ nodeId: '4', scope: 'local', name: 'y', used: 'always', kind: 'parameter', definedAt: '5' },
			LocalScope,
			withXParameter
		)
		const withADefined = define(
			{ nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '9' },
			LocalScope,
			initializeCleanEnvironments()
		)
		assertDataflow('Not giving first parameter', shell, `a <- function(x=3,y) { y }
a(,3)`, new DataflowGraph()
			.addVertex({
				tag:         'function-call',
				id:          '13',
				name:        'a',
				environment: withADefined,
				args:        [
					'empty',
					{ nodeId: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, used: 'always' }
				]
			})
			.addVertex({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
			.addVertex({
				tag:         'function-definition',
				id:          '8',
				scope:       LocalScope,
				name:        '8',
				exitPoints:  [ '6' ],
				environment: popLocalEnvironment(withXYParameter),
				subflow:     {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      withXYParameter,
					graph:             new Set(['1', '4', '6'])
				}
			})
			.addVertex({ tag: 'variable-definition', id: '1', name: 'x', scope: LocalScope, environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
			.addVertex({ tag: 'variable-definition', id: '4', name: 'y', scope: LocalScope, environment: withXParameter }, false)
			.addVertex({ tag: 'use', id: '6', name: 'y', scope: LocalScope, environment: withXYParameter }, false)
			.addEdge('6', '4', EdgeType.Reads, 'always')

			.addVertex({ tag: 'use', id: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, environment: withADefined })
			.addEdge('13', '0', EdgeType.Reads, 'always')
			.addEdge('13', '8', EdgeType.Calls, 'always')
			.addEdge('0', '8', EdgeType.DefinedBy, 'always')
			.addEdge('13', '12', EdgeType.Argument, 'always')
			.addEdge('13', '6', EdgeType.Returns, 'always')
			.addEdge('12', '4', EdgeType.DefinesOnCall, 'always')
		)
	})
	describe('Reuse parameters in call', () => {
		const envWithX = define(
			{ nodeId: '3', scope: 'local', name: 'x', used: 'always', kind: EdgeType.Argument, definedAt: '3' },
			LocalScope,
			initializeCleanEnvironments()
		)
		assertDataflow('Not giving first argument', shell, 'a(x=3, x)', new DataflowGraph()
			.addVertex({
				tag:  'function-call',
				id:   '6',
				name: 'a',
				args: [
					['x', { nodeId: '3', name: 'x', scope: LocalScope, used: 'always' }],
					{ nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' },
				]
			})
			.addVertex({ tag: 'use', id: '3', name: 'x', scope: LocalScope })
			.addVertex({
				tag:         'use',
				id:          '5',
				name:        `${UnnamedArgumentPrefix}5`,
				scope:       LocalScope,
				environment: envWithX
			})
			.addVertex({ tag: 'use', id: '4', name: 'x', environment: envWithX })
			.addEdge('6', '3', EdgeType.Argument, 'always')
			.addEdge('6', '5', EdgeType.Argument, 'always')
			.addEdge('5', '4', EdgeType.Reads, 'always')
			.addEdge('4', '3', EdgeType.Reads, 'always')
		)
	})
	describe('Define in parameters', () => {
		assertDataflow('Support assignments in function calls', shell, 'foo(x <- 3); x', new DataflowGraph()
			.addVertex({
				tag:   'function-call',
				id:    '5',
				name:  'foo',
				scope: LocalScope,
				args:  [
					{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }
				]
			})
			.addVertex({ tag: 'use', id: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope })
			.addVertex({ tag: 'variable-definition', id: '1', name: 'x', scope: LocalScope })
			.addVertex({
				tag:         'use',
				id:          '6',
				name:        'x',
				scope:       LocalScope,
				environment: define(
					{ nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '3' },
					LocalScope,
					initializeCleanEnvironments()
				) })
			.addEdge('5', '4', EdgeType.Argument, 'always')
			.addEdge('4', '1', EdgeType.Reads, 'always')
			.addEdge('6', '1', EdgeType.Reads, 'always')
		)
	})
}))
