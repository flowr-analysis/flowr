import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';

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
			.calls('6@"f"', '2@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Simple S3 dispatch with NextMethod', ['function-calls', 'oop-s3']), ts,
		`
f.default <- function(x) {
    length(x)
}
f.foo <- function(x) {
	NextMethod()
}
f <- function(x) {
    UseMethod("f")
}
`, emptyGraph()
			.calls('9@"f"', ['2@function', '5@function'])
			.calls('6@NextMethod', ['2@function', '5@function'])
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Two-Targets S3 dispatch', ['function-calls', 'oop-s3']), ts,
		`
f.default <- function(x) {
    length(x)
}
f.numeric <- function(x) {
	sum(x)
}
f <- function(x) {
    UseMethod("f")
}
`, emptyGraph()
			.calls('9@"f"', '2@function')
			.calls('9@"f"', '5@function')
		,
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	assertDataflow(label('Respect Later-Defs', ['function-calls', 'oop-s3']), ts,
		`
f.default <- function(x) {
    length(x)
}
f <- function(x) {
    UseMethod("f")
}
f.numeric <- function(x) {
	sum(x)
}
`, emptyGraph()
			.calls('6@"f"', '2@function')
			.calls('6@"f"', '8@function')
			.definedByOnCall('2@x', '5@x')
			.definedByOnCall('8@x', '5@x'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['6@"f"', '5@function']] }
	);
}));