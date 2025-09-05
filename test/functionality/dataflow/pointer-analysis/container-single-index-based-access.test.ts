import { describe, it } from 'vitest';
import { AccessType, ContainerType, setupContainerFunctions } from '../../_helper/pointer-analysis';
import { assertDataflow, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { Q } from '../../../../src/search/flowr-search-builder';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';

describe.sequential('Container Single Index Based Access', withShell(shell => {
	const config = amendConfig(defaultConfigOptions, c => {
		(c.solver.pointerTracking as boolean) = true;
		return c;
	});

	describe.each(
		[
			{ container: ContainerType.Vector, type: AccessType.DoubleBracket, hasNamedArguments: false },
			{ container: ContainerType.Vector, type: AccessType.SingleBracket, hasNamedArguments: false },
			{ container: ContainerType.List,   type: AccessType.DoubleBracket, hasNamedArguments: false },
			{ container: ContainerType.List,   type: AccessType.SingleBracket, hasNamedArguments: false },
			{ container: ContainerType.List,   type: AccessType.DoubleBracket, hasNamedArguments: true  },
			{ container: ContainerType.List,   type: AccessType.SingleBracket, hasNamedArguments: true  },
			{ container: ContainerType.List,   type: AccessType.Dollar,        hasNamedArguments: true  },
		]
	)('Access for container $container using $type and hasNamedArguments $hasNamedArguments', ({ container, type, hasNamedArguments }) => {
		const {
			acc, accS, def, accessCapability, queryArg, queryNamedArg, queryUnnamedArg, queryAccInLine
		} = setupContainerFunctions(container, type, hasNamedArguments);

		const basicCapabilities = [
			'name-normal',
			'function-calls',
			hasNamedArguments ? 'named-arguments' : 'unnamed-arguments',
			'subsetting-multiple',
			accessCapability,
		] as const;


		describe('Simple access', () => {
			assertDataflow(
				label('When single index is accessed, then access reads index', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
				${acc('numbers', 2)}`,
				async(data) => await emptyGraph()
					.readsQuery(queryAccInLine(2), queryArg(2, '2', 1), data),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				},
				undefined,
				config
			);

			describe.skipIf(container !== ContainerType.Vector)('Flattened Vectors', () => {
				assertDataflow(
					label('When single flattened index is accessed, then access reads index', basicCapabilities),
					shell,
					`numbers <- ${def('1', 'c(2, 3)', '4')}
					${acc('numbers', 2)}`,
					async(data) => await emptyGraph()
						.readsQuery(queryAccInLine(2), queryUnnamedArg('2', 1), data),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					},
					undefined,
					config
				);

				assertDataflow(
					label('When single named flattened list index is accessed, then access reads index', [...basicCapabilities, 'named-arguments']),
					shell,
					`numbers <- ${def('1', 'list(a = 2, b = 3)', '4')}
					${acc('numbers', 2)}`,
					(data) => emptyGraph()
						.readsQuery(queryAccInLine(2), queryNamedArg('a', 1), data),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					},
					undefined,
					config
				);

				assertDataflow(
					label('When single unnamed flattened list index is accessed, then access reads index', basicCapabilities),
					shell,
					`numbers <- ${def('1', 'list(2, 3)', '4')}
					${acc('numbers', 2)}`,
					async(data) => emptyGraph()
						.readsQuery(queryAccInLine(2), queryUnnamedArg('2', 1), data),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					},
					undefined,
					config
				);
			});

			describe.skipIf(container !== ContainerType.List)('Nested Lists', () => {
				assertDataflow(
					label('When single nested index is accessed, then access reads index', basicCapabilities),
					shell,
					`numbers <- ${def('1', ['2', '3'], '4')}
					${acc('numbers', 2, 1)}`,
					async(data) =>  emptyGraph()
						.readsQuery({ query: Q.varInLine(type, 2).last() }, queryArg(3, '2', 1), data),
					{
						expectIsSubgraph:      true,
						resolveIdsAsCriterion: true,
					},
					undefined,
					config
				);

				it.fails('Currently not working, nothing is referenced', () => {
					assertDataflow(
						label('When non existing index is accessed, then parent index is referenced', basicCapabilities),
						shell,
						`a <- ${def('1')}
						b <- ${def('1', 'a')}
						c <- ${def('b')}
						${acc(acc(acc('c', 1), 42), 1)}`,
						(data) =>  emptyGraph()
							.readsQuery(queryAccInLine(4, (query => query.last())), queryArg(1, 'b', 3), data),
						{
							expectIsSubgraph:      true,
							resolveIdsAsCriterion: true,
						},
						undefined,
						config
					);
				});
			});
		});

		describe('Access with assignment', () => {
			assertDataflow(
				label('When single index is assigned, then access reads index in assignment and definition', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2', '3', '4')}
				${acc('numbers', 1)} <- 5
				${acc('numbers', 1)}`,
				(data) =>  emptyGraph()
					.readsQuery(queryAccInLine(3), queryArg(1, '1', 1), data)
					.then((builder) => builder.readsQuery(queryAccInLine(3), queryAccInLine(2), data)),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				},
				undefined,
				config
			);

			assertDataflow(
				label('When several indices are assigned, then access reads only correct index in assignment and definition', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2', '3', '4')}
				${acc('numbers', 1)} <- 4
				${acc('numbers', 2)} <- 3
				${acc('numbers', 3)} <- 2
				${acc('numbers', 4)} <- 1
				${acc('numbers', 1)}`,
				(data) => emptyGraph()
					.readsQuery(queryAccInLine(6), queryArg(1, '1', 1), data)
					.then(builder => builder.readsQuery(queryAccInLine(6), queryAccInLine(2), data)),
				// not reads other indices
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				},
				undefined,
				config
			);

			assertDataflow(
				label('When container is self-redefined with previous assignment, then indices get passed', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
				numbers <- numbers
				${acc('numbers', 1)} <- 1
				print(${acc('numbers', 1)})`,
				(data) => emptyGraph()
					.readsQuery({ query: Q.varInLine('numbers', 2).last() }, { target: '1@numbers' }, data)
					.then(builder =>
						builder.definedByQuery(
							{ query: Q.varInLine('numbers', 2).first() },
							{ query: Q.varInLine('numbers', 2).last() },
							data,
						)),
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				},
				undefined,
				config
			);
		});

		// Only bracket access is affected from unknown access operations.
		describe.skipIf(type === AccessType.Dollar)('Unknown access', () => {
			assertDataflow(
				label('When access cannot be resolved, then all indices are read', basicCapabilities),
				shell,
				`numbers <- ${def('1', '2')}
${acc('numbers', 1)} <- 1
${acc('numbers', 2)} <- 2
${accS('numbers', 'foo()')}`,
				(data) => emptyGraph()
					.readsQuery(queryAccInLine(4), queryArg(1, '1', 1), data)
					.then(builder => builder.readsQuery(queryAccInLine(4), queryArg(2, '2', 1), data))
					.then(builder => builder.readsQuery(queryAccInLine(4), queryAccInLine(2), data))
					.then(builder => builder.readsQuery(queryAccInLine(4), queryAccInLine(3), data))
				,
				{
					expectIsSubgraph:      true,
					resolveIdsAsCriterion: true,
				},
				undefined,
				config
			);
		});
	});
}));
