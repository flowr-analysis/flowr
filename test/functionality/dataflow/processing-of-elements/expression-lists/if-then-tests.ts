import { initializeCleanEnvironments } from '../../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { appendEnvironments, define } from '../../../../../src/dataflow/environments'
import { GlobalScope, LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'
import { variable } from '../../../_helper/environment-builder'

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
								.defineVariable('0', 'x', scope)
								.use('3', 'x', { environment: define(variable('x', '2', '0', scope), scope, initializeCleanEnvironments()) })
								.reads('3', '0')
						)
						assertDataflow('read previous def in then',
							shell,
							`x ${assign} 2\nif(TRUE) { x } ${b.text}`,
							emptyGraph()
								.defineVariable('0', 'x', scope)
								.use('4', 'x', { environment: define(variable('x', '2', '0', scope), scope, initializeCleanEnvironments()) })
								.reads('4', '0')
						)
					})
				}
				assertDataflow('read previous def in else',
					shell,
					`x ${assign} 2\nif(FALSE) { 42 } else { x }`,
					emptyGraph()
						.defineVariable('0', 'x', scope)
						.use('6', 'x', { environment: define(variable('x', '2', '0', scope), scope, initializeCleanEnvironments()) })
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
							.defineVariable('1', 'x', scope)
							.use('6', 'x', { environment: define(variable('x', '3', '1', scope), scope, initializeCleanEnvironments()) })
							.reads('6', '1')
					)
				}
				assertDataflow('def in else read afterwards',
					shell,
					`if(FALSE) { 42 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.defineVariable('3', 'x', scope)
						.use('8', 'x', { environment: define(variable('x', '5', '3', scope), scope, initializeCleanEnvironments()) })
						.reads('8', '3')
				)

				const whenEnvironment = define(variable('x', '3', '1', scope, 'maybe'), scope, initializeCleanEnvironments())
				const otherwiseEnvironment = define(variable('x', '7', '5', scope, 'maybe'), scope, initializeCleanEnvironments())

				assertDataflow('def in then and else read afterward',
					shell,
					`if(z) { x ${assign} 7 } else { x ${assign} 5 }\nx`,
					emptyGraph()
						.use('0', 'z', { scope })
						.defineVariable('1', 'x', scope, { when: 'maybe' })
						.defineVariable('5', 'x', scope, { when: 'maybe' })
						.use('10', 'x', { environment: appendEnvironments(whenEnvironment, otherwiseEnvironment) })
						.reads('10', '1', 'maybe')
						.reads('10', '5', 'maybe')
				)
			})
		})
	}
}))
