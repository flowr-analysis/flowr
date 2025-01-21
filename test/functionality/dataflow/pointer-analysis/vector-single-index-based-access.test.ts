import { describe } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';

describe.sequential('Vector Single Index Based Access', withShell(shell => {
	describe.each([{ type: '[[' }, { type: '[' }])('Access using $type', ({ type }) => {
		const basicCapabilities = [
			'name-normal',
			'function-calls',
			'unnamed-arguments',
			'subsetting',
			type === '[[' ? 'double-bracket-access' : 'single-bracket-access'
		] as const;

		function acc(name: string, index: number) {
			const closingBracket = type === '[[' ? ']]' : ']';
			return `${name}${type}${index}${closingBracket}`;
		}

		describe('Simple access', () => {
			assertDataflow(
				label('When single index is accessed, then access reads index', basicCapabilities),
				shell,
				`numbers <- c(1, 2, 3, 4)
				${acc('numbers', 2)}`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('2@numbers', '1@numbers')
					.reads(`2@${type}`, '4'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);

			assertDataflow(
				label('When single flattened index is accessed, then access reads index', basicCapabilities),
				shell,
				`numbers <- c(1, c(2, 3), 4)
				${acc('numbers', 2)}`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('2@numbers', '1@numbers')
					.reads(`2@${type}`, '5'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);

			assertDataflow(
				label('When single named flattened list index is accessed, then access reads index', [...basicCapabilities, 'named-arguments']),
				shell,
				`numbers <- c(1, list(a = 2, b = 3), 4)
				${acc('numbers', 2)}`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('2@numbers', '1@numbers')
					.reads(`2@${type}`, '7'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);

			assertDataflow(
				label('When single unnamed flattened list index is accessed, then access reads index', basicCapabilities),
				shell,
				`numbers <- c(1, list(2, 3), 4)
				${acc('numbers', 2)}`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('2@numbers', '1@numbers')
					.reads(`2@${type}`, '5'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);
		});
	});
}));
