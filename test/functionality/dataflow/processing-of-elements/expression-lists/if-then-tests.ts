import {initializeCleanEnvironments } from '../../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { appendEnvironments, define } from '../../../../../src/dataflow/environments'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

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
							emptyGraph()
								.definesVariable('0', 'x', scope)
								.uses('3', 'x', 'always', define({ nodeId: '0', name: 'x', scope, kind: 'variable', definedAt: '2', used: 'always' }, scope, initializeCleanEnvironments()))
								.reads('3', '0')
						)
						assertDataflow('read previous def in then',
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							emptyGraph()
								.definesVariable('0', 'x', scope)
								.uses('4', 'x', 'always', define({ nodeId: '0', name: 'x', scope, kind: 'variable', definedAt: '2', used: 'always' }, scope, initializeCleanEnvironments()) )
								.reads('4', '0')
						)
					})
				}
				assertDataflow('read previous def in else',
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,
					emptyGraph()
						.definesVariable('0', 'x', scope)
						.uses('6', 'x', 'always', define({ nodeId: '0', name: 'x', scope, kind: 'variable', definedAt: '2', used: 'always' }, scope, initializeCleanEnvironments()) )
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
							.definesVariable('1', 'x', scope)
							.uses('6', 'x', 'always', define({ nodeId: '1', name: 'x', scope, kind: 'variable', definedAt: '3', used: 'always' }, scope, initializeCleanEnvironments()))
							.reads('6', '1')
					)
				}
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.definesVariable('3', 'x', scope)
						.uses('8', 'x', 'always', define({ nodeId: '3', name: 'x', scope, kind: 'variable', definedAt: '5', used: 'always' }, scope, initializeCleanEnvironments()))
						.reads('8', '3')
				)

				const whenEnvironment = define({ nodeId: '1', name: 'x', scope, kind: 'variable', definedAt: '3', used: 'maybe' }, scope, initializeCleanEnvironments())
				const otherwiseEnvironment = define({ nodeId: '5', name: 'x', scope, kind: 'variable', definedAt: '7', used: 'maybe' }, scope, initializeCleanEnvironments())

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.addVertex( { tag: 'use', id: '0', name: 'z', when: 'always', scope: scope })
						.definesVariable('1', 'x', scope, 'maybe')
						.definesVariable('5', 'x', scope, 'maybe')
						.uses('10', 'x', 'always', appendEnvironments(whenEnvironment, otherwiseEnvironment))
						.reads('10', '1', 'maybe')
						.reads('10', '5', 'maybe')
				)
			})
		})
	}
}))
