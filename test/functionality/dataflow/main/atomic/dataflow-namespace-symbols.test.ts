import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';

describe('Resolve for Namespaces', withTreeSitter(ts => {
	assertDataflow(label('Simple Assign Break', ['namespaces', 'lexicographic-scope']), ts,
		'x <- 42\nprint(base::x)',
		emptyGraph(),
			{
				expectIsSubgraph: true,
			} as const
	);
}));