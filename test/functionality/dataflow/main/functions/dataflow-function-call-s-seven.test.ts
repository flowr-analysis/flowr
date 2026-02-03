import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('S7 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('Simple S7 Generic Registration', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="y", function(y, ..., na.rm = FALSE) {
	S7_dispatch()
})`, emptyGraph()
			.addEdge('1@new_generic', '1@function', EdgeType.Returns | EdgeType.Argument)
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Simple S7 Generic Method  and Call', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="x")
		method(sample, class_numeric) <- function(x, ..., na.rm = FALSE) {
		   sum(x) / length(x)
		}
		sample(42)`, emptyGraph()
			.addEdge('1@new_generic', '1@function', EdgeType.Returns | EdgeType.Argument)
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
}));