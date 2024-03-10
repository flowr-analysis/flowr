import {
	initializeCleanEnvironments
} from '../../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { appendEnvironment, define } from '../../../../../src/dataflow/environments'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('Lists with if-then constructs', withShell(shell => {
	for(const assign of [ '<-', '<<-', '=']) {
		describe(`using ${assign}`, () => {
			describe('reads within if', () => {
				for(const b of [
					{ label: 'without else', text: '' },
					{ label: 'with else', text: ' else { 1 }' },
				]) {
					describe(`${b.label}`, () => {
						assertDataflow('read previous def in cond',
							shell,
							`x ${assign} 2\nif(x) { 1 } ${b.text}`,
							emptyGraph()
								.defineVariable('0', 'x')
								.use('3', 'x')
								.reads('3', '0')
						)
						assertDataflow('read previous def in then',
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							emptyGraph()
								.defineVariable('0', 'x')
								.use('4', 'x')
								.reads('4', '0')
						)
					})
				}
				assertDataflow('read previous def in else',
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,
					emptyGraph()
						.defineVariable('0', 'x')
						.use('6', 'x')
						.reads('6', '0')
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
		const envWithX = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2' }, false, initializeCleanEnvironments())
		const envThenBranch = () => define({ nodeId: '4', name: 'x', controlDependency: [], kind: 'variable',definedAt: '6' }, false, initializeCleanEnvironments())
		assertDataflow('assignment both branches in if',
			shell,
			'x <- 1\nif(r) { x <- 2 } else { x <- 3}\n y <- x',
			emptyGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', controlDependency: undefined })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined, controlDependency: undefined })
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', environment: envWithX(), controlDependency: [] })
				.addVertex( { tag: 'variable-definition', id: '8', name: 'x', environment: envWithX(), controlDependency: [] })
				.addVertex( { tag: 'use', id: '14', name: 'x', environment: undefined, controlDependency: undefined })
				.addVertex( { tag: 'variable-definition', id: '13', name: 'y', environment: define({ nodeId: '8',name: 'x', controlDependency: [],kind: 'variable',definedAt: '10' }, false, envThenBranch()), controlDependency: undefined })
				.sameDef('0', '8')
				.sameDef('0', '4')
				.reads('14', '4')
				.reads('14', '8')
				.definedBy('13', '14')
		)
		const envWithXMaybe = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', controlDependency: [] }, false, initializeCleanEnvironments())
		const envWithSecondXMaybe = () => define({ nodeId: '4', name: 'x', kind: 'variable', definedAt: '6', controlDependency: [] }, false, initializeCleanEnvironments())
		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			emptyGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', controlDependency: undefined })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined, controlDependency: undefined } )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', environment: envWithX(), controlDependency: [] } )
				.addVertex( { tag: 'use', id: '10', name: 'x', environment: undefined, controlDependency: undefined })
				.addVertex( { tag: 'variable-definition', id: '9', name: 'y', environment: appendEnvironment(envWithSecondXMaybe(), envWithXMaybe()), controlDependency: undefined })
				.sameDef('0', '4')
				.reads('10', '0')
				.reads('10', '4')
				.definedBy('9', '10')
		)
		const envWithY = () => define({ nodeId: '3', name: 'y', kind: 'variable', definedAt: '5' }, false, initializeCleanEnvironments())
		const envWithXThen = () => define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9' }, false, initializeCleanEnvironments())
		const envWithXThenMaybe = () => define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9', controlDependency: [] }, false, initializeCleanEnvironments())
		const envWithXElseMaybe = () => define({ nodeId: '14', name: 'x', kind: 'variable', definedAt: '16', controlDependency: [] }, false, initializeCleanEnvironments())
		const envWithYMaybeBeforeIf = () => define({ nodeId: '3', name: 'y', kind: 'variable', definedAt: '5', controlDependency: [] }, false, initializeCleanEnvironments())
		const envWithYMaybeInThen = () => define({ nodeId: '10', name: 'y', kind: 'variable', definedAt: '12', controlDependency: [] }, false, initializeCleanEnvironments())
		const envForYAfterIf = () => appendEnvironment(envWithYMaybeBeforeIf(), envWithYMaybeInThen())
		const envForXAfterIf = () => appendEnvironment(envWithXThenMaybe(), envWithXElseMaybe())
		const envDirectlyAfterIf = () => appendEnvironment(envForYAfterIf(), envForXAfterIf())
		const envWithW = () => define({ nodeId: '19', name: 'w', kind: 'variable', definedAt: '21' }, false, initializeCleanEnvironments())
		//const envFirstYReassignment = () => appendEnvironments(envWithXThen(), envWithY())
		assertDataflow('assignment if multiple variables with else',
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			emptyGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '3', name: 'y', environment: envWithX(), controlDependency: undefined })
				.addVertex({ tag: 'use', id: '6', name: 'r', environment: undefined, controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '7', name: 'x', environment: appendEnvironment(envWithX(),envWithY()), controlDependency: [] })
				.addVertex({ tag: 'variable-definition', id: '10', name: 'y', environment: appendEnvironment(envWithXThen(), envWithY()), controlDependency: [] })
				.addVertex({ tag: 'variable-definition', id: '14', name: 'x', environment: appendEnvironment(envWithX(),envWithY()), controlDependency: [] })
				.addVertex({ tag: 'use', id: '20', name: 'x', environment: undefined, controlDependency: undefined })
				.addVertex({ tag: 'use', id: '23', name: 'y', environment: undefined, controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '19', name: 'w', environment: envDirectlyAfterIf(), controlDependency: undefined })
				.addVertex({ tag: 'variable-definition', id: '22', name: 'z', environment: appendEnvironment(envDirectlyAfterIf(), envWithW()), controlDependency: undefined })
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
		const envWithElseXMaybe = () => define({ nodeId: '5', name: 'x', kind: 'variable', definedAt: '7', controlDependency: [] }, false, initializeCleanEnvironments())
		assertDataflow('assignment in else block',
			shell,
			'x <- 1 \n if(r){} else{x <- 2} \n y <- x',
			emptyGraph()
				.defineVariable('0', 'x')
				.use('3', 'r')
				.defineVariable('5', 'x', { controlDependency: [], environment: envWithX() })
				.use('11', 'x')
				.defineVariable('10', 'y', { controlDependency: [], environment: appendEnvironment(envWithElseXMaybe(), envWithX()) })
				.sameDef('0', '5')
				.reads('11', '0')
				.reads('11', '5')
				.definedBy('10', '11')
		)
	})
}))
