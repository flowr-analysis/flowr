import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('Purrr Formulas', withTreeSitter(ts => {
	assertDataflow(label('simple map', ['reflection-"computing-on-the-language"']), ts, 'map(df, ~ .x + 1)',
		emptyGraph()
			.reads('1@.x', '1@df')
		,
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('map2', ['reflection-"computing-on-the-language"']), ts, 'map2(df, df2, ~ .x + .y)',
		emptyGraph()
			.reads('1@.x', '1@df')
			.reads('1@.y', '1@df2')
		,
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('map with additional args', ['reflection-"computing-on-the-language"']), ts, 'map(df, function(.x, y)\n.x + y, 2)',
		emptyGraph()
			.definedByOnCall('1@.x', '1@df')
			.reads('2@.x', '1@.x')
			.definedByOnCall('1@y', '2@2')
			.calls('1@map', '1@function')
			.argument('1@map', '1@function')
		,
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('walk has an invisible return', ['reflection-"computing-on-the-language"']), ts, 'walk(df, function(.x, y)\n.x + y, 2)',
		emptyGraph()
			.addEdge('1@walk', '1@df', EdgeType.Returns | EdgeType.Argument),
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
}));
