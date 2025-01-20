import { describe } from 'vitest';
import { assertContainerIndicesDefinition, withShell } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { Q } from '../../../../src/search/flowr-search-builder';

describe.sequential('Vector Definition', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'unnamed-arguments', 'subsetting'] as const;

	describe('Simple definition', () => {
		assertContainerIndicesDefinition(
			label('When numbers are defined in vector, then indices are created for them', basicCapabilities),
			shell,
			'c(1, 2.3, 3.1e4, 0xcafe)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 3, },
				{ identifier: { index: 3 }, nodeId: 5, },
				{ identifier: { index: 4 }, nodeId: 7, },
			]
		);

		assertContainerIndicesDefinition(
			label('When strings are defined in vector, then indices are created for them', basicCapabilities),
			shell,
			'c("hello", \'world\', "This is an", \'example\')',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 3, },
				{ identifier: { index: 3 }, nodeId: 5, },
				{ identifier: { index: 4 }, nodeId: 7, },
			]
		);

		assertContainerIndicesDefinition(
			label('When logical values are defined in vector, then indices are created for them', basicCapabilities),
			shell,
			'c(TRUE, FALSE, TRUE, FALSE)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 3, },
				{ identifier: { index: 3 }, nodeId: 5, },
				{ identifier: { index: 4 }, nodeId: 7, },
			]
		);
	});

	describe('Nested vectors', () => {
		assertContainerIndicesDefinition(
			label('When vector starts with nested vector, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(c(1, 2), 3, 4)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 2, },
				{ identifier: { index: 2 }, nodeId: 4, },
				{ identifier: { index: 3 }, nodeId: 8, },
				{ identifier: { index: 4 }, nodeId: 10, },
			]
		);
	
		assertContainerIndicesDefinition(
			label('When vector has nested vector in the middle, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(1, c(2, 3), 4)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 4, },
				{ identifier: { index: 3 }, nodeId: 6, },
				{ identifier: { index: 4 }, nodeId: 10, },
			]
		);
	
		assertContainerIndicesDefinition(
			label('When vector ends with nested vector, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(1, 2, c(3, 4))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 3, },
				{ identifier: { index: 3 }, nodeId: 6, },
				{ identifier: { index: 4 }, nodeId: 8, },
			]
		);

		assertContainerIndicesDefinition(
			label('When vector consists of nested vectors, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(c(1, 2), c(3, 4))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 2, },
				{ identifier: { index: 2 }, nodeId: 4, },
				{ identifier: { index: 3 }, nodeId: 9, },
				{ identifier: { index: 4 }, nodeId: 11, },
			]
		);

		assertContainerIndicesDefinition(
			label('When vector consists of multiple nested vectors, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(c(1, c(2, c(3, 4))))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 2, },
				{ identifier: { index: 2 }, nodeId: 5, },
				{ identifier: { index: 3 }, nodeId: 8, },
				{ identifier: { index: 4 }, nodeId: 10, },
			]
		);
	});

	describe('Nested lists with named arguments', () => {
		const capabilities = [...basicCapabilities, 'named-arguments'] as const;

		assertContainerIndicesDefinition(
			label('When vector starts with nested list, then indices are flattened and correctly defined', capabilities),
			shell,
			'c(list(a = 1, b = 2), 3, 4)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 4, },
				{ identifier: { index: 2 }, nodeId: 7, },
				{ identifier: { index: 3 }, nodeId: 10, },
				{ identifier: { index: 4 }, nodeId: 12, },
			]
		);
	
		assertContainerIndicesDefinition(
			label('When vector has nested vector in the middle, then indices are flattened and correctly defined', capabilities),
			shell,
			'c(1, list(b = 2, c = 3), 4)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 6, },
				{ identifier: { index: 3 }, nodeId: 9, },
				{ identifier: { index: 4 }, nodeId: 12, },
			]
		);
	
		assertContainerIndicesDefinition(
			label('When vector ends with nested vector, then indices are flattened and correctly defined', capabilities),
			shell,
			'c(1, 2, list(c = 3, d = 4))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 3, },
				{ identifier: { index: 3 }, nodeId: 8, },
				{ identifier: { index: 4 }, nodeId: 11, },
			]
		);

		assertContainerIndicesDefinition(
			label('When vector consists of nested vectors, then indices are flattened and correctly defined', capabilities),
			shell,
			'c(list(a = 1, b = 2), list(c = 3, d = 4))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 4, },
				{ identifier: { index: 2 }, nodeId: 7, },
				{ identifier: { index: 3 }, nodeId: 13, },
				{ identifier: { index: 4 }, nodeId: 16, },
			]
		);
	});

	describe('Nested lists with unnamed arguments', () => {
		assertContainerIndicesDefinition(
			label('When vector starts with nested list, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(list(1, 2), 3, 4)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 2, },
				{ identifier: { index: 2 }, nodeId: 4, },
				{ identifier: { index: 3 }, nodeId: 8, },
				{ identifier: { index: 4 }, nodeId: 10, },
			]
		);
	
		assertContainerIndicesDefinition(
			label('When vector has nested vector in the middle, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(1, list(2, 3), 4)',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 4, },
				{ identifier: { index: 3 }, nodeId: 6, },
				{ identifier: { index: 4 }, nodeId: 10, },
			]
		);
	
		assertContainerIndicesDefinition(
			label('When vector ends with nested vector, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(1, 2, list(3, 4))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 1, },
				{ identifier: { index: 2 }, nodeId: 3, },
				{ identifier: { index: 3 }, nodeId: 6, },
				{ identifier: { index: 4 }, nodeId: 8, },
			]
		);

		assertContainerIndicesDefinition(
			label('When vector consists of nested vectors, then indices are flattened and correctly defined', basicCapabilities),
			shell,
			'c(list(1, 2), list(3, 4))',
			Q.criterion('1@c'),
			[
				{ identifier: { index: 1 }, nodeId: 2, },
				{ identifier: { index: 2 }, nodeId: 4, },
				{ identifier: { index: 3 }, nodeId: 9, },
				{ identifier: { index: 4 }, nodeId: 11, },
			]
		);
	});
}));
