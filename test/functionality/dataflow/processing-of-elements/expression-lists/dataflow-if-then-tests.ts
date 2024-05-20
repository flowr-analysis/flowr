import { assertDataflow, withShell } from '../../../_helper/shell'
import { emptyGraph } from '../../../_helper/dataflow/dataflowgraph-builder'
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder'
import { label } from '../../../_helper/label'
import { BuiltIn } from '../../../../../src/dataflow/environments/built-in'
import { OperatorDatabase } from '../../../../../src/r-bridge/lang-4.x/ast/model/operators'
import { EmptyArgument } from '../../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call'

describe('Lists with if-then constructs', withShell(shell => {
	for(const assign of ['<-', '<<-', '=']) {
		describe(`using ${assign}`, () => {
			describe('reads within if', () => {
				for(const b of [
					{ label: 'without else', text: '' },
					{ label: 'with else', text: ' else { 1 }' },
				]) {
					describe(`${b.label}`, () => {
						const cd = b.text === '' ? ['8'] : ['12']
						const baseGraph = emptyGraph()
							.use('3', 'x')
							.reads('3', '0')
							.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
							.call('7', '{', [argumentInCall('6')], { returns: ['6'], reads: [BuiltIn], controlDependency: cd, environment: defaultEnv().defineVariable('x', '0', '2') })
						if(b.text !== '') {
							baseGraph
								.call('11', '{', [argumentInCall('10')], { returns: ['10'], reads: [BuiltIn], controlDependency: ['12'], environment: defaultEnv().defineVariable('x', '0', '2') })
								.call('12', 'if', [argumentInCall('3'), argumentInCall('7'), argumentInCall('11')], { returns: ['7', '11'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1', '2'] })
								.constant('6', { controlDependency: ['12'] })
								.constant('10', { controlDependency: ['12'] })
						} else {
							baseGraph.call('8', 'if', [argumentInCall('3'), argumentInCall('7'), EmptyArgument], { returns: ['7'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1', '2'] })
								.constant('6', { controlDependency: ['8'] })
						}
						assertDataflow(label('read previous def in cond', [...OperatorDatabase[assign].capabilities, 'name-normal', 'numbers', 'newlines', 'if']),
							shell,
							`x ${assign} 2\nif(x) { 1 } ${b.text}`,
							baseGraph
						)
						const previousGraph = emptyGraph()
							.use('6', 'x')
							.reads('6', '0')
							.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
							.call('7', '{', [argumentInCall('6')], { returns: ['6'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
							.call(cd[0], 'if', [argumentInCall('3'), argumentInCall('7'), EmptyArgument], { returns: ['7'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
							.constant('1')
							.defineVariable('0', 'x', { definedBy: ['1', '2'] })
							.constant('3')
						// otherwise will be pruned by TRUE
						assertDataflow(label('read previous def in then', [...OperatorDatabase[assign].capabilities, 'name-normal', 'numbers', 'newlines', 'if', 'logical']),
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							previousGraph
						)
					})
				}
				assertDataflow(label('read previous def in else', [...OperatorDatabase[assign].capabilities, 'name-normal', 'numbers', 'newlines', 'if', 'logical']),
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,  emptyGraph()
						.use('10', 'x')
						.reads('10', '0')
						.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
						.call('11', '{', [argumentInCall('10')], { returns: ['10'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
						.call('12', 'if', [argumentInCall('3'), EmptyArgument, argumentInCall('11')], { returns: ['11'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
						.constant('1')
						.defineVariable('0', 'x', { definedBy: ['1', '2'] })
						.constant('3')
				)
			})
			describe('write within if', () => {
				assertDataflow(label('without else directly together', ['if', 'logical', 'name-normal', ...OperatorDatabase[assign].capabilities, 'numbers', 'newlines']),
					shell,
					`if(TRUE) { x ${assign} 2 }\nx`, emptyGraph()
						.use('8', 'x')
						.reads('8', '3')
						.call('5', assign, [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn] })
						.call('6', '{', [argumentInCall('5')], { returns: ['5'], reads: [BuiltIn] })
						.call('7', 'if', [argumentInCall('0'), argumentInCall('6'), EmptyArgument], { returns: ['6'], reads: ['0', BuiltIn], onlyBuiltIn: true })
						.constant('0')
						.constant('4')
						.defineVariable('3', 'x', { definedBy: ['4', '5'] })
				)
				assertDataflow(label('def in else read afterwards', ['if', 'logical', 'numbers', 'name-normal', ...OperatorDatabase[assign].capabilities, 'newlines']),
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,  emptyGraph()
						.use('12', 'x')
						.reads('12', '7')
						.call('9', assign, [argumentInCall('7'), argumentInCall('8')], { returns: ['7'], reads: [BuiltIn] })
						.call('10', '{', [argumentInCall('9')], { returns: ['9'], reads: [BuiltIn] })
						.call('11', 'if', [argumentInCall('0'), EmptyArgument, argumentInCall('10')], { returns: ['10'], reads: ['0', BuiltIn], onlyBuiltIn: true })
						.constant('0')
						.constant('8')
						.defineVariable('7', 'x', { definedBy: ['8', '9'] })
				)

				assertDataflow(label('def in then and else read afterward', ['if', 'name-normal', ...OperatorDatabase[assign].capabilities, 'numbers', 'newlines']),
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,  emptyGraph()
						.use('0', 'z')
						.use('14', 'x')
						.reads('14', ['3', '9'])
						.call('5', assign, [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], controlDependency: ['13'] })
						.call('6', '{', [argumentInCall('5')], { returns: ['5'], reads: [BuiltIn], controlDependency: ['13'] })
						.call('11', assign, [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependency: ['13'] })
						.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [BuiltIn], controlDependency: ['13'] })
						.call('13', 'if', [argumentInCall('0'), argumentInCall('6'), argumentInCall('12')], { returns: ['6', '12'], reads: ['0', BuiltIn], onlyBuiltIn: true })
						.constant('4')
						.defineVariable('3', 'x', { definedBy: ['4', '5'], controlDependency: ['13'] })
						.constant('10')
						.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependency: ['13'] })
				)
			})
		})
	}
	describe('Branch Coverage', () => {
		//All test related to branch coverage (testing the interaction between then end else block)
		assertDataflow(label('assignment both branches in if', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if']), shell, 'x <- 1\nif(r) { x <- 2 } else { x <- 3 }\n y <- x',  emptyGraph()
			.use('3', 'r')
			.use('18', 'x')
			.reads('18', ['6', '12'])
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
			.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { returns: ['6'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { returns: ['12'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('15', '{', [argumentInCall('14')], { returns: ['14'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('16', 'if', [argumentInCall('3'), argumentInCall('9'), argumentInCall('15')], { returns: ['9', '15'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('19', '<-', [argumentInCall('17'), argumentInCall('18')], { returns: ['17'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '6', '8', ['16']).defineVariable('x', '12', '14', ['16']) })
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('7')
			.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependency: ['16'] })
			.constant('13')
			.defineVariable('12', 'x', { definedBy: ['13', '14'], controlDependency: ['16'] })
			.defineVariable('17', 'y', { definedBy: ['18', '19'] })
		)

		assertDataflow(label('assignment if one branch', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'newlines', 'if', 'numbers']), shell, 'x <- 1\nif(r) { x <- 2 } \n y <- x',  emptyGraph()
			.use('3', 'r')
			.use('12', 'x')
			.reads('12', ['6', '0'])
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
			.call('8', '<-', [argumentInCall('6'), argumentInCall('7')], { returns: ['6'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('9', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('10', 'if', [argumentInCall('3'), argumentInCall('9'), EmptyArgument], { returns: ['9'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', ['10']) })
			.call('13', '<-', [argumentInCall('11'), argumentInCall('12')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '6', '8', ['10']).defineVariable('x', '0', '2', ['10']) })
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('7')
			.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependency: ['10'] })
			.defineVariable('11', 'y', { definedBy: ['12', '13'] })
		)

		assertDataflow(label('assignment if multiple variables with else', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if']),
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			emptyGraph()
				.use('6', 'r')
				.use('24', 'x')
				.reads('24', ['9', '18'])
				.use('27', 'y')
				.reads('27', ['12', '3'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('14', '<-', [argumentInCall('12'), argumentInCall('13')], { returns: ['12'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '9', '11').defineVariable('y', '3', '5') })
				.call('15', '{', [argumentInCall('11'), argumentInCall('14')], { returns: ['14'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '9', '11').defineVariable('y', '3', '5') })
				.call('20', '<-', [argumentInCall('18'), argumentInCall('19')], { returns: ['18'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('21', '{', [argumentInCall('20')], { returns: ['20'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('22', 'if', [argumentInCall('6'), argumentInCall('15'), argumentInCall('21')], { returns: ['15', '21'], reads: ['6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('25', '<-', [argumentInCall('23'), argumentInCall('24')], { returns: ['23'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '12', '14', ['22']).defineVariable('y', '3', '5', ['22']) })
				.call('28', '<-', [argumentInCall('26'), argumentInCall('27')], { returns: ['26'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '12', '14', ['22']).defineVariable('y', '3', '5', ['22']).defineVariable('w', '23', '25') })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.constant('4')
				.defineVariable('3', 'y', { definedBy: ['4', '5'] })
				.constant('10')
				.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependency: ['22'] })
				.constant('13')
				.defineVariable('12', 'y', { definedBy: ['13', '14'], controlDependency: ['22'] })
				.constant('19')
				.defineVariable('18', 'x', { definedBy: ['19', '20'], controlDependency: ['22'] })
				.defineVariable('23', 'w', { definedBy: ['24', '25'] })
				.defineVariable('26', 'z', { definedBy: ['27', '28'] })
		)
		assertDataflow(label('assignment in else block', ['name-normal', ...OperatorDatabase['<-'].capabilities, 'numbers', 'newlines', 'if']), shell, 'x <- 1 \n if(r){} else{x <- 2} \n y <- x',  emptyGraph()
			.use('3', 'r')
			.use('15', 'x')
			.reads('15', ['0', '9'])
			.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
			.call('6', '{', [], { returns: [], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('11', '<-', [argumentInCall('9'), argumentInCall('10')], { returns: ['9'], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('12', '{', [argumentInCall('11')], { returns: ['11'], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
			.call('13', 'if', [argumentInCall('3'), argumentInCall('6'), argumentInCall('12')], { returns: ['6', '12'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2', ['13']).defineVariable('x', '9', '11', ['13']) })
			.call('16', '<-', [argumentInCall('14'), argumentInCall('15')], { returns: ['14'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2', ['13']).defineVariable('x', '9', '11', ['13']) })
			.constant('1')
			.defineVariable('0', 'x', { definedBy: ['1', '2'] })
			.constant('10')
			.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependency: ['13'] })
			.defineVariable('14', 'y', { definedBy: ['15', '16'] })
		)
	})
	describe('Get and assign', () => {
		assertDataflow(label('assign in condition', ['name-normal', 'lambda-syntax', 'numbers', 'if', 'newlines', 'assignment-functions', 'strings', 'normal-definition', 'implicit-return', 'call-normal']),
			shell, `a <- \\() 2
if(y) {
   assign("a", function() 1)
}
a()`,  emptyGraph()
				.use('5', 'y')
				.call('4', '<-', [argumentInCall('0'), argumentInCall('3')], { returns: ['0'], reads: [BuiltIn] })
				.argument('4', ['3', '0'])
				.call('15', 'assign', [argumentInCall('9'), argumentInCall('13')], { returns: [], reads: [], environment: defaultEnv().defineFunction('a', '0', '4'), onlyBuiltIn: true })
				.argument('15', ['13', '9'])
				.call('16', '{', [argumentInCall('8')], { returns: ['8'], reads: [BuiltIn], controlDependency: ['17'], environment: defaultEnv().defineFunction('a', '0', '4') })
				.argument('16', '8')
				.argument('17', '5')
				.argument('17', '16')
				.call('17', 'if', [argumentInCall('5'), argumentInCall('16'), EmptyArgument], { returns: ['16'], reads: ['5', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineFunction('a', '0', '4', ['17']) })
				.call('19', 'a', [], { returns: ['1', '11'], reads: ['9', '0'], environment: defaultEnv().defineFunction('a', '9', '15', ['17']).defineFunction('a', '0', '4', ['17']) })
				.calls('19', ['3', '13'])
				.constant('1', undefined, false)
				.defineFunction('3', ['1'], {
					out:               [],
					in:                [{ nodeId: '1', name: undefined, controlDependencies: [] }],
					unknownReferences: [],
					entryPoint:        '1',
					graph:             new Set(['1']),
					environment:       defaultEnv().pushEnv()
				})
				.defineVariable('0', 'a', { definedBy: ['3', '4'] })
				.constant('11', undefined, false)
				.defineFunction('13', ['11'], {
					out:               [],
					in:                [{ nodeId: '11', name: undefined, controlDependencies: [] }],
					unknownReferences: [],
					entryPoint:        '11',
					graph:             new Set(['11']),
					environment:       defaultEnv().pushEnv()
				})
				.defineVariable('9', '"a"', { definedBy: ['13', '15'], controlDependency: ['17'] })
		)
	})
}))
