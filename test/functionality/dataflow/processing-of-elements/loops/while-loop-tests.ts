import { initializeCleanEnvironments } from '../../../../../src/dataflow'
import { define } from '../../../../../src/dataflow/environments'
import { LocalScope } from '../../../../../src/dataflow/environments/scopes'
import { assertDataflow, withShell } from '../../../_helper/shell'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe('while', withShell(shell => {
	assertDataflow('simple constant while', shell,
		'while (TRUE) 2',
		emptyGraph()
	)
	assertDataflow('using variable in body', shell,
		'while (TRUE) x',
		emptyGraph().uses('1', 'x', 'maybe')
	)
	assertDataflow('assignment in loop body', shell,
		'while (TRUE) { x <- 3 }',
		emptyGraph().definesVariable('1', 'x', LocalScope, {when: 'maybe'})
	)
	assertDataflow('def compare in loop', shell, 'while ((x <- x - 1) > 0) { x }',
		emptyGraph()
			.definesVariable('0', 'x')
			.uses('1', 'x')
			.uses('7', 'x', 'maybe', define({ name: 'x', nodeId: '0', definedAt: '4', used: 'always', kind: 'variable', scope: LocalScope }, LocalScope, initializeCleanEnvironments()))
			.reads('7', '0', 'maybe')
			.definedBy('0', '1')
	)
	assertDataflow('Endless while loop',
		shell,
		'while(TRUE) 1',
		emptyGraph()
	)
	assertDataflow('Endless while loop with variables',
		shell,
		'while(x) y',
		emptyGraph()
			.uses('0', 'x', 'always')
			.uses('1', 'y', 'maybe')
	)
}))
