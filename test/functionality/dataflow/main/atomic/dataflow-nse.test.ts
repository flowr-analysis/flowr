import { assert, beforeAll, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';
import { type TREE_SITTER_DATAFLOW_PIPELINE, createDataflowPipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import type { PipelineOutput } from '../../../../../src/core/steps/pipeline/pipeline';
import { guard } from '../../../../../src/util/assert';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { Dataflow } from '../../../../../src/dataflow/graph/df-helper';
import { OriginType } from '../../../../../src/dataflow/origin/dfg-get-origin';
import type { SupportedFlowrCapabilityId } from '../../../../../src/r-bridge/data/get';

/** Whether a criterion still reads a definition: a quoted name does not, one that only looks quoted does. */
describe('Dataflow', withTreeSitter(ts => {
	describe('non-standard evaluation', () => {
		function assertReads(
			name: string, capabilities: readonly SupportedFlowrCapabilityId[], code: string,
			expected: Record<SlicingCriterion, SlicingCriterion | readonly SlicingCriterion[] | undefined>
		): void {
			describe(label(name, capabilities, ['dataflow']), () => {
				let analysis: PipelineOutput<typeof TREE_SITTER_DATAFLOW_PIPELINE> | undefined;
				beforeAll(async() => {
					analysis = await createDataflowPipeline(ts, { context: contextFromInput(code) }).allRemainingSteps();
				});
				test.each(Object.keys(expected) as SlicingCriterion[])('%s', (use: SlicingCriterion) => {
					guard(analysis !== undefined);
					const idMap = analysis.normalize.idMap;
					const origins = Dataflow.origin(analysis.dataflow.graph, SlicingCriterion.parse(use, idMap))
						?.filter(o => o.type === OriginType.ReadVariableOrigin);
					const want = expected[use];
					if(want === undefined) {
						assert.isEmpty(origins ?? [], `${use} must not read anything, it is not evaluated`);
					} else {
						const wanted = (typeof want === 'string' ? [want] : want).map(w => SlicingCriterion.parse(w, idMap));
						assert.deepStrictEqual(origins?.map(o => o.id).sort(), wanted.sort());
					}
				});
			});
		}

		assertReads('data masking through a pipe marks the same names as the direct call',
			['function-calls', 'pipe-and-pipe-bind', 'data-masking'],
			'library(dplyr)\nk <- 1\nd |> filter(x > k)\nfilter(d, x > k)', {
				'3@k': '2@k',
				'4@k': '2@k',
				'3@x': undefined,
				'4@x': undefined
			});

		assertReads('a masked argument that is just a bound name is still a read',
			['function-calls', 'data-masking'],
			'library(dplyr)\nk <- 1\nfilter(d, k)\nfilter(d, aaa)', {
				'3@k':   '2@k',
				'4@aaa': undefined
			});

		assertReads('the verbs without a data argument mask all of them',
			['function-calls', 'data-masking'],
			'library(dplyr)\nlibrary(ggplot2)\ninner_join(a, b, join_by(aaa == bbb))\ntibble(aaa = 1, bbb = aaa * 2)\nggplot(d, aes(x = wt))\nrowwise(d, aaa)', {
				'3@aaa': undefined,
				'4@bbb': undefined,
				'5@wt':  undefined,
				'6@aaa': undefined
			});

		assertReads('the tidyverse functions that take values evaluate them',
			['function-calls', 'data-masking'],
			'library(tidyr)\nlibrary(ggplot2)\nxv <- "wt"\nggplot(d, aes_string(x = xv))\nv <- 1:3\ncrossing(a = v)', {
				'4@xv': '3@xv',
				'6@v':  '5@v'
			});

		assertReads('quote leaves nothing within it evaluated',
			['function-calls', 'built-in-quoting'],
			'x <- 1\ny <- 2\nquote(x + y)', {
				'3@x': undefined,
				'3@y': undefined
			});

		assertReads('a loop body is reevaluated, not quoted',
			['function-calls', 'while-loop', 'repeat-loop', 'built-in-quoting'],
			'x <- 1\nwhile(TRUE) print(x)\nrepeat print(x)', {
				'2@x': '1@x',
				'3@x': '1@x'
			});

		/* `!!x` parses as `!(!x)` */
		assertReads('rlang unquotes with `!!` and `!!!`',
			['function-calls', 'built-in-quoting', 'unary-operator'],
			'x <- 1\nxs <- list(2)\nrlang::expr(!!x)\nrlang::expr(f(!!!xs))\nrlang::quo(g(!!x))', {
				'3@x':  '1@x',
				'4@xs': '2@xs',
				'5@x':  '1@x'
			});

		assertReads('base quoting does not unquote',
			['function-calls', 'built-in-quoting', 'unary-operator'],
			'x <- 1\nquote(!!x)\nsubstitute(!!x)', {
				'2@x': undefined,
				'3@x': undefined
			});

		assertReads('bquote evaluates the operand of `.()` only',
			['function-calls', 'built-in-quoting'],
			'y <- 1\nz <- 2\nbquote(z + .(y))', {
				'3@y': '1@y',
				'3@z': undefined
			});

		assertReads('rlang symbol and label builders evaluate their argument',
			['function-calls', 'built-in-quoting'],
			'v <- "a"\nq <- rlang::quo(x)\nrlang::sym(v)\nrlang::as_name(q)\nrlang::quo_name(q)', {
				'3@v': '1@v',
				'4@q': '2@q',
				'5@q': '2@q'
			});

		assertReads('rlang `:=` names a column, it defines nothing',
			['function-calls', 'data-masking', 'special-operator'],
			'library(dplyr)\nd |> mutate(newcol := 1)\nprint(newcol)', {
				'3@newcol': undefined
			});

		assertReads('a quoted expression reads nothing until it is evaluated',
			['function-calls', 'built-in-quoting', 'built-in-evaluation'],
			'x <- 1\ne <- quote(x + 1)', {
				'2@x': undefined
			});

		assertReads('eval evaluates the expression a variable holds',
			['function-calls', 'built-in-quoting', 'built-in-evaluation'],
			'x <- 1\ne <- quote(x + 1)\neval(e)', {
				'2@x': '1@x'
			});

		assertReads('eval evaluates a quoting call given to it directly',
			['function-calls', 'built-in-quoting', 'built-in-evaluation'],
			'x <- 1\neval(rlang::expr(x + 1))\neval(substitute(x + 1))', {
				'2@x': '1@x',
				'3@x': '1@x'
			});

		assertReads('eval resolves the expression where it is evaluated',
			['function-calls', 'built-in-quoting', 'built-in-evaluation'],
			'x <- 1\ne <- quote(x)\nx <- 2\neval(e)', {
				'2@x': '3@x'
			});

		assertReads('a language object is followed across any number of assignments',
			['function-calls', 'built-in-quoting', 'built-in-evaluation'],
			'x <- 1\na <- quote(x)\nb <- a\nc <- b\neval(c)', {
				'2@x': '1@x'
			});

		assertReads('every expression a branch may have left is evaluated',
			['function-calls', 'built-in-quoting', 'built-in-evaluation', 'if'],
			'x <- 1\ny <- 2\ne <- if(z) quote(x) else quote(y)\neval(e)', {
				'3@x': '1@x',
				'3@y': '2@y'
			});

		assertReads('a language object is followed into and out of a function call',
			['function-calls', 'built-in-quoting', 'built-in-evaluation', 'lambda-syntax'],
			'x <- 1\ng <- function(q) eval(q)\nf <- function(q) g(q)\nf(quote(x))\nmk <- function() quote(x)\neval(mk())', {
				'4@x': '1@x',
				'5@x': '1@x'
			});

		assertReads('a language object is followed through a loop',
			['function-calls', 'built-in-quoting', 'built-in-evaluation', 'for-loop'],
			'e <- quote(x)\nfor(i in 1:3) {\n  x <- i\n  eval(e)\n}', {
				'1@x': '3@x'
			});

		assertReads('eval into another environment resolves nothing',
			['function-calls', 'built-in-quoting', 'built-in-evaluation'],
			'x <- 1\ne <- quote(x)\neval(e, envir = new.env())', {
				'2@x': undefined
			});

		test(label('an evaluated capture is no longer marked as unevaluated', ['built-in-quoting', 'built-in-evaluation'], ['dataflow']), async() => {
			const analysis = await createDataflowPipeline(ts, { context: contextFromInput('x <- 1\ne <- quote(x + 1)\neval(e)') }).allRemainingSteps();
			const graph = analysis.dataflow.graph;
			const use = SlicingCriterion.parse('2@x', analysis.normalize.idMap);
			assert.isFalse(Dataflow.isQuoted(use, graph), 'the expression is evaluated, so nothing about it is quoted');
		});

		assertReads('a delayed promise reaches the binding it is forced against',
			['function-calls', 'built-in-evaluation', 'formals-promises'],
			'k <- 1\ndelayedAssign("v", k + 1)\nk <- 5\nprint(v)', {
				'2@k': ['1@k', '3@k']
			});

		assertReads('a delayed promise forced in another scope reaches that binding',
			['function-calls', 'built-in-evaluation', 'formals-promises'],
			'k <- 1\ndelayedAssign("v", k + 1)\nf <- function() { k <- 9; v }\nf()', {
				'2@k': ['1@k', '3@k']
			});

		assertReads('the tidyr verbs that take data first mask the column',
			['function-calls', 'data-masking'],
			'library(tidyr)\nseparate_longer_delim(d, aaa, delim = ",")\nseparate_longer_position(d, aaa, width = 1)', {
				'2@aaa': undefined,
				'3@aaa': undefined
			});

		assertReads('a data.table subscript reads the caller`s variables',
			['function-calls', 'data-masking', 'single-bracket-access'],
			'library(data.table)\nk <- 1\ndt[a > k]', {
				'3@k': '2@k'
			});

		/* the forcing read yields the promise; a later one sees the write, which replaced the binding */
		assertReads('a forcing read yields the promise, a later one what it wrote',
			['function-calls', 'built-in-evaluation', 'formals-promises'],
			'x <- 7\ndelayedAssign("x", { x <- 99; 2 })\nprint(x + x)\nprint(x)', {
				'3@x': '2@"x"',
				'4@x': '2@x'
			});

		/* control flow says which read forces, so a binding no force can see is ruled out */
		assertReads('a promise sees only the bindings a force can reach',
			['function-calls', 'built-in-evaluation', 'formals-promises'],
			'k <- 1\ndelayedAssign("v", k + 1)\nprint(v)\nk <- 9', {
				'2@k': '1@k'
			});

		assertReads('a read before the force does not see the promise`s write',
			['function-calls', 'built-in-evaluation', 'formals-promises'],
			'x <- 7\nprint(x)\ndelayedAssign("x", { x <- 99; 2 })\nprint(x)', {
				'2@x': '1@x'
			});

		/* the closure carries the promise past the call, so it reads whatever is bound when it runs */
		assertReads('a promise a closure carries reaches every binding it may see',
			['function-calls', 'formals-promises', 'closures'],
			'mk <- function(v) function() v\nk <- 5\nfn <- mk(k)\nk <- 6\nfn()', {
				'3@k': ['2@k', '4@k']
			});

		assertReads('forcing in the body settles the promise where it is made',
			['function-calls', 'formals-promises', 'closures'],
			'mk <- function(v) { force(v); function() v }\nk <- 5\nfn <- mk(k)\nk <- 6\nfn()', {
				'3@k': '2@k'
			});

		assertReads('data.table `:=` still assigns to the table',
			['function-calls', 'special-operator'],
			'library(data.table)\ndt <- data.table(a = 1)\ndt[, b := a + 1]\nprint(dt)', {
				/* `:=` modifies the table in place, so both the creation and the update are live */
				'4@dt': ['2@dt', '3@dt']
			});
	});
}));
