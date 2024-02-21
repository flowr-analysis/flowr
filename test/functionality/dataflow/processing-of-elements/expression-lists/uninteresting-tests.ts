import { assertDataflow, withShell } from '../../../_helper/shell'
import { DataflowGraph } from '../../../../../src/dataflow/v1'
import { label } from '../../../_helper/label'

describe(label('Lists without variable references ', 'numbers', 'grouping', 'binary-operator'), withShell(shell => {
	for(const b of ['1\n2\n3', '1;2;3', '{ 1 + 2 }\n{ 3 * 4 }']) {
		assertDataflow(`${JSON.stringify(b)}`, shell,
			b,
			new DataflowGraph()
		)
	}
}))
