import { describe } from 'vitest';
import { assertContainerIndicesDefinition, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { Q } from '../../../../src/search/flowr-search-builder';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';

describe.sequential('List Definition', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'subsetting-multiple'] as const;

	const config = amendConfig(defaultConfigOptions, c => {
		(c.solver.pointerTracking as boolean) = true;
		return c;
	});

	describe('Named Arguments', () => {
		const capabilities = [...basicCapabilities, 'named-arguments'] as const;

		describe('Simple definition', () => {
			assertContainerIndicesDefinition(
				label('When numbers are defined in list, then indices are created for them', capabilities),
				shell,
				'list(a = 1, b = 2.3, c = 3.1e4, d = 0xcafe)',
				Q.criterion('1@list'),
				[
					{ identifier: { index: 1, lexeme: 'a' }, nodeId: 3, },
					{ identifier: { index: 2, lexeme: 'b' }, nodeId: 6, },
					{ identifier: { index: 3, lexeme: 'c' }, nodeId: 9, },
					{ identifier: { index: 4, lexeme: 'd' }, nodeId: 12, },
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When strings are defined in list, then indices are created for them', capabilities),
				shell,
				'list(a = "hello", b = \'world\', c = "This is an", d = \'example\')',
				Q.criterion('1@list'),
				[
					{ identifier: { index: 1, lexeme: 'a' }, nodeId: 3, },
					{ identifier: { index: 2, lexeme: 'b' }, nodeId: 6, },
					{ identifier: { index: 3, lexeme: 'c' }, nodeId: 9, },
					{ identifier: { index: 4, lexeme: 'd' }, nodeId: 12, },
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When logical values are defined in list, then indices are created for them', capabilities),
				shell,
				'list(a = TRUE, b = FALSE, c = TRUE, d = FALSE)',
				Q.criterion('1@list'),
				[
					{ identifier: { index: 1, lexeme: 'a' }, nodeId: 3, },
					{ identifier: { index: 2, lexeme: 'b' }, nodeId: 6, },
					{ identifier: { index: 3, lexeme: 'c' }, nodeId: 9, },
					{ identifier: { index: 4, lexeme: 'd' }, nodeId: 12, },
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('Appending to list', capabilities),
				shell,
				'x <- list(a = 1)\nx$e <- 3\nx',
				Q.criterion('3@x'),
				[
					{ identifier: { index: 1, lexeme: 'a' }, nodeId: 4 },
					// currently we are unable to track the new index
					{ identifier: { index: undefined, lexeme: 'e' }, nodeId: 10 },
				],
				undefined,
				config
			);

			describe('Skip if index threshold', () => {
				const config = amendConfig(defaultConfigOptions, c => {
					(c.solver.pointerTracking as { maxIndexCount: number }) = { maxIndexCount: 1 };
					return c;
				});

				assertContainerIndicesDefinition(
					label('Over the limit (list)', capabilities),
					shell,
					'list(a = 1, b = 2.3, c = 3.1e4, d = 0xcafe)',
					Q.criterion('1@list'),
					undefined,
					undefined,
					config
				);
				assertContainerIndicesDefinition(
					label('Still works in limit', capabilities),
					shell,
					'list(a = 1)',
					Q.criterion('1@list'),
					[
						{ identifier: { index: 1, lexeme: 'a' }, nodeId: 3, },
					],
					undefined,
					config
				);
			});
		});

		describe('Nested containers', () => {
			const capabilitiesWithUnnamedArgs = [...capabilities, 'unnamed-arguments'] as const;

			assertContainerIndicesDefinition(
				label('When list has nested list with named arguments, then index has sub-indices', capabilities),
				shell,
				'list(a = list(a = 1, b = 2))',
				Q.criterion('1@list'),
				[
					{
						identifier: { index: 1, lexeme: 'a' },
						nodeId:     10,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1, lexeme: 'a' }, nodeId: 5 },
									{ identifier: { index: 2, lexeme: 'b' }, nodeId: 8 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When list has nested list with unnamed arguments, then index has sub-indices', capabilitiesWithUnnamedArgs),
				shell,
				'list(a = list(1, 2))',
				Q.criterion('1@list'),
				[
					{
						identifier: { index: 1, lexeme: 'a' },
						nodeId:     8,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1 }, nodeId: 3 },
									{ identifier: { index: 2 }, nodeId: 5 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When list has nested vector, then index has sub-indices', capabilitiesWithUnnamedArgs),
				shell,
				'list(a = c(1, 2))',
				Q.criterion('1@list'),
				[
					{
						identifier: { index: 1, lexeme: 'a' },
						nodeId:     8,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1 }, nodeId: 3 },
									{ identifier: { index: 2 }, nodeId: 5 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When list has nested list passed as variable, then index has sub-indices', capabilitiesWithUnnamedArgs),
				shell,
				`a <- list(1, 2)
				list(a = a)`,
				Q.criterion('2@list'),
				[
					{
						identifier: { index: 1, lexeme: 'a' },
						nodeId:     11,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1 }, nodeId: 2 },
									{ identifier: { index: 2 }, nodeId: 4 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);
		});
	});

	describe('Unnamed Arguments', () => {
		const capabilities = [...basicCapabilities, 'unnamed-arguments'] as const;

		describe('Simple definition', () => {
			assertContainerIndicesDefinition(
				label('When numbers are defined in list, then indices are created for them', capabilities),
				shell,
				'list(1, 2.3, 3.1e4, 0xcafe)',
				Q.criterion('1@list'),
				[
					{ identifier: { index: 1 }, nodeId: 1, },
					{ identifier: { index: 2 }, nodeId: 3, },
					{ identifier: { index: 3 }, nodeId: 5, },
					{ identifier: { index: 4 }, nodeId: 7, },
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When strings are defined in list, then indices are created for them', capabilities),
				shell,
				'list("hello", \'world\', "This is an", \'example\')',
				Q.criterion('1@list'),
				[
					{ identifier: { index: 1 }, nodeId: 1, },
					{ identifier: { index: 2 }, nodeId: 3, },
					{ identifier: { index: 3 }, nodeId: 5, },
					{ identifier: { index: 4 }, nodeId: 7, },
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When logical values are defined in list, then indices are created for them', capabilities),
				shell,
				'list(TRUE, FALSE, TRUE, FALSE)',
				Q.criterion('1@list'),
				[
					{ identifier: { index: 1 }, nodeId: 1, },
					{ identifier: { index: 2 }, nodeId: 3, },
					{ identifier: { index: 3 }, nodeId: 5, },
					{ identifier: { index: 4 }, nodeId: 7, },
				],
				undefined,
				config
			);
		});

		describe('Nested containers', () => {
			const capabilitiesWithNamedArgs = [...capabilities, 'named-arguments'] as const;

			assertContainerIndicesDefinition(
				label('When list has nested list with named arguments, then index has sub-indices', capabilitiesWithNamedArgs),
				shell,
				'list(list(a = 1, b = 2))',
				Q.criterion('1@list'),
				[
					{
						identifier: { index: 1 },
						nodeId:     8,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1, lexeme: 'a' }, nodeId: 4 },
									{ identifier: { index: 2, lexeme: 'b' }, nodeId: 7 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When list has nested list with unnamed arguments, then index has sub-indices', capabilities),
				shell,
				'list(list(1, 2))',
				Q.criterion('1@list'),
				[
					{
						identifier: { index: 1 },
						nodeId:     6,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1 }, nodeId: 2 },
									{ identifier: { index: 2 }, nodeId: 4 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When list has nested vector, then index has sub-indices', capabilities),
				shell,
				'list(c(1, 2))',
				Q.criterion('1@list'),
				[
					{
						identifier: { index: 1 },
						nodeId:     6,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1 }, nodeId: 2 },
									{ identifier: { index: 2 }, nodeId: 4 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);

			assertContainerIndicesDefinition(
				label('When list has nested list passed as variable, then index has sub-indices', capabilities),
				shell,
				`a <- list(1, 2)
				list(a)`,
				Q.criterion('2@list'),
				[
					{
						identifier: { index: 1 },
						nodeId:     9,
						subIndices: [
							{
								indices: [
									{ identifier: { index: 1 }, nodeId: 2 },
									{ identifier: { index: 2 }, nodeId: 4 },
								],
								isContainer: true,
							}
						]
					},
				],
				undefined,
				config
			);
		});
	});
}));
