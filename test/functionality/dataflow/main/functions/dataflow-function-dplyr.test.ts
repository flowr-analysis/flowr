import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('Dplyr Call Formulas', withTreeSitter(ts => {
	assertDataflow(label('across with formula fn', ['reflection-"computing-on-the-language"']), ts, 'across(df, ~.x + 1)',
		emptyGraph()
			.reads('1@.x', '1@df'),
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('across with built-in fn', ['reflection-"computing-on-the-language"']), ts, 'across(df, mean)',
		emptyGraph()
			.addEdge('1@across', '1@mean', EdgeType.Argument | EdgeType.Calls),
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('across with user fn', ['reflection-"computing-on-the-language"']), ts, 'f <- function(x) x\nacross(df, f)',
		emptyGraph()
			.addEdge('2@across', '2@f', EdgeType.Argument | EdgeType.Calls)
			.definesOnCall('2@df', '1@x'),
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('across with fn list', ['reflection-"computing-on-the-language"']), ts, '\nacross(df, list("min"=min_x, "n"=length))',
		emptyGraph()
			.calls('2@across', '2@min_x')
			.calls('2@across', '2@length'),
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
}));
