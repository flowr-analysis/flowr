import { describe } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { Q } from '../../../../src/search/flowr-search-builder';

describe.sequential('Vector Single Index Based Access', withShell(shell => {
	describe.each([{ type: '[[' }, { type: '[' }])('Access using $type', ({ type }) => {
		const basicCapabilities = [
			'name-normal',
			'function-calls',
			'unnamed-arguments',
			'subsetting-multiple',
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

		describe('Access with assignment', () => {
			assertDataflow(
				label('When single index is assigned, then access reads index in assignment and definition', basicCapabilities),
				shell,
				`numbers <- c(1, 2, 3, 4)
				${acc('numbers', 1)} <- 5
				${acc('numbers', 1)}`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('3@numbers', '1@numbers')
					.reads(`3@${type}`, '2')
					.reads(`3@${type}`, '15'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);

			assertDataflow(
				label('When several indices are assigned, then access reads only correct index in assignment and definition', basicCapabilities),
				shell,
				`numbers <- c(1, 2, 3, 4)
				${acc('numbers', 1)} <- 4
				${acc('numbers', 2)} <- 3
				${acc('numbers', 3)} <- 2
				${acc('numbers', 4)} <- 1
				${acc('numbers', 1)}`,
				emptyGraph()
					.defineVariable('1@numbers')
					.reads('6@numbers', '1@numbers')
					.reads(`6@${type}`, '2')
					.reads(`6@${type}`, '15'),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);

			assertDataflow(
				label('When vector is self-redefined with previous assignment, then indices get passed', basicCapabilities),
				shell,
				`numbers <- c(1, 2)
				numbers <- numbers
				${acc('numbers', 1)} <- 1
				print(${acc('numbers', 1)})`,
				(data) => emptyGraph()
					.defineVariable('1@numbers')
					.readsQuery({ query: Q.varInLine('numbers', 2).last() }, { target: '1@numbers' }, data)
					.definedByQuery(
						{ query: Q.varInLine('numbers', 2).first() },
						{ query: Q.varInLine('numbers', 2).last() },
						data,
					),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				}
			);
		});
	});
}));
