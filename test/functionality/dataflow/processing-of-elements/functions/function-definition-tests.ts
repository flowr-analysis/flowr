import { assertDataflow, withShell } from '../../../_helper/shell'
import { BuiltIn, DataflowGraph, EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow'
import {
	define,
	popLocalEnvironment,
	pushLocalEnvironment
} from '../../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../../src/dataflow/internal/process/functions/argument'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/environments/scopes'

describe('Function Definition', withShell(shell => {
	describe('Only functions', () => {
		assertDataflow('unknown read in function', shell, 'function() { x }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '2',
					name:       '2',
					scope:      LocalScope,
					when:       'always',
					exitPoints: ['0'],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [{ nodeId: '0', used: 'always', name: 'x', scope: LocalScope }],
						scope:             LocalScope,
						graph:             new Set(['0']),
						environments:      pushLocalEnvironment(initializeCleanEnvironments())
					}
				}).addVertex({
					tag:         'use',
					id:          '0',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					when:        'always'
				}, false)
		)

		const envWithXDefined = define(
			{ nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('read of parameter', shell, 'function(x) { x }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '4',
					name:       '4',
					scope:      LocalScope,
					when:       'always',
					exitPoints: ['2'],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['0', '2']),
						environments:      envWithXDefined
					}
				})
				.addVertex({
					tag:         'variable-definition',
					id:          '0',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					scope:       LocalScope,
					when:        'always'
				}, false)
				.addVertex({
					tag:         'use',
					id:          '2',
					name:        'x',
					environment: envWithXDefined,
					when:        'always'
				}, false)
				.addEdge('2', '0', EdgeType.Reads, 'always')
		)
		assertDataflow('read of parameter in return', shell, 'function(x) { return(x) }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '7',
					name:       '7',
					scope:      LocalScope,
					when:       'always',
					exitPoints: ['5'],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['4', '5', '3', '0']),
						environments:      envWithXDefined
					}
				}).addVertex({
					tag:         'variable-definition',
					id:          '0',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					scope:       LocalScope,
					when:        'always'
				}, false)
				.addVertex({
					tag:         'use',
					id:          '3',
					name:        'x',
					environment: envWithXDefined,
					when:        'always'
				}, false)
				.addVertex({
					tag:         'function-call',
					id:          '5',
					name:        'return',
					environment: envWithXDefined,
					when:        'always',
					args:        [{ nodeId: '4', used: 'always', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope }]
				}, false)
				.addVertex({
					tag:         'use',
					id:          '4',
					name:        `${UnnamedArgumentPrefix}4`,
					environment: envWithXDefined,
					when:        'always',
				}, false)
				.addEdge('5', BuiltIn, EdgeType.Reads, 'always')
				.addEdge('5', BuiltIn, EdgeType.Calls, 'always')
				.addEdge('3', '0', EdgeType.Reads, 'always')
				.addEdge('5', '4', EdgeType.Argument, 'always')
				.addEdge('5', '4', EdgeType.Returns, 'always')
				.addEdge('4', '3', EdgeType.Reads, 'always')
		)

		describe('x', () => {
			assertDataflow('return parameter named', shell, 'function(x) { return(x=x) }',
				new DataflowGraph()
					.addVertex({
						tag:        'function-definition',
						id:         '8',
						name:       '8',
						scope:      LocalScope,
						when:       'always',
						exitPoints: ['6'],
						subflow:    {
							out:               [],
							unknownReferences: [],
							in:                [],
							scope:             LocalScope,
							graph:             new Set(['5', '6', '4', '0']),
							environments:      envWithXDefined
						}
					}).addVertex({
						tag:         'variable-definition',
						id:          '0',
						name:        'x',
						environment: pushLocalEnvironment(initializeCleanEnvironments()),
						scope:       LocalScope,
						when:        'always'
					}, false)
					.addVertex({
						tag:         'use',
						id:          '4',
						name:        'x',
						environment: envWithXDefined,
						when:        'always'
					}, false)
					.addVertex({
						tag:         'function-call',
						id:          '6',
						name:        'return',
						environment: envWithXDefined,
						when:        'always',
						args:        [['x', { nodeId: '5', used: 'always', name: 'x', scope: LocalScope }]]
					}, false)
					.addVertex({
						tag:         'use',
						id:          '5',
						name:        'x',
						environment: envWithXDefined,
						when:        'always',
					}, false)
					.addEdge('6', BuiltIn, EdgeType.Reads, 'always')
					.addEdge('6', BuiltIn, EdgeType.Calls, 'always')
					.addEdge('4', '0', EdgeType.Reads, 'always')
					.addEdge('6', '5', EdgeType.Argument, 'always')
					.addEdge('6', '5', EdgeType.Returns, 'always')
					.addEdge('5', '4', EdgeType.Reads, 'always')
			)
		})

		const envWithoutParams = pushLocalEnvironment(initializeCleanEnvironments())
		const envWithXParam = define(
			{ nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			envWithoutParams
		)
		const envWithXYParam = define(
			{ nodeId: '2', scope: 'local', name: 'y', used: 'always', kind: 'parameter', definedAt: '3' },
			LocalScope,
			envWithXParam
		)
		const envWithXYZParam = define(
			{ nodeId: '4', scope: 'local', name: 'z', used: 'always', kind: 'parameter', definedAt: '5' },
			LocalScope,
			envWithXYParam
		)

		assertDataflow('read of one parameter', shell, 'function(x,y,z) y',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '8',
					name:       '8',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '6' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['0','2', '4', '6']),
						environments:      envWithXYZParam
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', environment: envWithoutParams, scope: LocalScope, when: 'always' }, false)
				.addVertex({ tag: 'variable-definition', id: '2', name: 'y', environment: envWithXParam, scope: LocalScope, when: 'always' }, false)
				.addVertex({ tag: 'variable-definition', id: '4', name: 'z', environment: envWithXYParam, scope: LocalScope, when: 'always' }, false)
				.addVertex( { tag: 'use', id: '6', name: 'y', environment: envWithXYZParam, when: 'always' }, false)
				.addEdge('6', '2', EdgeType.Reads, 'always')
		)
	})
	describe('Scoping of body', () => {
		assertDataflow('previously defined read in function', shell, 'x <- 3; function() { x }',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex({
					tag:        'function-definition',
					id:         '5',
					name:       '5',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '3' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [ { nodeId: '3', scope: LocalScope, name: 'x', used: 'always' } ],
						scope:             LocalScope,
						graph:             new Set(['3']),
						environments:      pushLocalEnvironment(initializeCleanEnvironments())
					}
				})
				.addVertex( { tag: 'use', id: '3', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), when: 'always' }, false)
		)
		const envWithXDefined = define(
			{nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))

		assertDataflow('local define with <- in function, read after', shell, 'function() { x <- 3; }; x',
			new DataflowGraph()
				.addVertex( { tag: 'use', id: '5', name: 'x' })
				.addVertex({
					tag:        'function-definition',
					id:         '4',
					name:       '4',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '2' /* the assignment */ ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['0']),
						environments:      envWithXDefined
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }, false)
				.addVertex({ tag: 'exit-point', id: '2', name: '<-', when: 'always', environment: envWithXDefined }, false)
				.addEdge('2', '0', EdgeType.Relates, 'always')
		)
		assertDataflow('local define with = in function, read after', shell, 'function() { x = 3; }; x',
			new DataflowGraph()
				.addVertex( { tag: 'use', id: '5', name: 'x' })
				.addVertex({
					tag:        'function-definition',
					id:         '4',
					name:       '4',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '2', ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['0']),
						environments:      envWithXDefined
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }, false)
				.addVertex({ tag: 'exit-point', id: '2', name: '=', when: 'always', environment: envWithXDefined }, false)
				.addEdge('2', '0', EdgeType.Relates, 'always')
		)

		const envWithXDefinedR = define(
			{nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('local define with -> in function, read after', shell, 'function() { 3 -> x; }; x',
			new DataflowGraph()
				.addVertex( { tag: 'use', id: '5', name: 'x' })
				.addVertex({
					tag:        'function-definition',
					id:         '4',
					name:       '4',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '2' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['1']),
						environments:      envWithXDefinedR
					}
				})
				.addVertex({ tag: 'variable-definition', id: '1', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }, false)
				.addVertex({ tag: 'exit-point', id: '2', name: '->', when: 'always', environment: envWithXDefinedR }, false)
				.addEdge('2', '1', EdgeType.Relates, 'always')
		)
		const envWithXDefinedGlobal = define(
			{nodeId: '0', scope: GlobalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			GlobalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('global define with <<- in function, read after', shell, 'function() { x <<- 3; }; x',
			new DataflowGraph()
				.addVertex( { tag: 'use', id: '5', name: 'x' })
				.addVertex({
					tag:         'function-definition',
					id:          '4',
					name:        '4',
					scope:       LocalScope,
					when:        'always',
					exitPoints:  [ '2' ],
					environment: popLocalEnvironment(envWithXDefinedGlobal),
					subflow:     {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['0']),
						environments:      envWithXDefinedGlobal
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: GlobalScope, when: 'always' }, false)
				.addVertex({ tag: 'exit-point', id: '2', name: '<<-', when: 'always', environment: envWithXDefinedGlobal }, false)
				.addEdge('2', '0', EdgeType.Relates, 'always')
		)
		const envWithXDefinedGlobalR = define(
			{nodeId: '1', scope: GlobalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			GlobalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('global define with ->> in function, read after', shell, 'function() { 3 ->> x; }; x',
			new DataflowGraph()
				.addVertex( { tag: 'use', id: '5', name: 'x' })
				.addVertex({
					tag:         'function-definition',
					id:          '4',
					name:        '4',
					scope:       LocalScope,
					when:        'always',
					exitPoints:  [ '2' ],
					environment: popLocalEnvironment(envWithXDefinedGlobalR),
					subflow:     {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['1']),
						environments:      envWithXDefinedGlobalR
					}
				})
				.addVertex({ tag: 'variable-definition', id: '1', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: GlobalScope, when: 'always' }, false)
				.addVertex({ tag: 'exit-point', id: '2', name: '->>', when: 'always', environment: envWithXDefinedGlobalR }, false)
				.addEdge('2', '1', EdgeType.Relates, 'always')
		)
		const envDefXSingle = define(
			{nodeId: '3', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '5' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('shadow in body', shell, 'x <- 2; function() { x <- 3; x }; x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex({
					tag:         'use',
					id:          '9',
					name:        'x',
					environment: define({
						nodeId:    '0',
						definedAt: '2',
						used:      'always',
						name:      'x',
						scope:     LocalScope,
						kind:      'variable'
					}, LocalScope, initializeCleanEnvironments())
				})
				.addEdge('9', '0', EdgeType.Reads, 'always')
				.addVertex({
					tag:        'function-definition',
					id:         '8',
					name:       '8',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '6' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['6', '3']),
						environments:      envDefXSingle
					}
				}).addVertex({
					tag:         'use',
					id:          '6',
					name:        'x',
					environment: define({ nodeId: '3', definedAt: '5', used: 'always', name: 'x', scope: LocalScope, kind: 'variable'}, LocalScope, pushLocalEnvironment(initializeCleanEnvironments())),
					when:        'always'
				}, false)
				.addVertex({
					tag:         'variable-definition',
					id:          '3',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					scope:       LocalScope,
					when:        'always'
				}, false)
				.addEdge('6', '3', EdgeType.Reads, 'always')
		)
		assertDataflow('shadow in body with closure', shell, 'x <- 2; function() { x <- x; x }; x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex({
					tag:         'use',
					id:          '9',
					name:        'x',
					environment: define(
						{ nodeId: '0', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
						LocalScope,
						initializeCleanEnvironments())
				})
				.addEdge('9', '0', EdgeType.Reads, 'always')
				.addVertex({
					tag:        'function-definition',
					id:         '8',
					name:       '8',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '6' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [ { nodeId: '4', used: 'always', name: 'x', scope: LocalScope} ],
						scope:             LocalScope,
						graph:             new Set(['3', '4', '6']),
						environments:      envDefXSingle
					}
				}).addVertex({
					tag:         'variable-definition',
					id:          '3',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					scope:       LocalScope,
					when:        'always'
				}, false)
				.addVertex({
					tag:         'use',
					id:          '4',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					when:        'always'
				}, false)
				.addVertex({
					tag:         'use',
					id:          '6',
					name:        'x',
					environment: define({
						nodeId:    '3',
						scope:     LocalScope,
						name:      'x',
						used:      'always',
						kind:      'variable',
						definedAt: '5'
					}, LocalScope, pushLocalEnvironment(initializeCleanEnvironments())),
					when: 'always'
				}, false)
				.addEdge('6', '3', EdgeType.Reads, 'always')
				.addEdge('3', '4', EdgeType.DefinedBy, 'always')
		)
	})
	describe('Scoping of parameters', () => {
		const envWithXDefined = define(
			{nodeId: '3', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '4' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('parameter shadows', shell, 'x <- 3; function(x) { x }',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex({
					tag:        'function-definition',
					id:         '7',
					name:       '7',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '5' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['3', '5']),
						environments:      envWithXDefined
					}
				})
				.addVertex({ tag: 'variable-definition', id: '3', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }, false)
				.addVertex({
					tag:         'use',
					id:          '5',
					name:        'x',
					environment: envWithXDefined,
					when:        'always'
				}, false)
				.addEdge('5', '3', EdgeType.Reads, 'always')
		)
	})
	describe('Access dot-dot-dot', () => {
		const envWithParam = define(
			{nodeId: '0', scope: 'local', name: '...', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('parameter shadows', shell, 'function(...) { ..11 }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '4',
					name:       '4',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '2' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['0', '2']),
						environments:      envWithParam
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: '...', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }, false)
				.addVertex({
					tag:         'use',
					id:          '2',
					name:        '..11',
					environment: envWithParam,
					when:        'always'
				}, false)
				.addEdge('2', '0', EdgeType.Reads, 'always')
		)
	})
	describe('Using named arguments', () => {
		const envWithA = define(
			{ nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'parameter', definedAt: '2' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const envWithAB = define(
			{ nodeId: '3', scope: LocalScope, name: 'b', used: 'always', kind: 'parameter', definedAt: '5' },
			LocalScope,
			envWithA
		)
		assertDataflow('Read first parameter', shell, 'function(a=3, b=a) { b }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '8',
					name:       '8',
					exitPoints: ['6'],
					scope:      LocalScope,
					when:       'always',
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						environments:      envWithAB,
						graph:             new Set(['0', '3', '4', '6'])
					}
				}).addVertex({
					tag:         'variable-definition',
					id:          '0',
					name:        'a',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					scope:       LocalScope,
					when:        'always'
				}, false)
				.addVertex({
					tag:         'variable-definition',
					id:          '3',
					name:        'b',
					environment: envWithA,
					scope:       LocalScope,
					when:        'always'
				}, false)
				.addVertex({ tag: 'use', id: '4', name: 'a', environment: envWithA, when: 'always' }, false)
				.addVertex({ tag: 'use', id: '6', name: 'b', environment: envWithAB, when: 'always' }, false)
				.addEdge('4', '0', EdgeType.Reads, 'always')
				.addEdge('3', '4', EdgeType.DefinedBy, 'maybe' /* default values can be overridden */)
				.addEdge('6', '3', EdgeType.Reads, 'always')
		)

		const envWithFirstParam = define(
			{ nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'parameter', definedAt: '2' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const envWithBothParam = define(
			{ nodeId: '3', scope: LocalScope, name: 'm', used: 'always', kind: 'parameter', definedAt: '5' },
			LocalScope,
			envWithFirstParam
		)
		const envWithBothParamFirstB = define(
			{ nodeId: '6', scope: LocalScope, name: 'b', used: 'always', kind: 'variable', definedAt: '8' },
			LocalScope,
			envWithBothParam
		)
		const envWithBothParamSecondB = define(
			{ nodeId: '10', scope: LocalScope, name: 'b', used: 'always', kind: 'variable', definedAt: '12' },
			LocalScope,
			envWithBothParam
		)
		assertDataflow('Read later definition', shell, 'function(a=b, m=3) { b <- 1; a; b <- 5; a + 1 }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '17',
					name:       '17',
					scope:      LocalScope,
					when:       'always',
					exitPoints: ['15'],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						environments:      envWithBothParamSecondB,
						graph:             new Set(['0', '3', '10', '6', '1', '9', '13'])
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.addVertex({ tag: 'variable-definition', id: '3', name: 'm', scope: LocalScope, when: 'always', environment: envWithFirstParam }, false)
				.addVertex({ tag: 'variable-definition', id: '10', name: 'b', scope: LocalScope, when: 'always', environment: envWithBothParamFirstB }, false)
				.addVertex({ tag: 'variable-definition', id: '6', name: 'b', scope: LocalScope, when: 'always', environment: envWithBothParam }, false)
				.addVertex({ tag: 'use', id: '1', name: 'b', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.addVertex({ tag: 'use', id: '9', name: 'a', scope: LocalScope, when: 'always', environment: envWithBothParamFirstB }, false)
				.addVertex({ tag: 'use', id: '13', name: 'a', scope: LocalScope, when: 'always', environment: envWithBothParamSecondB }, false)
				.addVertex({ tag: 'exit-point', id: '15', name: '+', scope: LocalScope, when: 'always', environment: envWithBothParamSecondB }, false)
				.addEdge('15', '13', EdgeType.Relates, 'always')
				.addEdge('13', '9', EdgeType.SameReadRead, 'always')
				.addEdge('9', '0', EdgeType.Reads, 'always')
				.addEdge('13', '0', EdgeType.Reads, 'always')
				.addEdge('0', '1', EdgeType.DefinedBy, 'maybe')
				.addEdge('1', '6', EdgeType.Reads, 'always')
				.addEdge('10', '6', EdgeType.SameDefDef, 'always')
		)
	})
	describe('Using special argument', () => {
		const envWithA = define(
			{ nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const envWithASpecial = define(
			{ nodeId: '2', scope: LocalScope, name: '...', used: 'always', kind: 'parameter', definedAt: '3' },
			LocalScope,
			envWithA
		)
		assertDataflow('Return ...', shell, 'function(a, ...) { foo(...) }',
			new DataflowGraph()
				.addVertex({
					tag:        'function-definition',
					id:         '9',
					name:       '9',
					scope:      LocalScope,
					when:       'always',
					exitPoints: ['7'],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						environments:      envWithASpecial,
						graph:             new Set(['0', '2', '5', '7', '6'])
					}
				})
				.addVertex({ tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.addVertex({ tag: 'variable-definition', id: '2', name: '...', scope: LocalScope, when: 'always', environment: envWithA }, false)
				.addVertex({ tag: 'use', id: '5', name: '...', scope: LocalScope, when: 'always', environment: envWithASpecial }, false)
				.addVertex({
					tag:         'function-call',
					id:          '7', name:        'foo',
					scope:       LocalScope,
					when:        'always',
					environment: envWithASpecial,
					args:        [ { nodeId: '6', name: `${UnnamedArgumentPrefix}6`, scope: LocalScope, used: 'always'  } ]
				}, false)
				.addVertex({ tag: 'use', id: '6', name: `${UnnamedArgumentPrefix}6`, when: 'always', environment: envWithASpecial }, false)
				.addEdge('7', '6', EdgeType.Argument, 'always')
				.addEdge('6', '5', EdgeType.Reads, 'always')
				.addEdge('5', '2', EdgeType.Reads, 'always')
		)
	})
	describe('Bind environment to correct exit point', () => {
		const envWithG = define(
			{ nodeId: '0', scope: LocalScope, name: 'g', used: 'always', kind: 'function', definedAt: '4' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const envWithFirstY = define(
			{ nodeId: '5', scope: LocalScope, name: 'y', used: 'always', kind: 'variable', definedAt: '7' },
			LocalScope,
			envWithG
		)
		const finalEnv = define(
			{ nodeId: '15', scope: LocalScope, name: 'y', used: 'always', kind: 'variable', definedAt: '17' },
			LocalScope,
			envWithG
		)
		assertDataflow('Two possible exit points to bind y closure', shell, `function() {
  g <- function() { y }
  y <- 5
  if(z)
    return(g)
  y <- 3
  g
}`,
		new DataflowGraph()
			.addVertex({
				tag:        'function-definition',
				id:         '20',
				name:       '20',
				scope:      LocalScope,
				when:       'always',
				exitPoints: ['12','18'],
				subflow:    {
					out:               [],
					unknownReferences: [],
					in:                [ {nodeId: '8', name: 'z', used: 'always', scope: LocalScope} ],
					scope:             LocalScope,
					environments:      finalEnv,
					graph:             new Set(['0', '5', '15', '8', '10', '18', '11', '12', '3'])
				}
			})
			.addVertex({ tag: 'variable-definition', id: '0', name: 'g', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
			.addVertex({ tag: 'variable-definition', id: '5', name: 'y', scope: LocalScope, when: 'always', environment: envWithG }, false)
			.addVertex({ tag: 'variable-definition', id: '15', name: 'y', scope: LocalScope, when: 'always', environment: envWithFirstY }, false)
			.addVertex({ tag: 'use', id: '8', name: 'z', scope: LocalScope, when: 'always', environment: envWithFirstY }, false)
			.addVertex({ tag: 'use', id: '10', name: 'g', scope: LocalScope, when: 'always', environment: envWithFirstY }, false)
			.addVertex({ tag: 'use', id: '18', name: 'g', scope: LocalScope, when: 'always', environment: finalEnv }, false)
			.addVertex({ tag: 'use', id: '11', name: `${UnnamedArgumentPrefix}11`, scope: LocalScope, when: 'always', environment: envWithFirstY }, false)
			.addVertex({
				tag:         'function-call',
				id:          '12',
				name:        'return',
				scope:       LocalScope,
				when:        'maybe',
				environment: envWithFirstY,
				args:        [ { nodeId: '11', name: `${UnnamedArgumentPrefix}11`, scope: LocalScope, used: 'always'  } ]
			}, false)
			.addVertex({
				tag:         'function-definition',
				id:          '3',
				name:        '3',
				scope:       LocalScope,
				when:        'always',
				environment: pushLocalEnvironment(initializeCleanEnvironments()),
				exitPoints:  ['1'],
				subflow:     {
					out:               [],
					unknownReferences: [],
					in:                [],
					scope:             LocalScope,
					environments:      pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())),
					graph:             new Set(['1'])
				}
			}, false)
			.addEdge('0', '3', EdgeType.DefinedBy, 'always')
			.addEdge('1', '5', EdgeType.Reads, 'maybe')
			.addEdge('1', '15', EdgeType.Reads, 'maybe')
			.addEdge('18', '0', EdgeType.Reads, 'always')
			.addEdge('10', '0', EdgeType.Reads, 'always')
			.addEdge('11', '10', EdgeType.Reads, 'always')
			.addEdge('12', '11', EdgeType.Argument, 'always')
			.addEdge('12', '11', EdgeType.Returns, 'always')
			.addEdge('12', BuiltIn, EdgeType.Reads, 'maybe')
			.addEdge('12', BuiltIn, EdgeType.Calls, 'maybe')
			.addEdge('5', '15', EdgeType.SameDefDef, 'always')

			.addVertex({ tag: 'use', id: '1', name: 'y', scope: LocalScope, when: 'always', environment: pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())) }, false)
		)
	})
	describe('Late binding of environment variables', () => {
		assertDataflow('define after function definition', shell, 'function() { x }; x <- 3',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '3', name: 'x', scope: LocalScope })
				.addVertex({
					tag:        'function-definition',
					id:         '2',
					name:       '2',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '0' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [{
							nodeId: '0',
							scope:  LocalScope,
							name:   'x',
							used:   'always'
						}],
						scope:        LocalScope,
						graph:        new Set(['0']),
						environments: pushLocalEnvironment(initializeCleanEnvironments())
					}
				})
				.addVertex({
					tag:         'use',
					id:          '0',
					name:        'x',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					when:        'always'
				}, false)
		)
	})

	describe('Nested Function Definitions', () => {
		const withXParameterInOuter = define(
			{nodeId: '1', scope: LocalScope, name: 'x', used: 'always', kind: 'function', definedAt: '9' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		const withinNestedFunctionWithoutParam = pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))
		const withinNestedFunctionWithParam = define(
			{nodeId: '2', scope: LocalScope, name: 'x', used: 'always', kind: 'parameter', definedAt: '3' },
			LocalScope,
			withinNestedFunctionWithoutParam
		)
		const withinNestedFunctionWithDef = define(
			{nodeId: '4', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '6' },
			LocalScope,
			pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))
		)
		const envWithA = define(
			{ nodeId: '0', scope: LocalScope, name: 'a', used: 'always', kind: 'function', definedAt: '13' },
			LocalScope,
			initializeCleanEnvironments()
		)
		const envWithAB = define(
			{ nodeId: '14', scope: LocalScope, name: 'b', used: 'always', kind: 'variable', definedAt: '16' },
			LocalScope,
			envWithA
		)
		assertDataflow('double nested functions', shell, 'a <- function() { x <- function(x) { x <- b }; x }; b <- 3; a',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'a', scope: LocalScope })
				.addVertex( {
					tag:         'variable-definition',
					id:          '14',
					name:        'b',
					scope:       LocalScope,
					environment: envWithA
				})
				.addVertex( { tag: 'use', id: '17', name: 'a', environment: envWithAB })
				.addEdge('17', '0', EdgeType.Reads, 'always')
				.addVertex({
					tag:        'function-definition',
					id:         '12',
					name:       '12',
					scope:      LocalScope,
					when:       'always',
					exitPoints: [ '10' ],
					subflow:    {
						out:               [],
						unknownReferences: [],
						in:                [],
						scope:             LocalScope,
						graph:             new Set(['10', '1', '8']),
						environments:      withXParameterInOuter
					}
				})
				.addEdge('0', '12', EdgeType.DefinedBy, 'always')

				.addVertex({ tag: 'use', id: '10', name: 'x', environment: withXParameterInOuter }, false)
				.addVertex({ tag: 'variable-definition', id: '1', name: 'x', environment: pushLocalEnvironment(initializeCleanEnvironments()), scope: LocalScope, when: 'always' }, false)
				.addVertex({
					tag:         'function-definition',
					id:          '8',
					name:        '8',
					environment: pushLocalEnvironment(initializeCleanEnvironments()),
					scope:       LocalScope,
					when:        'always',
					exitPoints:  [ '6' ],
					subflow:     {
						out:               [],
						unknownReferences: [],
						in:                [{
							nodeId: '5',
							scope:  LocalScope,
							name:   'x',
							used:   'always'
						}],
						scope:        LocalScope,
						graph:        new Set(['5', '4', '2']),
						environments: withinNestedFunctionWithDef
					}
				}, false)
				.addEdge('10', '1', EdgeType.Reads, 'always')
				.addEdge('1', '8', EdgeType.DefinedBy, 'always')

				.addVertex({ tag: 'use', id: '5', name: 'b', environment: withinNestedFunctionWithParam }, false)
				.addVertex({ tag: 'exit-point', id: '6', name: '<-', environment: withinNestedFunctionWithDef }, false)
				.addEdge('6', '4', EdgeType.Relates, 'always')
				.addEdge('6', '5', EdgeType.Relates, 'always')
				.addVertex({ tag: 'variable-definition', id: '4', name: 'x', environment: withinNestedFunctionWithParam, scope: LocalScope, when: 'always' }, false)
				.addVertex({ tag: 'variable-definition', id: '2', name: 'x', environment: withinNestedFunctionWithoutParam, scope: LocalScope, when: 'always' }, false)
				.addEdge('4', '5', EdgeType.DefinedBy, 'always')
				.addEdge('2', '4', EdgeType.SameDefDef, 'always')
		)
	})
}))
