import { assertDataflow, withShell } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';

describe.sequential('Function Definition - On.Exit', withShell(shell => {
	describe('Only functions', () => {
		assertDataflow(label('call on.exit at the end', ['normal-definition', 'implicit-return', 'name-normal', 'hooks']),
			shell, 'function() { on.exit(1) }', emptyGraph(), {
				resolveIdsAsCriterion: true
			}
		);
	});
}));
