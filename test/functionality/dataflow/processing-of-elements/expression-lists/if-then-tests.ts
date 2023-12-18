import {
	DataflowGraph, EdgeType,
	initializeCleanEnvironments
} from '../../../../../src/dataflow/v1'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { appendEnvironments, define } from '../../../../../src/dataflow/common/environments'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/common/environments/scopes'

describe('Lists with if-then constructs', withShell(shell => {
	for(const assign of [ '<-', '<<-', '=']) {
		const scope = assign === '<<-' ? GlobalScope : LocalScope
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
							new DataflowGraph()
								.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: scope })
								.addVertex( { tag: 'use', id: '3', name: 'x', environment: define({ nodeId: '0', name: 'x', scope, kind: 'variable', definedAt: '2', used: 'always' }, scope, initializeCleanEnvironments()) })
								.addEdge('3', '0', EdgeType.Reads, 'always')
						)
						assertDataflow('read previous def in then',
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							new DataflowGraph()
								.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: scope })
								.addVertex( { tag: 'use', id: '4', name: 'x', when: 'always', environment: define({ nodeId: '0', name: 'x', scope, kind: 'variable', definedAt: '2', used: 'always' }, scope, initializeCleanEnvironments()) })
								.addEdge('4', '0', EdgeType.Reads, 'always')
						)
					})
				}
				assertDataflow('read previous def in else',
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,
					new DataflowGraph()
						.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: scope })
						.addVertex( { tag: 'use', id: '6', name: 'x', when: 'always', environment: define({ nodeId: '0', name: 'x', scope, kind: 'variable', definedAt: '2', used: 'always' }, scope, initializeCleanEnvironments()) })
						.addEdge('6', '0', EdgeType.Reads, 'always')
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
						new DataflowGraph()
							.addVertex( { tag: 'variable-definition', id: '1', name: 'x', when: 'always', scope: scope })
							.addVertex( { tag: 'use', id: '6', name: 'x', environment: define({ nodeId: '1', name: 'x', scope, kind: 'variable', definedAt: '3', used: 'always' }, scope, initializeCleanEnvironments()) })
							.addEdge('6', '1', EdgeType.Reads, 'always')
					)
				}
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
					new DataflowGraph()
						.addVertex( { tag: 'variable-definition', id: '3', name: 'x', when: 'always', scope: scope })
						.addVertex( { tag: 'use', id: '8', name: 'x', environment: define({ nodeId: '3', name: 'x', scope, kind: 'variable', definedAt: '5', used: 'always' }, scope, initializeCleanEnvironments()) })
						.addEdge('8', '3', EdgeType.Reads, 'always')
				)

				const whenEnvironment = define({ nodeId: '1', name: 'x', scope, kind: 'variable', definedAt: '3', used: 'maybe' }, scope, initializeCleanEnvironments())
				const otherwiseEnvironment = define({ nodeId: '5', name: 'x', scope, kind: 'variable', definedAt: '7', used: 'maybe' }, scope, initializeCleanEnvironments())

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
					new DataflowGraph()
						.addVertex( { tag: 'use', id: '0', name: 'z', when: 'always', scope: scope })
						.addVertex( { tag: 'variable-definition', id: '1', name: 'x', scope: scope, when: 'maybe' })
						.addVertex( { tag: 'variable-definition', id: '5', name: 'x', scope: scope, when: 'maybe' })
						.addVertex( { tag: 'use', id: '10', name: 'x', environment: appendEnvironments(whenEnvironment, otherwiseEnvironment) })
						.addEdge('10', '1', EdgeType.Reads, 'maybe')
						.addEdge('10', '5', EdgeType.Reads, 'maybe')
				)
			})
		})
	}
	describe.only('Branch Coverage', () => {
		//All test related to branch coverage (testing the interaction between then end else block)
		const envWithX = () => define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments())
		const envThenBranch = () => define({nodeId: '4', scope: LocalScope, name: 'x', used: 'maybe', kind: 'variable',definedAt: '6'}, LocalScope, initializeCleanEnvironments())
		assertDataflow('assignment both branches in if',
			shell,
			'x <- 1\nif(r) { x <- 2 } else { x <- 3}\n y <- x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope})
				.addVertex( { tag: 'use', id: '3', name: 'r', scope: LocalScope,environment: envWithX()} )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'variable-definition', id: '8', name: 'x', scope: LocalScope, environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '14', name: 'x', scope: LocalScope, environment: define({ nodeId: '8',scope: LocalScope, name: 'x', used: 'maybe',kind: 'variable',definedAt: '10'}, LocalScope, envThenBranch())})
				.addVertex( { tag: 'variable-definition', id: '13', name: 'y', scope: LocalScope, environment: define({ nodeId: '8',scope: LocalScope, name: 'x', used: 'maybe',kind: 'variable',definedAt: '10'}, LocalScope, envThenBranch())})
				.addEdge('0', '8', EdgeType.SameDefDef, 'maybe')
				.addEdge('0', '4', EdgeType.SameDefDef, 'maybe')
				.addEdge('14', '4', EdgeType.Reads, 'maybe')
				.addEdge('14', '8', EdgeType.Reads, 'maybe')
				.addEdge('13', '14', EdgeType.DefinedBy, 'always')
		)
		const envWithXMaybe = () => define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		const envWithSecondXMaybe = () => define({ nodeId: '4', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '6', used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		assertDataflow('assignment if one branch',
			shell,
			'x <- 1\nif(r) { x <- 2 } \n y <- x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope})
				.addVertex( { tag: 'use', id: '3', name: 'r', scope: LocalScope, environment: envWithX()} )
				.addVertex( { tag: 'variable-definition', id: '4', name: 'x', scope: LocalScope, environment: envWithX(), when: 'maybe' } )
				.addVertex( { tag: 'use', id: '10', name: 'x', scope: LocalScope, environment: appendEnvironments(envWithSecondXMaybe(), envWithXMaybe()) })
				.addVertex( { tag: 'variable-definition', id: '9', name: 'y', scope: LocalScope, environment: appendEnvironments(envWithSecondXMaybe(), envWithXMaybe()) })
				.addEdge('0', '4', EdgeType.SameDefDef, 'maybe')
				.addEdge('10', '0', EdgeType.Reads, 'maybe')
				.addEdge('10', '4', EdgeType.Reads, 'maybe')
				.addEdge('9', '10', EdgeType.DefinedBy, 'always')
		)
		const envWithY = () => define({ nodeId: '3', name: 'y', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments())
		const envWithXThen = () => define({ nodeId: '7', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'always' }, LocalScope, initializeCleanEnvironments())
		const envWithXThenMaybe = () => define({ nodeId: '7', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '9', used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		const envWithXElseMaybe = () => define({ nodeId: '14', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '16', used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		const envWithYMaybeBeforeIf = () => define({ nodeId: '3', name: 'y', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'maybe' }, LocalScope, initializeCleanEnvironments())
		const envWithYMaybeInThen = () => define({ nodeId: '10', name: 'y', scope: LocalScope, kind: 'variable', definedAt: '13', used: 'maybe'}, LocalScope, initializeCleanEnvironments())
		const envForYAfterIf = () => appendEnvironments(envWithYMaybeBeforeIf(), envWithYMaybeInThen())
		const envForXAfterIf = () => appendEnvironments(envWithXThenMaybe(), envWithXElseMaybe())
		const envDirectlyAfterIf = () => appendEnvironments(envForYAfterIf(), envForXAfterIf())
		const envWithZ = () => define({ nodeId: '19', name: 'z', scope: LocalScope, kind: 'variable', definedAt: '20', used: 'always' }, LocalScope, initializeCleanEnvironments())
		//const envFirstYReassignment = () => appendEnvironments(envWithXThen(), envWithY())
		assertDataflow('assignment if multiple variables with else',
			shell,
			'x <- 1 \n y <- 2 \n if(r){ x <- 3 \n y <- 4} else {x <- 5} \n w <- x \n z <- y',
			new DataflowGraph()
				.addVertex({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope})
				.addVertex({ tag: 'variable-definition', id: '3', name: 'y', scope: LocalScope, environment: envWithX()})
				.addVertex({ tag: 'use', id: '6', name: 'r', scope: LocalScope, environment: appendEnvironments(envWithX(), envWithY())})
				.addVertex({ tag: 'variable-definition', id: '7', name: 'x', scope: LocalScope, environment: appendEnvironments(envWithX(),envWithY()), when: 'maybe' })
				.addVertex({ tag: 'variable-definition', id: '10', name: 'y', scope: LocalScope, environment: appendEnvironments(envWithXThen(), envWithY()), when: 'maybe'})
				.addVertex({ tag: 'variable-definition', id: '14', name: 'x', scope: LocalScope, environment: appendEnvironments(envWithX(),envWithY()), when: 'maybe' })
				.addVertex({ tag: 'use', id: '20', name: 'x', scope: LocalScope, environment: envDirectlyAfterIf()})
				.addVertex({ tag: 'use', id: '23', name: 'y', scope: LocalScope, environment: appendEnvironments(envDirectlyAfterIf(), envWithZ())})
				.addVertex({ tag: 'variable-definition', id: '19', name: 'w', scope: LocalScope, environment: envDirectlyAfterIf()})
				.addVertex({ tag: 'variable-definition', id: '22', name: 'z', scope: LocalScope, environment: appendEnvironments(envDirectlyAfterIf(), envWithZ())})
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
	})
}))
