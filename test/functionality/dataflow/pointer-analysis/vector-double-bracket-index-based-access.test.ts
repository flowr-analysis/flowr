import { describe, it } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';

describe.sequential('Vector Access', withShell(shell => {
	describe('Single index access using [[ with a number', () => {
		assertDataflow(
			label('When single index is accessed, then access reads index', []),
			shell,
			`numbers <- c(1, 2, 3, 4)
			numbers[[2]]`,
			emptyGraph()
				.defineVariable('1@numbers')
				.reads('2@numbers', '1@numbers')
				.reads('2@[[', '4'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);

		assertDataflow(
			label('When single nested index is accessed, then access reads index', []),
			shell,
			`numbers <- c(1, c(2, 3), 4)
			numbers[[2]]`,
			emptyGraph()
				.defineVariable('1@numbers')
				.reads('2@numbers', '1@numbers')
				.reads('2@[[', '5'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);

		assertDataflow(
			label('When single named nested list index is accessed, then access reads index', []),
			shell,
			`numbers <- c(1, list(a = 2, b = 3), 4)
			numbers[[2]]`,
			emptyGraph()
				.defineVariable('1@numbers')
				.reads('2@numbers', '1@numbers')
				.reads('2@[[', '7'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);

		it.fails('Currently, unnamed list arguments are not supported', () => {
			assertDataflow(
				label('When single unnamed nested list index is accessed, then access reads index', []),
				shell,
				`numbers <- c(1, list(2, 3), 4)
				numbers[[2]]`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('2@numbers', '1@numbers')
					.reads('2@[[', '5'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);
		});
	});
}));
