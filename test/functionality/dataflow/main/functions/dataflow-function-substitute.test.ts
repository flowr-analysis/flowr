import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { label } from '../../../_helper/label';
import { describe } from 'vitest';

describe('Substitute Environment', withTreeSitter(ts => {
	assertDataflow(label('substitute with env', ['reflection-"computing-on-the-language"', 'built-in-quoting']), ts, 'substitute(y <- x,\nlist(x = 1))',
		emptyGraph()
			.reads('1@x', 8)
		,
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
	assertDataflow(label('substitute with env and two fields', ['reflection-"computing-on-the-language"', 'built-in-quoting']), ts, 'x <- 42\nsubstitute(y <- x + z,\nlist(x = 1, z = 42 + x))',
		emptyGraph()
			.reads('2@x', 13)
			.reads(16, '1@x')
			.reads('2@z', 18)
		,
		{ resolveIdsAsCriterion: true, expectIsSubgraph: true, mustNotHaveEdges: [[5, 0]] }
	);
}));
