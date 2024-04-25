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
							.defineVariable('1', 'x')
							.use('6', 'x')
							.reads('6', '1')
					)
				}
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.defineVariable('3', 'x')
						.use('8', 'x')
						.reads('8', '3')
				)

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.use('0', 'z')
						.defineVariable('1', 'x', { controlDependency: [] })
						.defineVariable('5', 'x', { controlDependency: [] })
						.use('10', 'x')
						.reads('10', '1')
						.reads('10', '5')
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
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', controlDependency: undefined })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined, controlDependency: undefined })
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', controlDependency: [] })
				.addVertex( { tag: 'variable-definition', id: '8', name: 'x', controlDependency: [] })
				.addVertex( { tag: 'use', id: '14', name: 'x', environment: undefined, controlDependency: undefined })
				.addVertex( { tag: 'variable-definition', id: '13', name: 'y', controlDependency: undefined })
				.sameDef('0', '8')
				.sameDef('0', '4')
				.reads('14', '4')
				.reads('14', '8')
				.definedBy('13', '14')
		)

		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			emptyGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', controlDependency: undefined })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined, controlDependency: undefined } )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', controlDependency: [] } )
				.addVertex( { tag: 'use', id: '10', name: 'x', environment: undefined, controlDependency: undefined })
				.addVertex( { tag: 'variable-definition', id: '9', name: 'y', controlDependency: undefined })
				.sameDef('0', '4')
				.reads('10', '0')
				.reads('10', '4')
				.definedBy('9', '10')
		)

		assertDataflow('assignment if multiple variables with else',
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			emptyGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '3', name: 'y', controlDependency: undefined })
				.addVertex({ tag: 'use', id: '6', name: 'r', environment: undefined, controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '7', name: 'x', controlDependency: [] })
				.addVertex({ tag: 'variable-definition', id: '10', name: 'y', controlDependency: [] })
				.addVertex({ tag: 'variable-definition', id: '14', name: 'x', controlDependency: [] })
				.addVertex({ tag: 'use', id: '20', name: 'x', environment: undefined, controlDependency: undefined })
				.addVertex({ tag: 'use', id: '23', name: 'y', environment: undefined, controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '19', name: 'w', controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '22', name: 'z', controlDependency: undefined })
				.reads('20', '7')
				.reads('20', '14')
				.reads('23', '3')
				.reads('23', '10')
				.definedBy('19', '20')
				.definedBy('22', '23')
				.sameDef('7', '0')
				.sameDef('14', '0')
				.sameDef('10', '3')
		)
		assertDataflow('assignment in else block',
			shell,
			'x <- 1 \n if(r){} else{x <- 2} \n y <- x',
			emptyGraph()
				.defineVariable('0', 'x')
				.use('3', 'r')
				.defineVariable('5', 'x', { controlDependency: [] })
				.use('11', 'x')
				.defineVariable('10', 'y', { controlDependency: [] })
				.sameDef('0', '5')
				.reads('11', '0')
				.reads('11', '5')
				.definedBy('10', '11')
		)
	})
}))
