import { describe } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { Q } from '../../../../src/search/flowr-search-builder';

describe.sequential('List Single Index Based Access', withShell(shell => {
	describe.each([{ type: '[[' }, { type: '[' }])('Access using $type', ({ type }) => {
		const basicCapabilities = [
			'name-normal',
			'function-calls',
			'subsetting-multiple',
			type === '[[' ? 'double-bracket-access' : 'single-bracket-access'
		] as const;

		function acc(name: string, index: number) {
			const closingBracket = type === '[[' ? ']]' : ']';
			return `${name}${type}${index}${closingBracket}`;
		}

		describe('Named Arguments', () => {
			const capabilities = [...basicCapabilities, 'named-arguments'] as const;

			describe('Simple access', () => {
				assertDataflow(
					label('When single index is accessed, then access reads index', capabilities),
					shell,
					`numbers <- list(a = 1, b = 2, c = 3, d = 4)
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
					label('When single nested index is accessed, then access reads index', capabilities),
					shell,
					`numbers <- list(a = 1, b = list(a = 2, b = 3), c = 4)
					${acc(acc('numbers', 2), 1)}`,
					(data) =>  emptyGraph()
						.defineVariable('1@numbers')
						.reads('2@numbers', '1@numbers')
						.readsQuery(Q.varInLine(type, 2).last(), '9', data),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					}
				);
			});

			describe('Access with assignment', () => {
				assertDataflow(
					label('When single index is assigned, then access reads index in assignment and definition', capabilities),
					shell,
					`numbers <- list(a = 1, b = 2, c = 3, d = 4)
					${acc('numbers', 1)} <- 5
					${acc('numbers', 1)}`,
					emptyGraph()
						.defineVariable('1@numbers')
						.reads('3@numbers', '1@numbers')
						.reads(`3@${type}`, '4')
						.reads(`3@${type}`, '19'),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					}
				);

				assertDataflow(
					label('When several indices are assigned, then access reads only correct index in assignment and definition', capabilities),
					shell,
					`numbers <- list(a = 1, b = 2, c = 3, d = 4)
					${acc('numbers', 1)} <- 4
					${acc('numbers', 2)} <- 3
					${acc('numbers', 3)} <- 2
					${acc('numbers', 4)} <- 1
					${acc('numbers', 1)}`,
					emptyGraph()
						.defineVariable('1@numbers')
						.reads('6@numbers', '1@numbers')
						.reads(`6@${type}`, '4')
						.reads(`6@${type}`, '19'),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					}
				);
			});
		});

		describe('Unnamed Arguments', () => {
			const capabilities = [...basicCapabilities, 'unnamed-arguments'] as const;

			describe('Simple access', () => {
				assertDataflow(
					label('When single index is accessed, then access reads index', capabilities),
					shell,
					`numbers <- list(1, 2, 3, 4)
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
					label('When single nested index is accessed, then access reads index', capabilities),
					shell,
					`numbers <- list(1, list(2, 3), 4)
					${acc(acc('numbers', 2), 1)}`,
					(data) => emptyGraph()
						.defineVariable('1@numbers')
						.reads('2@numbers', '1@numbers')
						.readsQuery(Q.varInLine(type, 2).last(), '5', data),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					}
				);
			});

			describe('Access with assignment', () => {
				assertDataflow(
					label('When single index is assigned, then access reads index in assignment and definition', capabilities),
					shell,
					`numbers <- list(1, 2, 3, 4)
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
					label('When several indices are assigned, then access reads only correct index in assignment and definition', capabilities),
					shell,
					`numbers <- list(1, 2, 3, 4)
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
			});
		});
	});
}));
