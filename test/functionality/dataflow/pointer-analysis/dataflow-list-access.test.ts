import { describe } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../_helper/label';

describe.sequential('List Access', withShell(shell => {
	describe('Access named argument', () => {
		assertDataflow(
			label('Assert reads edge to named argument', ['name-normal', 'function-calls', 'named-arguments', 'dollar-access', 'subsetting-multiple']),
			shell,
			`person <- list(age = 24, name = "John")
person$name`,
			emptyGraph()
				.defineVariable('1@person')
				.reads('2@person', '1@person')
				.reads('2@$', '7'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);
	});
}));
