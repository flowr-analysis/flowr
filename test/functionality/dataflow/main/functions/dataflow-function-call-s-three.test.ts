import { describe } from 'vitest';
import { assertDataflow, withTreeSitter, assertCallTargets } from '../../../_helper/shell';
import { label, decorateLabelContext } from '../../../_helper/label';
import { emptyGraph } from '../../../../../src/dataflow/graph/dataflowgraph-builder';
import { pushLocalEnvironment } from '../../../../../src/dataflow/environments/scoping';
import { defaultEnv } from '../../../_helper/dataflow/environment-builder';
import type { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';

describe('S3 Function Calls', withTreeSitter(ts => {
	assertDataflow(label('Simple S3 dispatch', ['function-calls', 'oop-s3', 'oop-s3-dispatch']), ts,
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
	assertDataflow(label('Simple S3 dispatch with NextMethod', ['function-calls', 'oop-s3', 'oop-s3-dispatch', 'oop-s3-inheritance']), ts,
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
	assertDataflow(label('S3 dispatch reads the object it dispatches on', ['function-calls', 'oop-s3', 'oop-s3-dispatch']), ts,
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
	assertDataflow(label('A named object moves the read off the first formal', ['function-calls', 'oop-s3', 'oop-s3-dispatch']), ts,
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
	assertDataflow(label('Two-Targets S3 dispatch', ['function-calls', 'oop-s3', 'oop-s3-dispatch']), ts,
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
	assertDataflow(label('Dispatch through a base generic', ['function-calls', 'oop-s3', 'oop-s3-construction', 'oop-s3-dispatch']), ts,
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
	assertDataflow(label('A base generic picks up no unrelated method', ['function-calls', 'oop-s3', 'oop-s3-dispatch']), ts,
		`
foo.bar <- function(x) {
    99
}
o <- structure(1, class="zz")
v <- length(o)
`, emptyGraph(),
		{ expectIsSubgraph: true, resolveIdsAsCriterion: true, mustNotHaveEdges: [['6@length', '2@function'], ['6@length', '2@foo.bar']] }
	);
	assertDataflow(label('Respect Later-Defs', ['function-calls', 'oop-s3', 'oop-s3-dispatch']), ts,
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

	describe('domains:dispatch', () => {
		const sec = (s: string) => decorateLabelContext(label(s, ['name-normal', 'function-calls']), ['dataflow']);
		const calls = (name: string, code: string, criterion: SlicingCriterion, expected: { reaches?: readonly SlicingCriterion[], misses?: readonly SlicingCriterion[] }) => assertCallTargets(sec(name), ts, code, criterion, expected);
		const temp = 'print.temp <- function(x, ...) cat(x, "degrees\\n")\nx <- structure(21, class = "temp")\nprint(x)';
		calls('domains:dispatch print reaches the method of the class', temp, '3@print', { reaches: ['1@function'] });
		const vec = 'print.temp <- function(x, ...) cat(x, "degrees\\n")\nx <- structure(21, class = c("celsius", "temp"))\nprint(x)';
		calls('domains:dispatch a later class of the vector is reached', vec, '3@print', { reaches: ['1@function'] });
		const both = 'print.temp <- function(x, ...) cat("t\\n")\nprint.celsius <- function(x, ...) cat("c\\n")\nx <- structure(21, class = c("celsius", "temp"))\nprint(x)';
		calls('domains:dispatch the first class wins', both, '4@print', { reaches: ['2@function'], misses: ['1@function'] });
		const other = 'print.temp <- function(x, ...) cat("t\\n")\nx <- structure(21, class = "other")\nprint(x)';
		calls('domains:dispatch an unrelated class does not reach the method', other, '3@print', { misses: ['1@function'] });
		const next = 'print.temp <- function(x, ...) cat("t\\n")\nprint.celsius <- function(x, ...) NextMethod()\nx <- structure(21, class = c("celsius", "temp"))\nprint(x)';
		calls('domains:dispatch NextMethod reaches the later class', next, '4@print', { reaches: ['1@function', '2@function'] });
		const replaced = 'print.temp <- function(x, ...) cat("t\\n")\nx <- "a"\nclass(x) <- "temp"\nprint(x)';
		calls('domains:dispatch a class set by replacement reaches the method', replaced, '4@print', { reaches: ['1@function'] });
		const two = 'print.temp <- function(x, ...) cat("t\\n")\nprint.other <- function(x, ...) cat("o\\n")\n';
		calls('domains:dispatch a named extra argument keeps the dispatch', two + 'x <- structure(21, class = "temp")\nprint(x, digits = 2)', '4@print', { reaches: ['1@function'], misses: ['2@function'] });
		calls('domains:dispatch on the argument bound to the first formal', two + 'x <- structure(21, class = "temp")\nprint(digits = 2, x)', '4@print', { reaches: ['1@function'], misses: ['2@function'] });
		calls('domains:dispatch on a class known inside a function', two + 'f <- function() {\n  x <- structure(21, class = "temp")\n  print(x)\n}\nf()', '5@print', { reaches: ['1@function'], misses: ['2@function'] });
		calls('domains:dispatch a free variable sees its later value', two + 'x <- structure(1, class = "temp")\nf <- function() print(x)\nx <- structure(1, class = "other")\nf()', '4@print', { reaches: ['2@function'] });
		calls('domains:dispatch a primitive dispatches on its first argument given', 'rep.a <- function(x, ...) "a"\nrep.b <- function(x, ...) "b"\nx <- structure(1, class = "a")\ny <- structure(1, class = "b")\nrep(times = y, x)', '5@rep', { reaches: ['2@function'] });
		calls('domains:dispatch a binary operator dispatches on either operand', '`+.b` <- function(e1, e2) "b"\n`+.a` <- function(e1, e2) "a"\nx <- 1\ny <- structure(1, class = "b")\nx + y', '5@+', { reaches: ['1@function'] });
	});
}));