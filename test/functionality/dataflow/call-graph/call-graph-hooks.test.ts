import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { emptyGraph } from '../../../../src/dataflow/graph/dataflowgraph-builder';
import { builtInId } from '../../../../src/dataflow/environments/built-in';

describe('Call Graph Generation (With Hooks)', withTreeSitter(ts => {
	assertDataflow(label('Sample Hook', ['hooks', 'function-calls', 'function-definitions', 'resolution', 'resolve-arguments']),
		ts,
		'function(x) { on.exit(print("hi")); return(x) }',
		emptyGraph()
			.calls('1@function', '1@on.exit')
			.calls('1@on.exit', builtInId('function'))
			.calls('1@function', '8-hook-fn')
			.calls('8-hook-fn', '1@print')
		, { context: 'call-graph', resolveIdsAsCriterion: true, expectIsSubgraph: true }
	);
}));