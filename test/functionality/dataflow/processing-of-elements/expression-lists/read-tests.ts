import type { NodeId } from '../../../../../src/r-bridge'
import { initializeCleanEnvironments } from '../../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { define } from '../../../../../src/dataflow/environments'
import { LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('Lists with variable references', withShell(shell => {
	describe('read-read same variable', () => {
		const sameGraph = (id1: NodeId, id2: NodeId) =>
			emptyGraph()
				.uses(id1, 'x')
				.uses(id2, 'x')
				.sameRead(id1, id2)
		assertDataflow('directly together', shell,
			'x\nx',
			sameGraph('0', '1')
		)
		assertDataflow('surrounded by uninteresting elements', shell,
			'3\nx\n1\nx\n2',
			sameGraph('1', '3')
		)
		assertDataflow('using braces', shell,
			'{ x }\n{{ x }}',
			sameGraph('0', '1')
		)
		assertDataflow('using braces and uninteresting elements', shell,
			'{ x + 2 }; 4 - { x }',
			sameGraph('0', '4')
		)

		assertDataflow('multiple occurrences of same variable', shell,
			'x\nx\n3\nx',
			emptyGraph()
				.uses('0', 'x')
				.uses('1', 'x')
				.uses('3', 'x')
				.sameRead('0', '1')
				.sameRead('0', '3')
		)
	})
	describe('def-def same variable', () => {
		const sameGraph = (id1: NodeId, id2: NodeId, definedAt: NodeId) =>
			emptyGraph()
				.definesVariable(id1, 'x')
				.definesVariable(id2, 'x', LocalScope, 'always', define({ nodeId: id1, name: 'x', scope: LocalScope, kind: 'variable', definedAt, used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.sameDef(id1, id2)
		assertDataflow('directly together', shell,
			'x <- 1\nx <- 2',
			sameGraph('0', '3', '2')
		)
		assertDataflow('directly together with mixed sides', shell,
			'1 -> x\nx <- 2',
			sameGraph('1', '3', '2')
		)
		assertDataflow('surrounded by uninteresting elements', shell,
			'3\nx <- 1\n1\nx <- 3\n2',
			sameGraph('1', '5', '3')
		)
		assertDataflow('using braces', shell,
			'{ x <- 42 }\n{{ x <- 50 }}',
			sameGraph('0', '3', '2')
		)
		assertDataflow('using braces and uninteresting elements', shell,
			'5; { x <- 2 }; 17; 4 -> x; 9',
			sameGraph('1', '6', '3')
		)

		assertDataflow('multiple occurrences of same variable', shell,
			'x <- 1\nx <- 3\n3\nx <- 9',
			emptyGraph()
				.definesVariable('0', 'x')
				.definesVariable('3', 'x', LocalScope, 'always', define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.definesVariable('7', 'x', LocalScope, 'always', define({ nodeId: '3', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.sameDef('0', '3')
				.sameDef('3', '7')
		)
	})
	describe('def followed by read', () => {
		const sameGraph = (id1: NodeId, id2: NodeId, definedAt: NodeId) =>
			emptyGraph()
				.definesVariable(id1, 'x')
				.uses(id2, 'x', 'always', define({ nodeId: id1, name: 'x', scope: LocalScope, kind: 'variable', definedAt, used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.reads(id2, id1)
		assertDataflow('directly together', shell,
			'x <- 1\nx',
			sameGraph('0', '3', '2')
		)
		assertDataflow('surrounded by uninteresting elements', shell,
			'3\nx <- 1\n1\nx\n2',
			sameGraph('1', '5', '3')
		)
		assertDataflow('using braces', shell,
			'{ x <- 1 }\n{{ x }}',
			sameGraph('0', '3', '2')
		)
		assertDataflow('using braces and uninteresting elements', shell,
			'{ x <- 2 }; 5; x',
			sameGraph('0', '4', '2')
		)
		assertDataflow('redefinition links correctly', shell,
			'x <- 2; x <- 3; x',
			emptyGraph()
				.definesVariable('0', 'x')
				.definesVariable('3', 'x', LocalScope, 'always', define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.uses('6', 'x', 'always', define({ nodeId: '3', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.reads('6', '3')
				.sameDef('0', '3')
		)
		assertDataflow('multiple redefinition with circular definition', shell,
			'x <- 2; x <- x; x',
			emptyGraph()
				.definesVariable('0', 'x')
				.definesVariable('3', 'x', LocalScope, 'always', define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.uses('4', 'x' , 'always', define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.uses('6', 'x', 'always', define({ nodeId: '3', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.reads('4', '0')
				.definedBy('3', '4')
				.sameDef('0', '3')
				.reads('6', '3')
		)
		assertDataflow('duplicate circular definition', shell,
			'x <- x; x <- x;',
			emptyGraph()
				.definesVariable('0', 'x')
				.uses('1', 'x')
				.definesVariable('3', 'x', LocalScope, 'always', define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.uses('4', 'x', 'always', define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()))
				.definedBy('0', '1')
				.definedBy('3', '4')
				.reads('4', '0')
				.sameDef('0', '3')
		)
	})
}))
