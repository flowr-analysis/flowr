import {
	DataflowGraph, EdgeType,
	initializeCleanEnvironments
} from '../../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { appendEnvironment, define } from '../../../../../src/dataflow/environments'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { defaultEnv } from '../../../_helper/environment-builder'

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
								.use('3', 'x', { environment: defaultEnv().defineVariable('x', '0', '2') })
								.reads('3', '0')
						)
						assertDataflow('read previous def in then',
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							emptyGraph()
								.defineVariable('0', 'x')
								.use('4', 'x', { environment: defaultEnv().defineVariable('x', '0', '2') })
								.reads('4', '0')
						)
					})
				}
				assertDataflow('read previous def in else',
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,
					emptyGraph()
						.defineVariable('0', 'x')
						.use('6', 'x', { environment: defaultEnv().defineVariable('x', '0', '2') })
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
							.use('6', 'x', { environment: defaultEnv().defineVariable('x', '1', '3') })
							.reads('6', '1')
					)
				}
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.defineVariable('3', 'x')
						.use('8', 'x', { environment: defaultEnv().defineVariable('x', '3', '5') })
						.reads('8', '3')
				)

				const whenEnvironment = defaultEnv().defineVariable('x', '1', '3', 'maybe')
				const otherwiseEnvironment = defaultEnv().defineVariable('x', '5', '7', 'maybe')

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.use('0', 'z')
						.defineVariable('1', 'x', { when: 'maybe' })
						.defineVariable('5', 'x', { when: 'maybe' })
						.use('10', 'x', { environment: whenEnvironment.appendWritesOf(otherwiseEnvironment) })
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
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'r',environment: envWithX() } )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'variable-definition', id: '8', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '14', name: 'x', environment: define({ nodeId: '8',name: 'x', used: 'maybe',kind: 'variable',definedAt: '10' }, false, envThenBranch()) })
				.addVertex( { tag: 'variable-definition', id: '13', name: 'y', environment: define({ nodeId: '8',name: 'x', used: 'maybe',kind: 'variable',definedAt: '10' }, false, envThenBranch()) })
				.addEdge('0', '8', EdgeType.SameDefDef, 'maybe')
				.addEdge('0', '4', EdgeType.SameDefDef, 'maybe')
				.addEdge('14', '4', EdgeType.Reads, 'maybe')
				.addEdge('14', '8', EdgeType.Reads, 'maybe')
				.addEdge('13', '14', EdgeType.DefinedBy, 'always')
		)
		const envWithXMaybe = () => define({ nodeId: '0', name: 'x', kind: 'variable', definedAt: '2', used: 'maybe' }, false, initializeCleanEnvironments())
		const envWithSecondXMaybe = () => define({ nodeId: '4', name: 'x', kind: 'variable', definedAt: '6', used: 'maybe' }, false, initializeCleanEnvironments())
		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: envWithX() } )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '10', name: 'x', environment: appendEnvironment(envWithSecondXMaybe(), envWithXMaybe()) })
				.addVertex( { tag: 'variable-definition', id: '9', name: 'y', environment: appendEnvironment(envWithSecondXMaybe(), envWithXMaybe()) })
				.addEdge('0', '4', EdgeType.SameDefDef, 'maybe')
				.addEdge('10', '0', EdgeType.Reads, 'maybe')
				.addEdge('10', '4', EdgeType.Reads, 'maybe')
				.addEdge('9', '10', EdgeType.DefinedBy, 'always')
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
			new DataflowGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex({ tag: 'variable-definition', id: '3', name: 'y', environment: envWithX() })
				.addVertex({ tag: 'use', id: '6', name: 'r', environment: appendEnvironment(envWithX(), envWithY()) })
				.addVertex({ tag: 'variable-definition', id: '7', name: 'x', environment: appendEnvironment(envWithX(),envWithY()), when: 'maybe' })
				.addVertex({ tag: 'variable-definition', id: '10', name: 'y', environment: appendEnvironment(envWithXThen(), envWithY()), when: 'maybe' })
				.addVertex({ tag: 'variable-definition', id: '14', name: 'x', environment: appendEnvironment(envWithX(),envWithY()), when: 'maybe' })
				.addVertex({ tag: 'use', id: '20', name: 'x', environment: envDirectlyAfterIf() })
				.addVertex({ tag: 'use', id: '23', name: 'y', environment: appendEnvironment(envDirectlyAfterIf(), envWithW()) })
				.addVertex({ tag: 'variable-definition', id: '19', name: 'w', environment: envDirectlyAfterIf() })
				.addVertex({ tag: 'variable-definition', id: '22', name: 'z', environment: appendEnvironment(envDirectlyAfterIf(), envWithW()) })
				.addEdge('20', '7', EdgeType.Reads, 'maybe')
				.addEdge('20', '14', EdgeType.Reads, 'maybe')
				.addEdge('23', '3', EdgeType.Reads, 'maybe')
				.addEdge('23', '10', EdgeType.Reads, 'maybe')
				.addEdge('19', '20', EdgeType.DefinedBy, 'always')
				.addEdge('22', '23', EdgeType.DefinedBy, 'always')
				.addEdge('7', '0', EdgeType.SameDefDef, 'maybe')
				.addEdge('14', '0', EdgeType.SameDefDef, 'maybe')
				.addEdge('10', '3', EdgeType.SameDefDef, 'maybe')
		)
		const envWithElseXMaybe = () => define({ nodeId: '5', name: 'x', kind: 'variable', definedAt: '7', used: 'maybe' }, false, initializeCleanEnvironments())
		assertDataflow('assignment in else block',
			shell,
			'x <- 1 \n if(r){} else{x <- 2} \n y <- x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'r', environment: envWithX() } )
				.addVertex( { tag: 'variable-definition', id: '5', name: 'x', environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '11', name: 'x', environment: appendEnvironment(envWithElseXMaybe(), envWithXMaybe()) })
				.addVertex( { tag: 'variable-definition', id: '10', name: 'y', environment: appendEnvironment(envWithElseXMaybe(), envWithXMaybe()) })
				.addEdge('0', '5', EdgeType.SameDefDef, 'maybe')
				.addEdge('11', '0', EdgeType.Reads, 'maybe')
				.addEdge('11', '5', EdgeType.Reads, 'maybe')
				.addEdge('10', '11', EdgeType.DefinedBy, 'always')
		)
	})
}))
