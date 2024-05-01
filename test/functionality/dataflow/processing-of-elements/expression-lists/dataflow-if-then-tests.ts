import { assertDataflow, withShell } from '../../../_helper/shell'
import { emptyGraph } from '../../../_helper/dataflow/dataflowgraph-builder'
import { argumentInCall, defaultEnv } from '../../../_helper/dataflow/environment-builder'
import { EmptyArgument } from '../../../../../src'
import { BuiltIn } from '../../../../../src/dataflow'

describe('Lists with if-then constructs', withShell(shell => {
	for(const assign of [ '<-', '<<-', '=']) {
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
							.call('7', '{', [argumentInCall('6', { controlDependency: cd })], { returns: ['6'], reads: [BuiltIn], controlDependency: cd, environment: defaultEnv().defineVariable('x', '0', '2') })
						if(b.text !== '') {
							baseGraph.sameRead('7', '11')
								.call('11', '{', [argumentInCall('10', { controlDependency: ['12'] })], { returns: ['10'], reads: [BuiltIn], controlDependency: ['12'], environment: defaultEnv().defineVariable('x', '0', '2') })
								.call('12', 'if', [argumentInCall('3'), argumentInCall('7', { controlDependency: ['12'] }), argumentInCall('11', { controlDependency: ['12'] })], { returns: ['7', '11'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1', '2'] })
								.constant('6', { controlDependency: ['12'] })
								.constant('10', { controlDependency: ['12'] })
						} else {
							baseGraph.call('8', 'if', [argumentInCall('3'), argumentInCall('7', { controlDependency: ['8'] }), EmptyArgument], { returns: ['7'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1', '2'] })
								.constant('6', { controlDependency: ['8'] })
						}
						assertDataflow('read previous def in cond',
							shell,
							`x ${assign} 2\nif(x) { 1 } ${b.text}`,
							baseGraph
						)
						const previousGraph = emptyGraph()
							.use('6', 'x', { controlDependency: cd })
							.reads('6', '0')
							.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
							.call('7', '{', [argumentInCall('6', { controlDependency: cd })], { returns: ['6'], reads: [BuiltIn], controlDependency: cd, environment: defaultEnv().defineVariable('x', '0', '2') })
							.call(cd[0], 'if', [argumentInCall('3'), argumentInCall('7', { controlDependency: cd }), EmptyArgument], { returns: ['7'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
							.constant('1')
							.defineVariable('0', 'x', { definedBy: ['1', '2'] })
							.constant('3')
						// otherwise will be pruned by TRUE
						assertDataflow('read previous def in then',
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							previousGraph
						)
					})
				}
				assertDataflow('read previous def in else',
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,  emptyGraph()
						.use('10', 'x', { controlDependency: ['12'] })
						.reads('10', '0')
						.call('2', assign, [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
						.call('11', '{', [argumentInCall('10', { controlDependency: ['12'] })], { returns: ['10'], reads: [BuiltIn], controlDependency: ['12'], environment: defaultEnv().defineVariable('x', '0', '2') })
						.call('12', 'if', [argumentInCall('3'), EmptyArgument, argumentInCall('11', { controlDependency: ['12'] })], { returns: ['11'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
						.constant('1')
						.defineVariable('0', 'x', { definedBy: ['1', '2'] })
						.constant('3')
				)
			})
			describe('write within if', () => {
				assertDataflow('without else directly together',
					shell,
					`if(TRUE) { x ${assign} 2 }\nx`, emptyGraph()
						.use('8', 'x')
						.reads('8', '3')
						.call('5', assign, [argumentInCall('3', { controlDependency: ['7'] }), argumentInCall('4', { controlDependency: ['7'] })], { returns: ['3'], reads: [BuiltIn], controlDependency: ['7'] })
						.call('6', '{', [argumentInCall('5', { controlDependency: ['7'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['7'] })
						.call('7', 'if', [argumentInCall('0'), argumentInCall('6', { controlDependency: ['7'] }), EmptyArgument], { returns: ['6'], reads: ['0', BuiltIn], onlyBuiltIn: true })
						.constant('0')
						.constant('4', { controlDependency: ['7'] })
						.defineVariable('3', 'x', { definedBy: ['4', '5'], controlDependency: ['7'] })
				)
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,  emptyGraph()
						.use('12', 'x')
						.reads('12', '7')
						.call('9', assign, [argumentInCall('7', { controlDependency: ['11'] }), argumentInCall('8', { controlDependency: ['11'] })], { returns: ['7'], reads: [BuiltIn], controlDependency: ['11'] })
						.call('10', '{', [argumentInCall('9', { controlDependency: ['11'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['11'] })
						.call('11', 'if', [argumentInCall('0'), EmptyArgument, argumentInCall('10', { controlDependency: ['11'] })], { returns: ['10'], reads: ['0', BuiltIn], onlyBuiltIn: true })
						.constant('0')
						.constant('8', { controlDependency: ['11'] })
						.defineVariable('7', 'x', { definedBy: ['8', '9'], controlDependency: ['11'] })
				)

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,  emptyGraph()
						.use('0', 'z')
						.use('14', 'x')
						.reads('14', ['3', '9'])
						.call('5', assign, [argumentInCall('3', { controlDependency: ['13'] }), argumentInCall('4', { controlDependency: ['13'] })], { returns: ['3'], reads: [BuiltIn], controlDependency: ['13'] })
						.sameRead('5', '11')
						.call('6', '{', [argumentInCall('5', { controlDependency: ['13'] })], { returns: ['5'], reads: [BuiltIn], controlDependency: ['13'] })
						.sameRead('6', '12')
						.call('11', assign, [argumentInCall('9', { controlDependency: ['13'] }), argumentInCall('10', { controlDependency: ['13'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['13'] })
						.call('12', '{', [argumentInCall('11', { controlDependency: ['13'] })], { returns: ['11'], reads: [BuiltIn], controlDependency: ['13'] })
						.call('13', 'if', [argumentInCall('0'), argumentInCall('6', { controlDependency: ['13'] }), argumentInCall('12', { controlDependency: ['13'] })], { returns: ['6', '12'], reads: ['0', BuiltIn], onlyBuiltIn: true })
						.constant('4', { controlDependency: ['13'] })
						.defineVariable('3', 'x', { definedBy: ['4', '5'], controlDependency: ['13'] })
						.constant('10', { controlDependency: ['13'] })
						.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependency: ['13'] })
				)
			})
		})
	}
	describe('Branch Coverage', () => {
		//All test related to branch coverage (testing the interaction between then end else block)
		assertDataflow('assignment both branches in if',
			shell,
			'x <- 1\nif(r) { x <- 2 } else { x <- 3}\n y <- x',
			emptyGraph()
				.use('3', 'r')
				.use('18', 'x')
				.reads('18', ['0', '6', '12'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', ['8', '14', '19'])
				.call('8', '<-', [argumentInCall('6', { controlDependency: ['16'] }), argumentInCall('7', { controlDependency: ['16'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.sameRead('8', '14')
				.call('9', '{', [argumentInCall('8', { controlDependency: ['16'] })], { returns: ['8'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.sameRead('9', '15')
				.call('14', '<-', [argumentInCall('12', { controlDependency: ['16'] }), argumentInCall('13', { controlDependency: ['16'] })], { returns: ['12'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('15', '{', [argumentInCall('14', { controlDependency: ['16'] })], { returns: ['14'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('16', 'if', [argumentInCall('3'), argumentInCall('9', { controlDependency: ['16'] }), argumentInCall('15', { controlDependency: ['16'] })], { returns: ['9', '15'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('19', '<-', [argumentInCall('17'), argumentInCall('18')], { returns: ['17'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['16']).defineVariable('x', '12', '14', ['16']) })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', ['6', '12'])
				.constant('7', { controlDependency: ['16'] })
				.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependency: ['16'] })
				.constant('13', { controlDependency: ['16'] })
				.defineVariable('12', 'x', { definedBy: ['13', '14'], controlDependency: ['16'] })
				.defineVariable('17', 'y', { definedBy: ['18', '19'] })
		)

		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			emptyGraph()
				.use('3', 'r')
				.use('12', 'x')
				.reads('12', ['0', '6'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', ['8', '13'])
				.call('8', '<-', [argumentInCall('6', { controlDependency: ['10'] }), argumentInCall('7', { controlDependency: ['10'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('9', '{', [argumentInCall('8', { controlDependency: ['10'] })], { returns: ['8'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('10', 'if', [argumentInCall('3'), argumentInCall('9', { controlDependency: ['10'] }), EmptyArgument], { returns: ['9'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('13', '<-', [argumentInCall('11'), argumentInCall('12')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['10']) })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '6')
				.constant('7', { controlDependency: ['10'] })
				.defineVariable('6', 'x', { definedBy: ['7', '8'], controlDependency: ['10'] })
				.defineVariable('11', 'y', { definedBy: ['12', '13'] })
		)

		assertDataflow('assignment if multiple variables with else',
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			emptyGraph()
				.use('6', 'r')
				.use('24', 'x')
				.reads('24', ['0', '9', '18'])
				.use('27', 'y')
				.reads('27', ['3', '12'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', ['5', '11', '14', '20', '25', '28'])
				.call('5', '<-', [argumentInCall('3'), argumentInCall('4')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('11', '<-', [argumentInCall('9', { controlDependency: ['22'] }), argumentInCall('10', { controlDependency: ['22'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.sameRead('11', ['14', '20'])
				.call('14', '<-', [argumentInCall('12', { controlDependency: ['22'] }), argumentInCall('13', { controlDependency: ['22'] })], { returns: ['12'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('y', '3', '5') })
				.call('15', '{', [argumentInCall('11', { controlDependency: ['22'] }), argumentInCall('14', { controlDependency: ['22'] })], { returns: ['14'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('y', '3', '5') })
				.sameRead('15', '21')
				.call('20', '<-', [argumentInCall('18', { controlDependency: ['22'] }), argumentInCall('19', { controlDependency: ['22'] })], { returns: ['18'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('21', '{', [argumentInCall('20', { controlDependency: ['22'] })], { returns: ['20'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('22', 'if', [argumentInCall('6'), argumentInCall('15', { controlDependency: ['22'] }), argumentInCall('21', { controlDependency: ['22'] })], { returns: ['15', '21'], reads: ['6', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.call('25', '<-', [argumentInCall('23'), argumentInCall('24')], { returns: ['23'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '3', '5').defineVariable('y', '12', '14', ['22']) })
				.call('28', '<-', [argumentInCall('26'), argumentInCall('27')], { returns: ['26'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '3', '5').defineVariable('y', '12', '14', ['22']).defineVariable('w', '23', '25') })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', ['9', '18'])
				.constant('4')
				.defineVariable('3', 'y', { definedBy: ['4', '5'] })
				.sameDef('3', '12')
				.constant('10', { controlDependency: ['22'] })
				.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependency: ['22'] })
				.constant('13', { controlDependency: ['22'] })
				.defineVariable('12', 'y', { definedBy: ['13', '14'], controlDependency: ['22'] })
				.constant('19', { controlDependency: ['22'] })
				.defineVariable('18', 'x', { definedBy: ['19', '20'], controlDependency: ['22'] })
				.defineVariable('23', 'w', { definedBy: ['24', '25'] })
				.defineVariable('26', 'z', { definedBy: ['27', '28'] })
		)
		assertDataflow('assignment in else block',
			shell,
			'x <- 1 \n if(r){} else{x <- 2} \n y <- x',
			emptyGraph()
				.use('3', 'r')
				.use('15', 'x')
				.reads('15', ['0', '9'])
				.call('2', '<-', [argumentInCall('0'), argumentInCall('1')], { returns: ['0'], reads: [BuiltIn] })
				.sameRead('2', ['11', '16'])
				.call('6', '{', [], { returns: [], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.sameRead('6', '12')
				.call('11', '<-', [argumentInCall('9', { controlDependency: ['13'] }), argumentInCall('10', { controlDependency: ['13'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('12', '{', [argumentInCall('11', { controlDependency: ['13'] })], { returns: ['11'], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.call('13', 'if', [argumentInCall('3'), argumentInCall('6', { controlDependency: ['13'] }), argumentInCall('12', { controlDependency: ['13'] })], { returns: ['6', '12'], reads: ['3', BuiltIn], onlyBuiltIn: true, environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['13']) })
				.call('16', '<-', [argumentInCall('14'), argumentInCall('15')], { returns: ['14'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['13']) })
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1', '2'] })
				.sameDef('0', '9')
				.constant('10', { controlDependency: ['13'] })
				.defineVariable('9', 'x', { definedBy: ['10', '11'], controlDependency: ['13'] })
				.defineVariable('14', 'y', { definedBy: ['15', '16'] })
		)
	})
}))
