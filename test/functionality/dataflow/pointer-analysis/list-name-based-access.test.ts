import { afterAll, beforeAll, describe } from 'vitest';
import { assertDataflow, withShell } from '../../_helper/shell';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../_helper/label';
import { amendConfig, defaultConfigOptions } from '../../../../src/config';

describe.sequential('List Name Based Access', withShell(shell => {
	const basicCapabilities = ['name-normal', 'function-calls', 'named-arguments', 'dollar-access', 'subsetting-multiple'] as const;

	beforeAll(() => {
		amendConfig({ solver: { ...defaultConfigOptions.solver, pointerTracking: true } });
	});

	afterAll(() => {
		amendConfig({ solver: { ...defaultConfigOptions.solver, pointerTracking: false } });
	});

	describe('Access named argument', () => {
		assertDataflow(
			label('Assert reads edge to named argument', basicCapabilities),
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
