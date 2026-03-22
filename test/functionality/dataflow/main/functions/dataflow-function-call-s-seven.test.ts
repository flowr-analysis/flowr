import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { EdgeType } from '../../../../../src/dataflow/graph/edge';

describe('S7 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('Simple S7 Generic Registration', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="y", function(y, ..., na.rm = FALSE) {
	S7_dispatch()
})
sample(42)
`, emptyGraph()
			.addEdge('1@new_generic', '1@function', EdgeType.Returns | EdgeType.Argument)
			.calls('4@sample', '1@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Registration with setGeneric', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- setGeneric("sample", function(y, ..., na.rm = FALSE) {
	S7_dispatch()
})
sample(42)
`, emptyGraph()
			.addEdge('1@setGeneric', '1@function', EdgeType.Returns | EdgeType.Argument)
			.calls('4@sample', '1@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Simple S7 Generic Registration with default fn', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="y")
sample(42)
`, emptyGraph()
			.calls('2@sample', '7-s7-new-generic-fun-fdef')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Simple S7 Generic Method  and Call', ['function-definitions', 'oop-r7-s7']), ts,
		`sample <- new_generic("sample", dispatch_args="x", function(x) { S7_dispatch() })
		method(sample, class_numeric) <- function(x, ..., na.rm = FALSE) {
		   sum(x) / length(x)
		}
		sample(42)`, emptyGraph()
			.calls('5@sample', '1@function')
			.calls('1@S7_dispatch', '2@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
}));