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
						.defineVariable('1', 'x', { when: 'maybe' })
						.defineVariable('5', 'x', { when: 'maybe' })
						.use('10', 'x')
						.reads('10', '1', 'maybe')
						.reads('10', '5', 'maybe')
				)
			})
		})
	}
	describe('Branch Coverage', () => {
		//All test related to branch coverage (testing the interaction between then end else block)
		const envWithX = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'always' }, false, initializeCleanEnvironments())
		const envThenBranch = () => define({ nodeId: '4', name: 'x', used: 'maybe', kind: 'variable',definedAt: '6' }, false, initializeCleanEnvironments())
		assertDataflow('assignment both branches in if',
			shell,
			'x <- 1\nif(r) { x <- 2 } else { x <- 3}\n y <- x',
			emptyGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined } )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'variable-definition', id: '8', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '14', name: 'x', environment: undefined })
				.addVertex( { tag: 'variable-definition', id: '13', name: 'y', environment: define({ nodeId: '8',name: 'x', used: 'maybe',kind: 'variable',definedAt: '10' }, false, envThenBranch()) })
				.sameDef('0', '8', 'maybe')
				.sameDef('0', '4', 'maybe')
				.reads('14', '4', 'maybe')
				.reads('14', '8', 'maybe')
				.definedBy('13', '14', 'always')
		)
		const envWithXMaybe = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'maybe' }, false, initializeCleanEnvironments())
		const envWithSecondXMaybe = () => define({ nodeId: '4', name: 'x', kind: 'variable', definedAt: '6', used: 'maybe' }, false, initializeCleanEnvironments())
		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			emptyGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined } )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '10', name: 'x', environment: undefined })
				.addVertex( { tag: 'variable-definition', id: '9', name: 'y', environment: appendEnvironment(envWithSecondXMaybe(), envWithXMaybe()) })
				.sameDef('0', '4', 'maybe')
				.reads('10', '0', 'maybe')
				.reads('10', '4', 'maybe')
				.definedBy('9', '10', 'always')
		)
		const envWithY = () => define({ nodeId: '3', name: 'y', kind: 'variable', definedAt: '5', used: 'always' }, false, initializeCleanEnvironments())
		const envWithXThen = () => define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9', used: 'always' }, false, initializeCleanEnvironments())
		const envWithXThenMaybe = () => define({ nodeId: '7', name: 'x', kind: 'variable', definedAt: '9', used: 'maybe' }, false, initializeCleanEnvironments())
		const envWithXElseMaybe = () => define({ nodeId: '14', name: 'x', kind: 'variable', definedAt: '16', used: 'maybe' }, false, initializeCleanEnvironments())
		const envWithYMaybeBeforeIf = () => define({ nodeId: '3', name: 'y', kind: 'variable', definedAt: '5', used: 'maybe' }, false, initializeCleanEnvironments())
		const envWithYMaybeInThen = () => define({ nodeId: '10', name: 'y', kind: 'variable', definedAt: '12', used: 'maybe' }, false, initializeCleanEnvironments())
		const envForYAfterIf = () => appendEnvironment(envWithYMaybeBeforeIf(), envWithYMaybeInThen())
		const envForXAfterIf = () => appendEnvironment(envWithXThenMaybe(), envWithXElseMaybe())
		const envDirectlyAfterIf = () => appendEnvironment(envForYAfterIf(), envForXAfterIf())
		const envWithW = () => define({ nodeId: '19', name: 'w', kind: 'variable', definedAt: '21', used: 'always' }, false, initializeCleanEnvironments())
		//const envFirstYReassignment = () => appendEnvironments(envWithXThen(), envWithY())
		assertDataflow('assignment if multiple variables with else',
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			emptyGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex({ tag: 'variable-definition', id: '3', name: 'y', environment: envWithX() })
				.addVertex({ tag: 'use', id: '6', name: 'r', environment: undefined })
				.addVertex({ tag: 'variable-definition', id: '7', name: 'x', environment: appendEnvironment(envWithX(),envWithY()), when: 'maybe' })
				.addVertex({ tag: 'variable-definition', id: '10', name: 'y', environment: appendEnvironment(envWithXThen(), envWithY()), when: 'maybe' })
				.addVertex({ tag: 'variable-definition', id: '14', name: 'x', environment: appendEnvironment(envWithX(),envWithY()), when: 'maybe' })
				.addVertex({ tag: 'use', id: '20', name: 'x', environment: undefined })
				.addVertex({ tag: 'use', id: '23', name: 'y', environment: undefined })
				.addVertex({ tag: 'variable-definition', id: '19', name: 'w', environment: envDirectlyAfterIf() })
				.addVertex({ tag: 'variable-definition', id: '22', name: 'z', environment: appendEnvironment(envDirectlyAfterIf(), envWithW()) })
				.reads('20', '7',  'maybe')
				.reads('20', '14',  'maybe')
				.reads('23', '3',  'maybe')
				.reads('23', '10',  'maybe')
				.definedBy('19', '20', 'always')
				.definedBy('22', '23', 'always')
				.sameDef('7', '0', 'maybe')
				.sameDef('14', '0', 'maybe')
				.sameDef('10', '3', 'maybe')
		)
		const envWithElseXMaybe = () => define({ nodeId: '5', name: 'x', kind: 'variable', definedAt: '7', used: 'maybe' }, false, initializeCleanEnvironments())
		assertDataflow('assignment in else block',
			shell,
			'x <- 1 \n if(r){} else{x <- 2} \n y <- x',
			emptyGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: undefined } )
				.addVertex( { tag: 'variable-definition', id: '5', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '11', name: 'x', environment: undefined })
				.addVertex( { tag: 'variable-definition', id: '10', name: 'y', environment: appendEnvironment(envWithElseXMaybe(), envWithXMaybe()) })
				.sameDef('0', '5', 'maybe')
				.reads('11', '0', 'maybe')
				.reads('11', '5', 'maybe')
				.definedBy('10', '11', 'always')
		)
	})
}))
