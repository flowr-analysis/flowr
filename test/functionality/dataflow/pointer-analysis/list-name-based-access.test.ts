import { afterAll, beforeAll, describe } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../_helper/label';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';
import { Q } from '../../../../src/search/flowr-search-builder';

describe.sequential('List Name Based Access', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'named-arguments', 'dollar-access', 'subsetting-multiple'] as const;

	beforeAll(() => {
		amendConfig({ solver: { ...defaultConfigOptions.solver, pointerTracking: true } });
	});

	afterAll(() => {
		amendConfig({ solver: { ...defaultConfigOptions.solver, pointerTracking: false } });
	});

	describe('Simple access', () => {
		assertDataflow(
			label('When single index is accessed, then access reads index', basicCapabilities),
			shell,
			`numbers <- list(a = 1, b = 2, c = 3, d = 4)
			numbers$b`,
			emptyGraph()
				.defineVariable('1@numbers')
				.reads('2@numbers', '1@numbers')
				.reads('2@$', '7'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);

		assertDataflow(
			label('When single nested index is accessed, then access reads index', basicCapabilities),
			shell,
			`numbers <- list(a = 1, b = list(a = 2, b = 3), c = 4)
			numbers$b$a`,
			(data) => emptyGraph()
				.defineVariable('1@numbers')
				.reads('2@numbers', '1@numbers')
				.readsQuery({ query: Q.varInLine('$', 2).last() }, { target: '9' }, data),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);
	});

	describe('Access with assignment', () => {
		assertDataflow(
			label('When single index is assigned, then access reads index in assignment and definition', basicCapabilities),
			shell,
			`numbers <- list(a = 1, b = 2, c = 3, d = 4)
			numbers$a <- 5
			numbers$a`,
			emptyGraph()
				.defineVariable('1@numbers')
				.reads('3@numbers', '1@numbers')
				.reads('3@$', '4')
				.reads('3@$', '19'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);

		assertDataflow(
			label('When several indices are assigned, then access reads only correct index in assignment and definition', basicCapabilities),
			shell,
			`numbers <- list(a = 1, b = 2, c = 3, d = 4)
			numbers$a <- 4
			numbers$b <- 3
			numbers$c <- 2
			numbers$d <- 1
			numbers$a`,
			emptyGraph()
				.defineVariable('1@numbers')
				.reads('6@numbers', '1@numbers')
				.reads('6@$', '4')
				.reads('6@$', '19'),
			{
				expectIsSubgraph:      true,
				resolveIdsAsCriterion: true,
			}
		);
	});
}));
