import { assertDataflow, withShell } from '../../../_helper/shell'
import { label } from '../../../_helper/label'
import { emptyGraph } from '../../../_helper/dataflowgraph-builder'

describe(label('Lists without variable references ', 'numbers', 'grouping', 'binary-operator'), withShell(shell => {
	for(const b of ['1\n2\n3', '1;2;3', '{ 1 + 2 }\n{ 3 * 4 }']) {
		assertDataflow(`${JSON.stringify(b)}`, shell,
			b,
			emptyGraph()
		)
	}
}))
