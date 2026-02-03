import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';

describe('S7 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('Simple S7 Generic Registration', ['function-definitions', 'oop-r7-s7']), ts,
		`
sample <- new_generic("sample", "x")
sample2 <- new_generic("sample2", dispatch_args="y", function(y, ..., na.rm = FALSE) {
	S7_dispatch()
})  
`, emptyGraph()
			.calls('6@"f"', '2@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
}));