import { assertDataflow, withShell } from '../../../_helper/shell'
import { EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow'
import { define, popLocalEnvironment, pushLocalEnvironment } from '../../../../../src/dataflow/environments'
import { UnnamedArgumentPrefix } from '../../../../../src/dataflow/internal/process/functions/argument'
import { UnnamedFunctionCallPrefix } from '../../../../../src/dataflow/internal/process/functions/function-call'
import { LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { MIN_VERSION_LAMBDA } from '../../../../../src/r-bridge/lang-4.x/ast/model/versions'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

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
		assertDataflow('Calling function a', shell, 'i <- 4; a <- function(x) { x }\na(i)',
			emptyGraph()
				.defineVariable('0', 'i')
				.defineVariable('3', 'a', LocalScope, {environment: envWithFirstI})
				.use('11', 'i', {environment: envWithIA})
				.use('12', `${UnnamedArgumentPrefix}12`, {environment: envWithIA})
				.call('13', 'a', [{
					nodeId: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, used: 'always'
				}],
				{environment: envWithIA})
				.defineFunction('8', '8', ['6'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      envWithXParamDefined,
					graph:             new Set(['4', '6']),
				}, {environment: popLocalEnvironment(envWithXParamDefined)})
				.defineVariable('4', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.use('6', 'x', {environment: envWithXParamDefined}, false)
				.reads('6', '4')
				.reads('11', '0')
				.definedBy('3', '8')
				.argument('13', '12')
				.reads('12', '11')
				.reads('13', '3')
				.calls('13', '8')
				.returns('13', '6')
				.definesOnCall('12', '4')
		)
		const envWithIAB = define(
			{nodeId: '10', scope: 'local', name: 'b', used: 'always', kind: 'variable', definedAt: '12' },
			LocalScope,
			envWithIA
		)
		assertDataflow('Calling function a with an indirection', shell, 'i <- 4; a <- function(x) { x }\nb <- a\nb(i)',
			emptyGraph()
				.defineVariable('0', 'i')
				.defineVariable('3', 'a', LocalScope, {environment: envWithFirstI})
				.defineVariable('10', 'b', LocalScope, {environment: envWithIA})
				.use('11', 'a', {environment: envWithIA})
				.use('14', 'i', {environment: envWithIAB})
				.use('15', `${UnnamedArgumentPrefix}15`, {environment: envWithIAB})
				.call('16', 'b', [{
					nodeId: '15', name: `${UnnamedArgumentPrefix}15`, scope: LocalScope, used: 'always'
				}],
				{environment: envWithIAB})
				.defineFunction('8', '8', ['6'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      envWithXParamDefined,
					graph:             new Set(['4', '6'])
				}, 
				{environment: popLocalEnvironment(envWithXParamDefined)})
				.defineVariable('4', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
				.use('6', 'x', {environment: envWithXParamDefined}, false)
				.reads('6', '4')
				.reads('14', '0')
				.definedBy('3', '8')
				.definedBy('10', '11')
				.reads('11', '3')
				.argument('16', '15')
				.reads('15', '14')
				.reads('16', '10')
				.calls('16', '8')
				.returns('16', '6')
				.definesOnCall('15', '4')
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
		assertDataflow('Calling with a constant function', shell, `i <- 4
a <- function(x) { x <- x; x <- 3; 1 }
a(i)`, emptyGraph()
			.defineVariable('0', 'i')
			.defineVariable('3', 'a', LocalScope, {environment: envWithFirstI})
			.use('17', 'i', {environment: envWithIAndLargeA})
			.use('18', `${UnnamedArgumentPrefix}18`, {environment: envWithIAndLargeA})
			.reads('17', '0')
			.call('19', 'a', [{
				nodeId: '18', name: `${UnnamedArgumentPrefix}18`, scope: LocalScope, used: 'always'
			}],
			{environment: envWithIAndLargeA})
			.defineFunction('14', '14', ['12'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				scope:             LocalScope,
				environments:      envWithLastXDefined,
				graph:             new Set(['4', '6', '7', '9'])
			},
			{environment: initializeCleanEnvironments()}
			)
			.defineVariable('4', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
			.defineVariable('6', 'x', LocalScope, {environment: envWithXConstDefined}, false)
			.defineVariable('9', 'x', LocalScope, {environment: envWithXDefinedForFunc}, false)
			.use('7', 'x', {environment: envWithXConstDefined}, false)
			.exit('12', '1', envWithLastXDefined, {}, false)
			.definedBy('6', '7')
			.reads('7', '4')
			.sameDef('6', '9')
			.sameDef('4', '9')
			.sameDef('4', '6')

			.definedBy('3', '14')
			.argument('19', '18')
			.reads('18', '17')
			.reads('19', '3')
			.calls('19', '14')
			.returns('19', '12')
			.definesOnCall('18', '4')
		)
	})

	describe('Directly calling a function', () => {
		const envWithXParameter = define(
			{nodeId: '0', scope: 'local', name: 'x', used: 'always', kind: 'parameter', definedAt: '1' },
			LocalScope,
			pushLocalEnvironment(initializeCleanEnvironments())
		)
		const outGraph = emptyGraph()
			.call('9', `${UnnamedFunctionCallPrefix}9`,[
				{ nodeId: '8', name: `${UnnamedArgumentPrefix}8`, scope: LocalScope, used: 'always' }
			])
			.defineFunction('6', '6', ['4'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				scope:             LocalScope,
				environments:      envWithXParameter,
				graph:             new Set(['0', '2'])
			},
			{environment: initializeCleanEnvironments()})
			.defineVariable('0', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
			.use('2', 'x', {environment: envWithXParameter}, false)
			.exit('4', '+', envWithXParameter , {}, false)
			.relates('2', '4')
			.reads('2', '0')

			.use('8', `${UnnamedArgumentPrefix}8`)
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

		const envWithADefined = define(
			{nodeId: '0', scope: 'local', name: 'a', used: 'always', kind: 'function', definedAt: '6' },
			LocalScope,
			initializeCleanEnvironments()
		)

		assertDataflow('Calling a function which returns another', shell, `a <- function() { function() { 42 } }
a()()`,
		emptyGraph()
			.call('9', `${UnnamedFunctionCallPrefix}9`, [],
				{environment: envWithADefined})
			.call('8', 'a', [],
				{environment: envWithADefined})
			.defineVariable('0', 'a')
			.defineFunction('5', '5', ['3'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				scope:             LocalScope,
				environments:      pushLocalEnvironment(initializeCleanEnvironments()),
				graph:             new Set(['3'])
			},
			{environment: initializeCleanEnvironments()}
			)
			.defineFunction('3', '3', ['1'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				scope:             LocalScope,
				environments:      pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())),
				graph:             new Set()
			},
			{environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
			.exit('1', '42', pushLocalEnvironment(pushLocalEnvironment(initializeCleanEnvironments())) , {}, false)
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
				.call('5', 'foo', [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }], {environment: initializeCleanEnvironments()})
				.use('4', `${UnnamedArgumentPrefix}4`)
				.use('2', 'x')
				.reads('4', '2')
				.argument('5', '4')
		)
	})

	describe('Argument which is anonymous function call', () => {
		assertDataflow('Calling with a constant function', shell, 'f(function() { 3 })',
			emptyGraph()
				.call('5', 'f', [{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }], {environment: initializeCleanEnvironments()})
				.use('4', `${UnnamedArgumentPrefix}4`)
				.defineFunction('3', '3', ['1'], {
					out:               [],
					in:                [],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      pushLocalEnvironment(initializeCleanEnvironments()),
					graph:             new Set()
				})
				.exit('1', '3', pushLocalEnvironment(initializeCleanEnvironments()) , {}, false)
				.reads('4', '3')
				.argument('5', '4')
		)
	})

	describe('Multiple out refs in arguments', () => {
		assertDataflow('Calling \'seq\'', shell, 'seq(1, length(pkgnames), by = stepsize)',
			emptyGraph()
				.call('11', 'seq', [
					{ nodeId: '2', name: `${UnnamedArgumentPrefix}2`, scope: LocalScope, used: 'always' },
					{ nodeId: '7', name: `${UnnamedArgumentPrefix}7`, scope: LocalScope, used: 'always' },
					['by', { nodeId: '10', name: 'by', scope: LocalScope, used: 'always' }],
				],
				{environment: initializeCleanEnvironments()})
				.use('2', `${UnnamedArgumentPrefix}2`)
				.use('7', `${UnnamedArgumentPrefix}7`)
				.use('10', 'by')
				.argument('11', '2')
				.argument('11', '7')
				.argument('11', '10')
				.use('9', 'stepsize' )
				.reads('10', '9')
				.call('6', 'length', [
					{ nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' }
				],
				{environment: initializeCleanEnvironments()})
				.reads('7', '6')
				.use('5', `${UnnamedArgumentPrefix}5`)
				.argument('6', '5')
				.use('4', 'pkgnames' )
				.reads('5', '4')

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
			emptyGraph()
				.defineVariable('0', 'a')
				.defineVariable('5', 'y', LocalScope, {environment: defWithA})
				.call('9', 'a', [], {environment: defWithAY})
				.defineFunction('3', '3', ['1'], {
					out:               [],
					in:                [{ nodeId: '1', name: 'y', scope: LocalScope, used: 'always' }],
					unknownReferences: [],
					scope:             LocalScope,
					environments:      innerEnv,
					graph:             new Set(['1'])
				})
				.use('1', 'y', {environment: innerEnv}, false)
				.definedBy('0', '3')
				.calls('9', '3')
				.reads('9', '0')
				.returns('9', '1')
				.reads('9', '5')
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
a(,3)`, emptyGraph()
			.call('13', 'a', [
				'empty',
				{ nodeId: '12', name: `${UnnamedArgumentPrefix}12`, scope: LocalScope, used: 'always' }
			],
			{environment: withADefined})
			.defineVariable('0', 'a')
			.defineFunction('8', '8', ['6'], {
				out:               [],
				in:                [],
				unknownReferences: [],
				scope:             LocalScope,
				environments:      withXYParameter,
				graph:             new Set(['1', '4', '6'])
			},
			{environment: popLocalEnvironment(withXYParameter)})
			.defineVariable('1', 'x', LocalScope, {environment: pushLocalEnvironment(initializeCleanEnvironments())}, false)
			.defineVariable('4', 'y', LocalScope, {environment: withXParameter}, false)
			.use('6', 'y', {environment: withXYParameter}, false)
			.reads('6', '4')
			.use('12', `${UnnamedArgumentPrefix}12`, {environment: withADefined})
			.reads('13', '0')
			.calls('13', '8')
			.definedBy('0', '8')
			.argument('13', '12')
			.returns('13', '6')
			.definesOnCall('12', '4')
		)
	})
	describe('Reuse parameters in call', () => {
		const envWithX = define(
			{ nodeId: '3', scope: 'local', name: 'x', used: 'always', kind: EdgeType.Argument, definedAt: '3' },
			LocalScope,
			initializeCleanEnvironments()
		)
		assertDataflow('Not giving first argument', shell, 'a(x=3, x)', emptyGraph()
			.call('6', 'a', [
				['x', { nodeId: '3', name: 'x', scope: LocalScope, used: 'always' }],
				{ nodeId: '5', name: `${UnnamedArgumentPrefix}5`, scope: LocalScope, used: 'always' },
			])
			.use('3', 'x')
			.use('5', `${UnnamedArgumentPrefix}5`, {environment: envWithX})
			.use('4', 'x', {environment: envWithX})
			.argument('6', '3')
			.argument('6', '5')
			.reads('5', '4')
			.reads('4', '3')
		)
	})
	describe('Define in parameters', () => {
		assertDataflow('Support assignments in function calls', shell, 'foo(x <- 3); x', emptyGraph()
			.call('5', 'foo', [
				{ nodeId: '4', name: `${UnnamedArgumentPrefix}4`, scope: LocalScope, used: 'always' }
			])
			.use('4', `${UnnamedArgumentPrefix}4`)
			.defineVariable('1', 'x')
			.use('6', 'x', {environment: define({ nodeId: '1', scope: 'local', name: 'x', used: 'always', kind: 'variable', definedAt: '3' }, LocalScope, initializeCleanEnvironments())})
			.argument('5', '4')
			.reads('4', '1')
			.reads('6', '1')
		)
	})
}))
