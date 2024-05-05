import { assertDataflow, withShell } from '../../../_helper/shell'
import { emptyGraph } from '../../../_helper/dataflow/dataflowgraph-builder'
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder'
import { BuiltIn } from '../../../../../src/dataflow'
import { label } from '../../../_helper/label'
import { OperatorDatabase } from '../../../../../src'

describe('Lists with variable references', withShell(shell => {
	describe('read-read same variable', () => {
		assertDataflow(label('directly together', ['name-normal', 'newlines']), shell,
			'x\nx', emptyGraph()
				.use('0', 'x')
				.use('1', 'x')
				.sameRead('0', '1')
		)

		assertDataflow(label('multiple occurrences of same variable', ['name-normal', 'newlines']), shell,
			'x\nx\nx', emptyGraph()
				.use('0', 'x')
				.use('1', 'x')
				.use('2', 'x')
				.sameRead('0', '1')
				.sameRead('0', '2')
		)
	})
	describe('def-def same variable', () => {
		assertDataflow(label('directly together', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines']), shell,
			'x <- 1\nx <- 2', emptyGraph()
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', '5')
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '3')
				.constant('4')
				.defineVariable('3', 'x', { definedBy: ['4', '5'] })
		)

		assertDataflow(label('multiple occurrences of same variable', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines']), shell,
			'x <- 1\nx <- 3\n3\nx <- 9', emptyGraph()
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', ['5', '9'])
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('9', '<-', [argumentInCall('7'), argumentInCall('8')], { returns: ['7'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '3', '5') })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '3')
				.constant('4')
				.defineVariable('3', 'x', { definedBy: ['4', '5'] })
				.sameDef('3', '7')
				.constant('6')
				.constant('8')
				.defineVariable('7', 'x', { definedBy: ['8', '9'] })
		)
	})
	describe('def followed by read', () => {
		assertDataflow(label('directly together', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines']), shell,
			'x <- 1\nx',  emptyGraph()
				.use('3', 'x')
				.reads('3', '0')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
		)
		assertDataflow(label('redefinition links correctly', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons']), shell,
			'x <- 2; x <- 3; x',
			emptyGraph()
				.use('6', 'x')
				.reads('6', '3')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', '5')
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '3')
				.constant('4')
				.defineVariable('3', 'x', { definedBy: ['4', '5'] })
		)
		assertDataflow(label('multiple redefinition with circular definition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'semicolons']), shell,
			'x <- 2; x <- x; x',
			emptyGraph()
				.use('4', 'x')
				.reads('4', '0')
				.use('6', 'x')
				.reads('6', '3')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', '5')
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '3')
				.defineVariable('3', 'x', { definedBy: ['4', '5'] })
		)
		assertDataflow(label('duplicate circular definition', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'semicolons']), shell,
			'x <- x; x <- x;',
			emptyGraph()
				.use('1', 'x')
				.use('4', 'x')
				.reads('4', '0')
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', '5')
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '3')
				.defineVariable('3', 'x', { definedBy: ['4', '5'] })
		)
	})
}))
