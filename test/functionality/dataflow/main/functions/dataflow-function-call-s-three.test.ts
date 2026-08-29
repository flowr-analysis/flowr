import { describe } from 'vitest';
import { assertDataflow, withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { pushLocalEnvironment } from '../../../../../src/dataflow/environments/scoping';
import { defaultEnv } from '../../../_helper/dataflow/environment-builder';

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
			.defineFunction('2@function', [8], {
				in:                [],
				entryPoint:        '2@{',
				graph:             new Set([]),
				environment:       pushLocalEnvironment(defaultEnv()),
				out:               [],
				hooks:             [],
				unknownReferences: []
			}, { mode: ['s3'] }),
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
			.calls('6@NextMethod', ['2@function', '5@function']),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	/* the class has to be known before a method can be picked, so the object is read whatever the method does */
	assertDataflow(label('S3 dispatch reads the object it dispatches on', ['function-calls', 'oop-s3']), ts,
		`
f.default <- function(x) {
    1
}
f <- function(x) {
    UseMethod("f")
}
`, emptyGraph()
			.argument('6@"f"', '5@x')
			.reads('6@"f"', '5@x'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	/* the first formal stays a plain argument here, as `y` is the one the dispatch has to look at */
	assertDataflow(label('A named object moves the read off the first formal', ['function-calls', 'oop-s3']), ts,
		`
f.default <- function(x, y) {
    1
}
f <- function(x, y) {
    UseMethod("f", y)
}
`, emptyGraph()
			.argument('6@"f"', '5@x')
			.reads('6@y', '5@y'),
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
			.calls('9@"f"', '5@function'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	/* a base generic dispatches too, even though its body is nowhere to be seen */
	assertDataflow(label('Dispatch through a base generic', ['function-calls', 'oop-s3']), ts,
		`
length.zz <- function(x) {
    99
}
o <- structure(1, class="zz")
v <- length(o)
`, emptyGraph()
			.calls('6@length', '2@function')
			.reads('6@length', '2@length.zz'),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true }
	);
	/* only the methods of the generic that is called: `foo.bar` is none of `length` */
	assertDataflow(label('A base generic picks up no unrelated method', ['function-calls', 'oop-s3']), ts,
		`
foo.bar <- function(x) {
    99
}
o <- structure(1, class="zz")
v <- length(o)
`, emptyGraph(),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['6@length', '2@function'], ['6@length', '2@foo.bar']] }
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