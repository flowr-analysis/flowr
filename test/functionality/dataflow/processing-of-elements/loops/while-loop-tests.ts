import { DataflowGraph, EdgeType, initializeCleanEnvironments } from '../../../../../src/dataflow'
import { define } from '../../../../../src/dataflow/environments'
import { LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { assertDataflow, withShell } from '../../../_helper/shell'

describe('while', withShell(shell => {
	assertDataflow('simple constant while', shell,
		'while (TRUE) 2',
		new DataflowGraph()
	)
	assertDataflow('using variable in body', shell,
		'while (TRUE) x',
		new DataflowGraph().uses('1', 'x', 'maybe')
	)
	assertDataflow('assignment in loop body', shell,
		'while (TRUE) { x <- 3 }',
		new DataflowGraph().addVertex({ tag: 'variable-definition', id: '1', name: 'x', scope: LocalScope, when: 'maybe' })
	)
	assertDataflow('def compare in loop', shell, 'while ((x <- x - 1) > 0) { x }',
		new DataflowGraph()
			.addVertex({ tag: 'variable-definition', id: '0', name: 'x', scope: LocalScope })
			.uses('1', 'x')
			.uses('7', 'x', 'maybe', define({ name: 'x', nodeId: '0', definedAt: '4', used: 'always', kind: 'variable', scope: LocalScope }, LocalScope, initializeCleanEnvironments()))
			.reads('7', '0', 'maybe')
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
			.uses('0', 'x', 'always')
			.uses('1', 'y', 'maybe')
	)
}))
