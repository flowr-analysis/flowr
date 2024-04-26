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
							.call('2', assign, [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
							.argument('2', ['1-arg', '0-arg'])
							.call('7', '{', [argumentInCall('6-arg', { controlDependency: cd })], { returns: ['6-arg'], reads: [BuiltIn], controlDependency: cd, environment: defaultEnv().defineVariable('x', '0', '2') })
							.argument('7', '6-arg')
							.constant('6', { controlDependency: cd })
						if(b.text !== '') {
							baseGraph.sameRead('7', '11')
								.call('11', '{', [argumentInCall('10-arg', { controlDependency: ['12'] })], { returns: ['10-arg'], reads: [BuiltIn], controlDependency: ['12'], environment: defaultEnv().defineVariable('x', '0', '2') })
								.argument('11', '10-arg')
								.call('12', 'if', [argumentInCall('3-arg'), argumentInCall('7-arg', { controlDependency: ['12'] }), argumentInCall('11-arg', { controlDependency: ['12'] })], { returns: ['7-arg', '11-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
								.argument('12', ['7-arg', '11-arg', '3-arg'])
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1'] })
								.constant('6', { controlDependency: ['12'] })
								.constant('10', { controlDependency: ['12'] })
						} else {
							baseGraph.call('8', 'if', [argumentInCall('3-arg'), argumentInCall('7-arg', { controlDependency: ['8'] }), EmptyArgument], { returns: ['7-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
								.argument('8', ['7-arg', '3-arg'])
								.constant('1')
								.defineVariable('0', 'x', { definedBy: ['1'] })
						}
						assertDataflow('read previous def in cond',
							shell,
							`x ${assign} 2\nif(x) { 1 } ${b.text}`,
							baseGraph
						)
						const previousGraph = emptyGraph()
							.use('6', 'x', { controlDependency: cd })
							.reads('6', '0')
							.call('2', assign, [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
							.argument('2', ['1-arg', '0-arg'])
							.call('7', '{', [argumentInCall('6-arg', { controlDependency: cd })], { returns: ['6-arg'], reads: [BuiltIn], controlDependency: cd, environment: defaultEnv().defineVariable('x', '0', '2') })
							.argument('7', '6-arg')
							.call(cd[0], 'if', [argumentInCall('3-arg'), argumentInCall('7-arg', { controlDependency: cd }), EmptyArgument], { returns: ['7-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
							.argument(cd[0], ['7-arg', '3-arg'])
							.constant('1')
							.defineVariable('0', 'x', { definedBy: ['1'] })
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
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,
					emptyGraph()
						.use('10', 'x', { controlDependency: ['12'] })
						.reads('10', '0')
						.call('2', assign, [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
						.argument('2', ['1-arg', '0-arg'])
						.call('11', '{', [argumentInCall('10-arg', { controlDependency: ['12'] })], {
							returns:           ['10-arg'],
							reads:             [BuiltIn],
							controlDependency: ['12'],
							environment:       defaultEnv().defineVariable('x', '0', '2') })
						.argument('11', '10-arg')
						.call('12', 'if', [argumentInCall('3-arg'), EmptyArgument, argumentInCall('11-arg', { controlDependency: ['12'] })], {
							returns:     ['11-arg'],
							reads:       [BuiltIn],
							environment: defaultEnv().defineVariable('x', '0', '2')
						})
						.argument('12', ['11-arg', '3-arg'])
						.constant('1')
						.defineVariable('0', 'x', { definedBy: ['1'] })
						.constant('3')
				)
			})
			describe('write within if', () => {
				for(const b of [
					{ label: 'without else', text: '' },
					{ label: 'with else', text: ' else { 1 }' },
				]) {
					assertDataflow(`${b.label} directly together`,
						shell,
						`if(TRUE) { x ${assign} 2 }\nx`,
						emptyGraph()
							.use('8', 'x')
							.reads('8', '3')
							.call('5', assign, [argumentInCall('3-arg', { controlDependency: ['7'] }), argumentInCall('4-arg', { controlDependency: ['7'] })], { returns: ['3'], reads: [BuiltIn], controlDependency: ['7'] })
							.argument('5', ['4-arg', '3-arg'])
							.call('6', '{', [argumentInCall('5-arg', { controlDependency: ['7'] })], { returns: ['5-arg'], reads: [BuiltIn], controlDependency: ['7'] })
							.argument('6', '5-arg')
							.call('7', 'if', [argumentInCall('0-arg'), argumentInCall('6-arg', { controlDependency: ['7'] }), EmptyArgument], { returns: ['6-arg'], reads: [BuiltIn] })
							.argument('7', ['6-arg', '0-arg'])
							.constant('0')
							.constant('4', { controlDependency: ['7'] })
							.defineVariable('3', 'x', { definedBy: ['4'], controlDependency: ['7'] })
							.reads('5-arg', '3')
					)
				}
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.use('12', 'x')
						.reads('12', '7')
						.call('9', assign, [argumentInCall('7-arg', { controlDependency: ['11'] }), argumentInCall('8-arg', { controlDependency: ['11'] })], { returns: ['7'], reads: [BuiltIn], controlDependency: ['11'] })
						.argument('9', ['8-arg', '7-arg'])
						.call('10', '{', [argumentInCall('9-arg', { controlDependency: ['11'] })], { returns: ['9-arg'], reads: [BuiltIn], controlDependency: ['11'] })
						.argument('10', '9-arg')
						.call('11', 'if', [argumentInCall('0-arg'), EmptyArgument, argumentInCall('10-arg', { controlDependency: ['11'] })], { returns: ['10-arg'], reads: [BuiltIn] })
						.argument('11', ['10-arg', '0-arg'])
						.constant('0')
						.constant('8', { controlDependency: ['11'] })
						.defineVariable('7', 'x', { definedBy: ['8'], controlDependency: ['11'] })
						.reads('9-arg', '7')
				)

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.use('0', 'z')
						.use('14', 'x')
						.reads('14', ['3', '9'])
						.call('5', assign, [argumentInCall('3-arg', { controlDependency: ['13'] }), argumentInCall('4-arg', { controlDependency: ['13'] })], { returns: ['3'], reads: [BuiltIn], controlDependency: ['13'] })
						.argument('5', ['4-arg', '3-arg'])
						.call('6', '{', [argumentInCall('5-arg', { controlDependency: ['13'] })], { returns: ['5-arg'], reads: [BuiltIn], controlDependency: ['13'] })
						.argument('6', '5-arg')
						.sameRead('6', '12')
						.call('11', assign, [argumentInCall('9-arg', { controlDependency: ['13'] }), argumentInCall('10-arg', { controlDependency: ['13'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['13'] })
						.argument('11', ['10-arg', '9-arg'])
						.call('12', '{', [argumentInCall('11-arg', { controlDependency: ['13'] })], { returns: ['11-arg'], reads: [BuiltIn], controlDependency: ['13'] })
						.argument('12', '11-arg')
						.call('13', 'if', [argumentInCall('0-arg'), argumentInCall('6-arg', { controlDependency: ['13'] }), argumentInCall('12-arg', { controlDependency: ['13'] })], { returns: ['6-arg', '12-arg'], reads: [BuiltIn] })
						.argument('13', ['6-arg', '12-arg', '0-arg'])
						.constant('4', { controlDependency: ['13'] })
						.defineVariable('3', 'x', { definedBy: ['4'], controlDependency: ['13'] })
						.reads('5-arg', '3')
						.constant('10', { controlDependency: ['13'] })
						.defineVariable('9', 'x', { definedBy: ['10'], controlDependency: ['13'] })
						.reads('11-arg', '9')
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
				.call('2', '<-', [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
				.argument('2', ['1-arg', '0-arg'])
				.sameRead('2', '19')
				.call('8', '<-', [argumentInCall('6-arg', { controlDependency: ['16'] }), argumentInCall('7-arg', { controlDependency: ['16'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.argument('8', ['7-arg', '6-arg'])
				.call('9', '{', [argumentInCall('8-arg', { controlDependency: ['16'] })], { returns: ['8-arg'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['16']) })
				.argument('9', '8-arg')
				.sameRead('9', '15')
				.call('14', '<-', [argumentInCall('12-arg', { controlDependency: ['16'] }), argumentInCall('13-arg', { controlDependency: ['16'] })], { returns: ['12'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['16']) })
				.argument('14', ['13-arg', '12-arg'])
				.call('15', '{', [argumentInCall('14-arg', { controlDependency: ['16'] })], { returns: ['14-arg'], reads: [BuiltIn], controlDependency: ['16'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['16']).defineVariable('x', '12', '14', ['16']) })
				.argument('15', '14-arg')
				.call('16', 'if', [argumentInCall('3-arg'), argumentInCall('9-arg', { controlDependency: ['16'] }), argumentInCall('15-arg', { controlDependency: ['16'] })], { returns: ['9-arg', '15-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['16']).defineVariable('x', '12', '14', ['16']) })
				.argument('16', ['9-arg', '15-arg', '3-arg'])
				.call('19', '<-', [argumentInCall('17-arg'), argumentInCall('18-arg')], { returns: ['17'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['16']).defineVariable('x', '12', '14', ['16']) })
				.argument('19', ['18-arg', '17-arg'])
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1'] })
				.constant('7', { controlDependency: ['16'] })
				.defineVariable('6', 'x', { definedBy: ['7'], controlDependency: ['16'] })
				.reads('6', '0')
				.reads('8-arg', '6')
				.constant('13', { controlDependency: ['16'] })
				.defineVariable('12', 'x', { definedBy: ['13'], controlDependency: ['16'] })
				.reads('12', ['0', '6'])
				.reads('14-arg', '12')
				.defineVariable('17', 'y', { definedBy: ['18'] })
		)

		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			emptyGraph()
				.use('3', 'r')
				.use('12', 'x')
				.reads('12', ['0', '6'])
				.call('2', '<-', [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
				.argument('2', ['1-arg', '0-arg'])
				.sameRead('2', '13')
				.call('8', '<-', [argumentInCall('6-arg', { controlDependency: ['10'] }), argumentInCall('7-arg', { controlDependency: ['10'] })], { returns: ['6'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.argument('8', ['7-arg', '6-arg'])
				.call('9', '{', [argumentInCall('8-arg', { controlDependency: ['10'] })], { returns: ['8-arg'], reads: [BuiltIn], controlDependency: ['10'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['10']) })
				.argument('9', '8-arg')
				.call('10', 'if', [argumentInCall('3-arg'), argumentInCall('9-arg', { controlDependency: ['10'] }), EmptyArgument], { returns: ['9-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['10']) })
				.argument('10', ['9-arg', '3-arg'])
				.call('13', '<-', [argumentInCall('11-arg'), argumentInCall('12-arg')], { returns: ['11'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '6', '8', ['10']) })
				.argument('13', ['12-arg', '11-arg'])
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1'] })
				.constant('7', { controlDependency: ['10'] })
				.defineVariable('6', 'x', { definedBy: ['7'], controlDependency: ['10'] })
				.reads('6', '0')
				.reads('8-arg', '6')
				.defineVariable('11', 'y', { definedBy: ['12'] })
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
				.call('2', '<-', [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
				.argument('2', ['1-arg', '0-arg'])
				.sameRead('2', ['5', '25', '28'])
				.call('5', '<-', [argumentInCall('3-arg'), argumentInCall('4-arg')], { returns: ['3'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2') })
				.argument('5', ['4-arg', '3-arg'])
				.call('11', '<-', [argumentInCall('9-arg', { controlDependency: ['22'] }), argumentInCall('10-arg', { controlDependency: ['22'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('y', '3', '5') })
				.argument('11', ['10-arg', '9-arg'])
				.call('14', '<-', [argumentInCall('12-arg', { controlDependency: ['22'] }), argumentInCall('13-arg', { controlDependency: ['22'] })], { returns: ['12'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('y', '3', '5') })
				.argument('14', ['13-arg', '12-arg'])
				.call('15', '{', [argumentInCall('11-arg', { controlDependency: ['22'] }), argumentInCall('14-arg', { controlDependency: ['22'] })], { returns: ['14-arg'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('y', '3', '5') })
				.argument('15', ['11-arg', '14-arg'])
				.sameRead('15', '21')
				.call('20', '<-', [argumentInCall('18-arg', { controlDependency: ['22'] }), argumentInCall('19-arg', { controlDependency: ['22'] })], { returns: ['18'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('y', '3', '5') })
				.argument('20', ['19-arg', '18-arg'])
				.call('21', '{', [argumentInCall('20-arg', { controlDependency: ['22'] })], { returns: ['20-arg'], reads: [BuiltIn], controlDependency: ['22'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '3', '5') })
				.argument('21', '20-arg')
				.call('22', 'if', [argumentInCall('6-arg'), argumentInCall('15-arg', { controlDependency: ['22'] }), argumentInCall('21-arg', { controlDependency: ['22'] })], { returns: ['15-arg', '21-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '3', '5') })
				.argument('22', ['15-arg', '21-arg', '6-arg'])
				.call('25', '<-', [argumentInCall('23-arg'), argumentInCall('24-arg')], { returns: ['23'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '3', '5').defineVariable('y', '12', '14', ['22']) })
				.argument('25', ['24-arg', '23-arg'])
				.call('28', '<-', [argumentInCall('26-arg'), argumentInCall('27-arg')], { returns: ['26'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['22']).defineVariable('x', '18', '20', ['22']).defineVariable('y', '3', '5').defineVariable('y', '12', '14', ['22']).defineVariable('w', '23', '25') })
				.argument('28', ['27-arg', '26-arg'])
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1'] })
				.constant('4')
				.defineVariable('3', 'y', { definedBy: ['4'] })
				.constant('10', { controlDependency: ['22'] })
				.defineVariable('9', 'x', { definedBy: ['10'], controlDependency: ['22'] })
				.reads('9', '0')
				.reads('11-arg', '9')
				.constant('13', { controlDependency: ['22'] })
				.defineVariable('12', 'y', { definedBy: ['13'], controlDependency: ['22'] })
				.reads('12', '3')
				.reads('14-arg', '12')
				.constant('19', { controlDependency: ['22'] })
				.defineVariable('18', 'x', { definedBy: ['19'], controlDependency: ['22'] })
				.reads('18', ['0', '9'])
				.reads('20-arg', '18')
				.defineVariable('23', 'w', { definedBy: ['24'] })
				.defineVariable('26', 'z', { definedBy: ['27'] })
		)
		assertDataflow('assignment in else block',
			shell,
			'x <- 1 \n if(r){} else{x <- 2} \n y <- x',
			emptyGraph()
				.use('3', 'r')
				.use('15', 'x')
				.reads('15', ['0', '9'])
				.call('2', '<-', [argumentInCall('0-arg'), argumentInCall('1-arg')], { returns: ['0'], reads: [BuiltIn] })
				.argument('2', ['1-arg', '0-arg'])
				.sameRead('2', '16')
				.call('6', '{', [], { returns: [], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.sameRead('6', '12')
				.call('11', '<-', [argumentInCall('9-arg', { controlDependency: ['13'] }), argumentInCall('10-arg', { controlDependency: ['13'] })], { returns: ['9'], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2') })
				.argument('11', ['10-arg', '9-arg'])
				.call('12', '{', [argumentInCall('11-arg', { controlDependency: ['13'] })], { returns: ['11-arg'], reads: [BuiltIn], controlDependency: ['13'], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['13']) })
				.argument('12', '11-arg')
				.call('13', 'if', [argumentInCall('3-arg'), argumentInCall('6-arg', { controlDependency: ['13'] }), argumentInCall('12-arg', { controlDependency: ['13'] })], { returns: ['6-arg', '12-arg'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['13']) })
				.argument('13', ['6-arg', '12-arg', '3-arg'])
				.call('16', '<-', [argumentInCall('14-arg'), argumentInCall('15-arg')], { returns: ['14'], reads: [BuiltIn], environment: defaultEnv().defineVariable('x', '0', '2').defineVariable('x', '9', '11', ['13']) })
				.argument('16', ['15-arg', '14-arg'])
				.constant('1')
				.defineVariable('0', 'x', { definedBy: ['1'] })
				.constant('10', { controlDependency: ['13'] })
				.defineVariable('9', 'x', { definedBy: ['10'], controlDependency: ['13'] })
				.reads('9', '0')
				.reads('11-arg', '9')
				.defineVariable('14', 'y', { definedBy: ['15'] })
		)
	})
}))
