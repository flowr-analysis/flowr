import { assert, describe, test } from 'vitest';
import { type InGraphIdentifierDefinition, ReferenceType } from '../../../../src/dataflow/environments/identifier';
import type { ContainerIndices } from '../../../../src/dataflow/graph/vertex';
import { deterministicCountingIdGenerator } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { mergeDefinitionsForPointer } from '../../../../src/dataflow/environments/define';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';

describe('Pointer Analysis', () => {
	describe('Merge Definitions', () => {
		const nextId = deterministicCountingIdGenerator(0);
		function inGraphDef(name: string, nodeId: NodeId, ...indices: ContainerIndices[]): InGraphIdentifierDefinition {
			return {
				type:              ReferenceType.Unknown,
				nodeId,
				name,
				indicesCollection: indices,
				value:             undefined,
				definedAt:         0,
				cds:               []
			};
		}

		function idx(container: boolean, ...identifier: readonly string[]): ContainerIndices {
			return {
				isContainer: container,
				indices:     identifier.map(i => ({ identifier: { lexeme: i, index: undefined }, nodeId: nextId() }))
			};
		}

		function container(): ContainerIndices {
			return idx(true);
		}

		function testMerge(name: string, existing: InGraphIdentifierDefinition[], definition: InGraphIdentifierDefinition, expected: InGraphIdentifierDefinition[]) {
			return test(name, () => {
				const result = mergeDefinitionsForPointer(existing, definition);
				assert.sameDeepMembers(result, expected);
			});
		}
		// let's introduce the cast!
		const defaultContainer = container();
		const indexA = idx(false, 'a');
		const indexB = idx(false, 'b');
		const indexC = idx(false, 'c');
		const indexWithA = idx(true, 'a');

		const containerA = inGraphDef('a', 0, defaultContainer);
		const containerWithA = inGraphDef('a', 0, indexWithA);
		const containerB = inGraphDef('b', 1, defaultContainer);
		const indexAOverwrite = inGraphDef('a', 0, indexA);
		const indexBOverwriteFromA = inGraphDef('a', 0, indexB);
		const indexABOverwrite = inGraphDef('a', 0, indexA, indexB);
		const indexCOverwrite = inGraphDef('a', 2, indexC);

		testMerge('no existing, container', [],
			containerA, [containerA]
		);
		testMerge('different existing, container overwrite', [inGraphDef('b', 1)],
			containerA, [containerA]
		);
		testMerge('different existing with container', [containerB],
			containerA, [containerA]
		);
		testMerge('only overwrite single index', [containerB],
			indexAOverwrite, [containerB, indexAOverwrite]
		);
		testMerge('overwrite container', [containerB, indexAOverwrite],
			containerA, [containerA]
		);
		testMerge('overwrite a and b', [containerB],
			indexABOverwrite, [containerB, indexABOverwrite]
		);
		testMerge('overwrite a and b, has c', [containerB, indexCOverwrite],
			indexABOverwrite, [containerB, indexCOverwrite, indexABOverwrite]
		);
		testMerge('overwrite c has a and b', [containerB, indexABOverwrite],
			indexCOverwrite, [containerB, indexCOverwrite, indexABOverwrite]
		);
		testMerge('overwrite a and b, has a', [containerB, indexAOverwrite],
			indexABOverwrite, [containerB, indexAOverwrite, indexABOverwrite]
		);
		testMerge('overwrite a has a and b', [containerB, indexABOverwrite],
			indexAOverwrite, [containerB, indexAOverwrite, indexBOverwriteFromA]
		);
		testMerge('add c to a', [containerWithA],
			indexCOverwrite, [containerWithA, indexCOverwrite]
		);
	});
});