import { assertDataflow, withShell } from '../../../_helper/shell'
import { BuiltIn, initializeCleanEnvironments } from '../../../../../src/dataflow'
import {
	define,
	popLocalEnvironment,
	pushLocalEnvironment
} from '../../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../../src/dataflow/internal/process/functions/argument'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('Function Definition', withShell(shell => {
	describe('Only functions', () => {
		assertDataflow('unknown read in function', shell, 'function() { x }',
			emptyGraph()
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
				})
				.uses('0', 'x', {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
		)

		const envWithXDefined = define(
			{ nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('read of parameter', shell, 'function(x) { x }',
			emptyGraph()
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
				.definesVariable('0', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('2', 'x', {environment: envWithXDefined}, false)
				.reads('2', '0')
		)
		assertDataflow('read of parameter in return', shell, 'function(x) { return(x) }',
			emptyGraph()
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
				})
				.definesVariable('0', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('3', 'x', {environment: envWithXDefined}, false)
				.addVertex({
					tag:         'function-call',
					id:          '5',
					name:        'return',
					environment: envWithXDefined,
					when:        'always',
					args:        [{ nodeId: '4', used: 'always', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope }]
				}, false)
				.uses('4',`${UnnamedArgumentPrefix}4`, {environment: envWithXDefined}, false)
				.reads('5', BuiltIn)
				.calls('5', BuiltIn)
				.reads('3', '0')
				.argument('5', '4')
				.returns('5', '4')
				.reads('4', '3')
		)

		describe('x', () => {
			assertDataflow('return parameter named', shell, 'function(x) { return(x=x) }',
				emptyGraph()
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
					})
					.definesVariable('0', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
					.uses('4', 'x', {environment: envWithXDefined}, false)
					.addVertex({
						tag:         'function-call',
						id:          '6',
						name:        'return',
						environment: envWithXDefined,
						when:        'always',
						args:        [['x', { nodeId: '5', used: 'always', name: 'x', scope: LocalScope }]]
					}, false)
					.uses('5', 'x', {environment: envWithXDefined}, false)
					.reads('6', BuiltIn)
					.calls('6', BuiltIn)
					.reads('4', '0')
					.argument('6', '5')
					.returns('6', '5')
					.reads('5', '4')
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
			emptyGraph()
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
				.definesVariable('0', 'x', LocalScope, {environment: envWithoutParams}, false)
				.definesVariable('2', 'y', LocalScope, {environment: envWithXParam}, false)
				.definesVariable('4', 'z', LocalScope, {environment: envWithXYParam}, false)
				.uses('6', 'y', {environment: envWithXYZParam}, false)
				.reads('6', '2')
		)
	})
	describe('Scoping of body', () => {
		assertDataflow('previously defined read in function', shell, 'x <- 3; function() { x }',
			emptyGraph()
				.definesVariable('0', 'x')
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
				.uses('3', 'x', {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
		)
		const envWithXDefined = define(
			{nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))

		assertDataflow('local define with <- in function, read after', shell, 'function() { x <- 3; }; x',
			emptyGraph()
				.uses('5', 'x')
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
				.definesVariable('0', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.exits('2', '<-', envWithXDefined, {}, false)
				.relates('2', '0')
		)
		assertDataflow('local define with = in function, read after', shell, 'function() { x = 3; }; x',
			emptyGraph()
				.uses('5', 'x')
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
				.definesVariable('0', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.exits('2', '=', envWithXDefined, {}, false)
				.relates('2', '0')
		)

		const envWithXDefinedR = define(
			{nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('local define with -> in function, read after', shell, 'function() { 3 -> x; }; x',
			emptyGraph()
				.uses('5', 'x')
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
				.definesVariable('1', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.exits('2', '->', envWithXDefinedR, {}, false)
				.relates('2', '1')
		)
		const envWithXDefinedGlobal = define(
			{nodeId: '0', scope: GlobalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			GlobalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('global define with <<- in function, read after', shell, 'function() { x <<- 3; }; x',
			emptyGraph()
				.uses('5', 'x')
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
				.definesVariable('0', 'x', GlobalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.exits('2', '<<-', envWithXDefinedGlobal, {}, false)
				.relates('2', '0')
		)
		const envWithXDefinedGlobalR = define(
			{nodeId: '1', scope: GlobalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
			GlobalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('global define with ->> in function, read after', shell, 'function() { 3 ->> x; }; x',
			emptyGraph()
				.uses('5', 'x')
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
				.definesVariable('1', 'x', GlobalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.exits('2', '->>', envWithXDefinedGlobalR, {}, false)
				.relates('2', '1')
		)
		const envDefXSingle = define(
			{nodeId: '3', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '5' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('shadow in body', shell, 'x <- 2; function() { x <- 3; x }; x',
			emptyGraph()
				.definesVariable('0', 'x')
				.uses('9', 'x', {
					environment: define({
						nodeId:    '0',
						definedAt: '2',
						used:      'always',
						name:      'x',
						scope:     LocalScope,
						kind:      'variable'
					}, LocalScope, initializeCleanEnvironments())
				})
				.reads('9', '0')
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
				})
				.uses('6', 'x', {environment: define({ nodeId: '3', definedAt: '5', used: 'always', name: 'x', scope: LocalScope, kind: 'variable'}, LocalScope, pushLocalEnvironment(initializeCleanEnvironments()))}, false)
				.definesVariable('3', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.reads('6', '3')
		)
		assertDataflow('shadow in body with closure', shell, 'x <- 2; function() { x <- x; x }; x',
			emptyGraph()
				.definesVariable('0', 'x')
				.uses('9', 'x', {
					environment: define(
						{ nodeId: '0', scope: LocalScope, name: 'x', used: 'always', kind: 'variable', definedAt: '2' },
						LocalScope,
						initializeCleanEnvironments())
				})
				.reads('9', '0')
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
				})
				.definesVariable('3', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('4', 'x', {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('6', 'x', {
					environment: define({
						nodeId:    '3',
						scope:     LocalScope,
						name:      'x',
						used:      'always',
						kind:      'variable',
						definedAt: '5'
					}, LocalScope, pushLocalEnvironment(initializeCleanEnvironments())),
				}, false)
				.reads('6', '3')
				.definedBy('3', '4')
		)
	})
	describe('Scoping of parameters', () => {
		const envWithXDefined = define(
			{nodeId: '3', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '4' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('parameter shadows', shell, 'x <- 3; function(x) { x }',
			emptyGraph()
				.definesVariable('0', 'x')
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
				.definesVariable('3', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('5', 'x', {environment: envWithXDefined}, false)
				.reads('5', '3')
		)
	})
	describe('Access dot-dot-dot', () => {
		const envWithParam = define(
			{nodeId: '0', scope: 'local', name: '...', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments()))
		assertDataflow('parameter shadows', shell, 'function(...) { ..11 }',
			emptyGraph()
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
				.definesVariable('0', '...', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('2', '..11', {environment: envWithParam}, false)
				.reads('2', '0')
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
			emptyGraph()
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
				})
				.definesVariable('0', 'a', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.definesVariable('3', 'b', LocalScope, {environment: envWithA}, false)
				.uses('4', 'a', {environment: envWithA}, false)
				.uses('6', 'b', {environment: envWithAB}, false)
				.reads('4', '0')
				.definedBy('3', '4', 'maybe' /* default values can be overridden */)
				.reads('6', '3')
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
			emptyGraph()
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
				.definesVariable('0', 'a', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.definesVariable('3', 'm', LocalScope, {environment: envWithFirstParam }, false)
				.definesVariable('10', 'b', LocalScope, {environment: envWithBothParamFirstB }, false)
				.definesVariable('6', 'b', LocalScope, {environment: envWithBothParam }, false)
				.uses('1', 'b', {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.uses('9', 'a', {environment: envWithBothParamFirstB}, false)
				.uses('13', 'a', {environment: envWithBothParamSecondB}, false)
				.exits('15', '+', envWithBothParamSecondB, {}, false)
				.relates('15', '13')
				.sameRead('13', '9')
				.reads('9', '0')
				.reads('13', '0')
				.definedBy('0', '1', 'maybe')
				.reads('1', '6')
				.sameDef('10', '6')
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
			emptyGraph()
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
				.definesVariable('0', 'a', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
				.definesVariable('2', '...', LocalScope, {environment: envWithA }, false)
				.uses('5', '...', {environment: envWithASpecial}, false)
				.addVertex({
					tag:         'function-call',
					id:          '7', name:        'foo',
					scope:       LocalScope,
					when:        'always',
					environment: envWithASpecial,
					args:        [ { nodeId: '6', name: `${UnnamedArgumentPrefix}6`, scope: LocalScope, used: 'always'  } ]
				}, false)
				.uses('6',`${UnnamedArgumentPrefix}6`, {environment: envWithASpecial}, false)
				.argument('7', '6')
				.reads('6', '5')
				.reads('5', '2')
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
		emptyGraph()
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
			.definesVariable('0', 'g', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments()) }, false)
			.definesVariable('5', 'y', LocalScope, {environment: envWithG }, false)
			.definesVariable('15', 'y', LocalScope, {environment: envWithFirstY }, false)
			.uses('8', 'z', {environment: envWithFirstY}, false)
			.uses('10', 'g', {environment: envWithFirstY}, false)
			.uses('18', 'g', {environment: finalEnv}, false)
			.uses('11', `${UnnamedArgumentPrefix}11`, {environment: envWithFirstY}, false)
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
			.definedBy('0', '3')
			.reads('1', '5', 'maybe')
			.reads('1', '15', 'maybe')
			.reads('18', '0')
			.reads('10', '0')
			.reads('11', '10')
			.argument('12', '11')
			.returns('12', '11')
			.reads('12', BuiltIn, 'maybe')
			.calls('12', BuiltIn, 'maybe')
			.sameDef('5', '15')
			.uses('1', 'y', {environment: pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments()))}, false)
		)
	})
	describe('Late binding of environment variables', () => {
		assertDataflow('define after function definition', shell, 'function() { x }; x <- 3',
			emptyGraph()
				.definesVariable('3', 'x')
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
				.uses('0', 'x', {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
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
			emptyGraph()
				.definesVariable('0', 'a')
				.definesVariable('14', 'b', LocalScope, {environment: envWithA})
				.uses('17', 'a', {environment: envWithAB})
				.reads('17', '0', 'always')
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
				.definedBy('0', '12')

				.uses('10', 'x', {environment: withXParameterInOuter}, false)
				.definesVariable('1', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
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
				.reads('10', '1')
				.definedBy('1', '8')

				.uses('5', 'b', {environment: withinNestedFunctionWithParam}, false)
				.exits('6', '<-', withinNestedFunctionWithDef, {}, false)
				.relates('6', '4')
				.relates('6', '5')
				.definesVariable('4', 'x', LocalScope, {environment: withinNestedFunctionWithParam}, false)
				.definesVariable('2', 'x', LocalScope, {environment: withinNestedFunctionWithoutParam}, false)
				.definedBy('4', '5')
				.sameDef('2', '4')
		)
	})
}))
