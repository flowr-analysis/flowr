import { assertDataflow, withShell } from '../../../helper/shell'
import { DataflowGraph } from '../../../../../src/dataflow'

describe('while', withShell(shell => {
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
