import type { NodeId } from '../../../../../src/r-bridge'
import { DataflowGraph, EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { define } from '../../../../../src/dataflow/environments'
import { LocalScope } from '../../../../../src/dataflow/environments/scopes'

describe('Lists with variable references', withShell(shell => {
	describe('read-read same variable', () => {
		const sameGraph = (id1: NodeId, id2: NodeId) =>
			new DataflowGraph()
				.addVertex( { tag: 'use', id: id1, name: 'x' })
				.addVertex( { tag: 'use', id: id2, name: 'x' })
				.addEdge(id1, id2, EdgeType.SameReadRead, 'always')
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
			new DataflowGraph()
				.addVertex( { tag: 'use', id: '0', name: 'x' })
				.addVertex( { tag: 'use', id: '1', name: 'x' })
				.addVertex( { tag: 'use', id: '3', name: 'x' })
				.addEdge('0', '1', EdgeType.SameReadRead, 'always')
				.addEdge('0', '3', EdgeType.SameReadRead, 'always')
		)
	})
	describe('def-def same variable', () => {
		const sameGraph = (id1: NodeId, id2: NodeId, definedAt: NodeId) =>
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: id1, name: 'x', scope: LocalScope })
				.addVertex( { tag: 'variable-definition', id: id2, name: 'x', scope: LocalScope, environment: define({ nodeId: id1, name: 'x', scope: LocalScope, kind: 'variable', definedAt, used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addEdge(id1, id2, EdgeType.SameDefDef, 'always')
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
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex( { tag: 'variable-definition', id: '3', name: 'x', scope: LocalScope, environment: define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addVertex( { tag: 'variable-definition', id: '7', name: 'x', scope: LocalScope, environment: define({ nodeId: '3', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addEdge('0', '3', EdgeType.SameDefDef, 'always')
				.addEdge('3', '7', EdgeType.SameDefDef, 'always')
		)
	})
	describe('def followed by read', () => {
		const sameGraph = (id1: NodeId, id2: NodeId, definedAt: NodeId) =>
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: id1, name: 'x', scope: LocalScope })
				.addVertex( { tag: 'use', id: id2, name: 'x', environment: define({ nodeId: id1, name: 'x', scope: LocalScope, kind: 'variable', definedAt, used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addEdge(id2, id1, EdgeType.Reads, 'always')
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
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex( { tag: 'variable-definition', id: '3', name: 'x', scope: LocalScope, environment: define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addVertex( { tag: 'use', id: '6', name: 'x', environment: define({ nodeId: '3', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addEdge('6', '3', EdgeType.Reads, 'always')
				.addEdge('0', '3', EdgeType.SameDefDef, 'always')
		)
		assertDataflow('multiple redefinition with circular definition', shell,
			'x <- 2; x <- x; x',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex( { tag: 'variable-definition', id: '3', name: 'x', scope: LocalScope, environment: define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addVertex( { tag: 'use', id: '4', name: 'x' , environment: define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addVertex( { tag: 'use', id: '6', name: 'x', environment: define({ nodeId: '3', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '5', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addEdge('4', '0', EdgeType.Reads, 'always')
				.addEdge('3', '4', EdgeType.DefinedBy, 'always')
				.addEdge('0', '3', EdgeType.SameDefDef, 'always')
				.addEdge('6', '3', EdgeType.Reads, 'always')
		)
		assertDataflow('duplicate circular definition', shell,
			'x <- x; x <- x;',
			new DataflowGraph()
				.addVertex( { tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
				.addVertex( { tag: 'use', id: '1', name: 'x' })
				.addVertex( { tag: 'variable-definition', id: '3', name: 'x', scope: LocalScope, environment: define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addVertex( { tag: 'use', id: '4', name: 'x', environment: define({ nodeId: '0', name: 'x', scope: LocalScope, kind: 'variable', definedAt: '2', used: 'always' }, LocalScope, initializeCleanEnvironments()) })
				.addEdge('0', '1', EdgeType.DefinedBy, 'always')
				.addEdge('3', '4', EdgeType.DefinedBy, 'always')
				.addEdge('4', '0', EdgeType.Reads, 'always')
				.addEdge('0', '3', EdgeType.SameDefDef, 'always')
		)
	})
}))
