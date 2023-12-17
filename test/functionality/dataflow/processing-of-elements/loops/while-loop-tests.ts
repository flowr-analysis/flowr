import { define, initializeCleanEnvironments } from '../../../../../src/dataflow/common/environments'
import { LocalScope } from '../../../../../src/dataflow/common/environments/scopes'
import { DataflowGraph, EdgeType } from '../../../../../src/dataflow/v1'
import { assertDataflow, withShell } from '../../../_helper/shell'

describe('while', withShell(shell => {
	assertDataflow('simple constant while', shell,
		'while (TRUE) 2',
		new DataflowGraph()
	)
	assertDataflow('using variable in body', shell,
		'while (TRUE) x',
		new DataflowGraph().addVertex({ tag: 'use', id: '1', name: 'x', when: 'maybe' })
	)
	assertDataflow('assignment in loop body', shell,
		'while (TRUE) { x <- 3 }',
		new DataflowGraph().addVertex({ tag: 'variable-definition', id: '1', name: 'x', scope: LocalScope, when: 'maybe' })
	)
	assertDataflow('def compare in loop', shell, 'while ((x <- x - 1) > 0) { x }',
		new DataflowGraph()
			.addVertex({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
			.addVertex({ tag: 'use', id: '1', name: 'x' })
			.addVertex({ tag: 'use', id: '7', name: 'x', when: 'maybe', environment: define({ name: 'x', nodeId: '0', definedAt: '4', used: 'always', kind: 'variable', scope: LocalScope }, LocalScope, initializeCleanEnvironments()) })
			.addEdge('7', '0', EdgeType.Reads, 'maybe')
			.addEdge('0', '1', EdgeType.DefinedBy, 'always')
	)
	assertDataflow('Endless while loop',
		shell,
		'while(TRUE) 1',
		new DataflowGraph()
	)
	assertDataflow('Endless while loop with variables',
		shell,
		'while(x) y',
		new DataflowGraph()
			.addVertex({ tag: 'use', id: '0', name: 'x', when: 'always' })
			.addVertex({ tag: 'use', id: '1', name: 'y', when: 'maybe' })
	)
}))
