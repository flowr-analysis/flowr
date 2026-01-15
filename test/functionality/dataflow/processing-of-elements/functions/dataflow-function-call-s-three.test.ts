import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { argumentInCall } from '../../../_helper/dataflow/environment-builder';
import { builtInId } from '../../../../../src/dataflow/environments/built-in';

describe('S3 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('Simple S3 dispatch', ['function-calls', 'oop-s3']), ts,
		`
f.default <- function(x) {
    length(x)
}
f <- function(x) {
    UseMethod("f")
}
`, emptyGraph()
			.call('3@length', 'length', [argumentInCall('3@x')], { returns: [], reads: ['3@x', builtInId('length')], onlyBuiltIn: false }, false)
			.calls('3@length', builtInId('length'))
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
}));