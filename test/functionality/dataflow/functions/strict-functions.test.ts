import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { FunctionStrictnesses } from '../../../../src/dataflow/fn/strict-function';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { Ternary } from '../../../../src/util/logic';

describe('is-strict-function', withTreeSitter(ts => {
	/**
	 * Checks the verdict for the definition the criterion points at, and the verdict for each of the
	 * parameters named in `params`.
	 */
	function testStrict(name: string, code: string, criterion: SlicingCriterion, expected: Ternary, params: Record<string, Ternary> = {}) {
		test(`${name} (${criterion} is ${expected} strict)`, async() => {
			const analyzer = new FlowrAnalyzerBuilder().setParser(ts).buildSync();
			analyzer.addRequest(requestFromInput(code));
			const idMap = (await analyzer.normalize()).idMap;
			const id = SlicingCriterion.tryParse(criterion, idMap);
			assert.isDefined(id, `could not resolve criterion ${criterion}`);
			const graph = (await analyzer.dataflow()).graph;
			const strictness = FunctionStrictnesses.of([id], graph)[id];
			try {
				assert.strictEqual(strictness.strict, expected);
				for(const [param, want] of Object.entries(params)) {
					const found = Object.entries(strictness.parameters)
						.find(([p]) => idMap.get(Number(p))?.lexeme === param);
					assert.isDefined(found, `no parameter ${param}`);
					assert.strictEqual(found[1], want, `parameter ${param}`);
				}
			} catch(e) {
				console.error(`Error while testing ${criterion} in code:\n${code}`);
				console.log('DFG', Dataflow.visualize.mermaid.url(graph));
				throw e;
			}
		});
	}

	testStrict('a plain read forces', 'f <- function(x) x + 1', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('no read forces nothing', 'f <- function(x) 1', '1@function', Ternary.Never, { x: Ternary.Never });
	testStrict('nothing to force', 'f <- function() 1', '1@function', Ternary.Always);
	testStrict('a read under a condition may force', 'f <- function(x) if(runif(1) > .5) x', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('a condition itself forces', 'f <- function(x) if(x) 1 else 2', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('a read in a loop may force', 'f <- function(x) for(i in 1:3) print(x)', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('a read in a nested function may force', 'f <- function(x) function() x', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('quoting does not force', 'f <- function(x) quote(x)', '1@function', Ternary.Never, { x: Ternary.Never });
	testStrict('one lazy parameter is enough', 'f <- function(x, y) x', '1@function', Ternary.Never, { x: Ternary.Always, y: Ternary.Never });
	testStrict('an unresolved call may force', 'f <- function(x) unknownFn(x)', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('a callee that reads forces', 'g <- function(y) y\nf <- function(x) g(x)', '2@function', Ternary.Always, { x: Ternary.Always });
	testStrict('a callee that ignores does not', 'g <- function(y) 1\nf <- function(x) g(x)', '2@function', Ternary.Never, { x: Ternary.Never });
	testStrict('the whole argument travels', 'g <- function(y) 1\nf <- function(x) g(x + 1)', '2@function', Ternary.Never, { x: Ternary.Never });
	testStrict('a recursive read still forces', 'f <- function(n) if(n > 0) f(n - 1) else 0', '1@function', Ternary.Always, { n: Ternary.Always });
	testStrict('a definition under a condition is judged by its own body', 'if(runif(1) > .5) f <- function(x) x', '1@function', Ternary.Always, { x: Ternary.Always });

	/* what a call takes as written or puts off */
	testStrict('missing does not force', 'f <- function(x) missing(x)', '1@function', Ternary.Never, { x: Ternary.Never });
	testStrict('but a read next to it does', 'f <- function(x) { if(missing(x)) 1 else 2; x }', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('substitute does not force', 'f <- function(x) substitute(x)', '1@function', Ternary.Never, { x: Ternary.Never });
	testStrict('force does', 'f <- function(x) force(x)', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('on.exit may never run', 'f <- function(x) on.exit(print(x))', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('switch reads what it switches on', 'f <- function(x, y) switch(x, a = y, b = 1)', '1@function', Ternary.Maybe, { x: Ternary.Always, y: Ternary.Maybe });
	testStrict('the second operand may be skipped', 'f <- function(x, y) x && y', '1@function', Ternary.Maybe, { x: Ternary.Always, y: Ternary.Maybe });
	testStrict('a default is only reached when the argument is left out', 'f <- function(x, y = x) y', '1@function', Ternary.Maybe, { x: Ternary.Maybe, y: Ternary.Always });
	testStrict('unless the body reads it too', 'f <- function(x, y = x) { x; y }', '1@function', Ternary.Always, { x: Ternary.Always, y: Ternary.Always });
	testStrict('calling a parameter forces it', 'f <- function(g) g(1)', '1@function', Ternary.Always, { g: Ternary.Always });
	testStrict('an argument reaches whatever `...` reaches', 'f <- function(...) sum(...)', '1@function', Ternary.Always);
	testStrict('a chain carries the verdict of its end', 'h <- function(c) 1\ng <- function(b) h(b)\nf <- function(a) g(a)', '3@function', Ternary.Never, { a: Ternary.Never });
	testStrict('mutual recursion is left open', 'g <- function(b) f(b)\nf <- function(a) g(a)', '2@function', Ternary.Maybe, { a: Ternary.Maybe });

	/* dispatch: the method chosen at run time decides */
	const s3 = 'f <- function(x, y) UseMethod("f")\nf.default <- function(x, y) x\nf.numeric <- function(x, y) y';
	testStrict('the generic is judged by its methods', s3, '1@function', Ternary.Maybe, { x: Ternary.Always, y: Ternary.Maybe });
	testStrict('a method is judged by its own body', s3, '2@function', Ternary.Never, { x: Ternary.Always, y: Ternary.Never });
	testStrict('methods agreeing settle the question', 'f <- function(x) UseMethod("f")\nf.default <- function(x) x\nf.numeric <- function(x) x + 1', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('the dispatch object is forced even when no method reads it', 'f <- function(x, y) UseMethod("f")\nf.default <- function(x, y) 1', '1@function', Ternary.Maybe, { x: Ternary.Always, y: Ternary.Maybe });
	testStrict('a named object moves what the dispatch forces', 'f <- function(x, y) UseMethod("f", y)\nf.default <- function(x, y) 1', '1@function', Ternary.Maybe, { x: Ternary.Maybe, y: Ternary.Always });
	testStrict('S4 dispatches on its object as well', 'setGeneric("g", function(x) standardGeneric("g"))\nsetMethod("g", "numeric", function(x) x)', '1@function', Ternary.Always, { x: Ternary.Always });

	/* what `NextMethod` reaches decides for the method holding it */
	const next = 'f <- function(x, y) UseMethod("f")\nf.a <- function(x, y) NextMethod()\nf.default <- function(x, y) ';
	testStrict('the next method forces what this one does not', next + 'y', '2@function', Ternary.Always, { x: Ternary.Always, y: Ternary.Always });
	testStrict('and leaves it open when it forces nothing', next + '1', '2@function', Ternary.Maybe, { x: Ternary.Always, y: Ternary.Maybe });
	testStrict('next methods disagreeing leave it open', 'f <- function(x, y) UseMethod("f")\nf.a <- function(x, y) NextMethod()\nf.b <- function(x, y) y\nf.default <- function(x, y) 1', '2@function', Ternary.Maybe, { y: Ternary.Maybe });

	/* arguments travelling on */
	testStrict('`...` carries the verdict of what it reaches', 'g <- function(a) a\nf <- function(...) g(...)', '2@function', Ternary.Always);
	testStrict('and stays lazy when that leaves it alone', 'g <- function(a) 1\nf <- function(...) g(...)', '2@function', Ternary.Never);
	testStrict('building the argument list of do.call forces it', 'g <- function(a) 1\nf <- function(x) do.call("g", list(x))', '2@function', Ternary.Always, { x: Ternary.Always });
	testStrict('a method of an object flowR cannot resolve is open', 'f <- function(y) obj$m(y)', '1@function', Ternary.Maybe, { y: Ternary.Maybe });
	testStrict('so is one reached through a list', 'l <- list(m = function(x) x)\nf <- function(y) l$m(y)', '2@function', Ternary.Maybe, { y: Ternary.Maybe });

	/* what the analysis must not claim */
	testStrict('a dispatch in a branch decides nothing on its own', 'f <- function(x) if(runif(1) > .5) UseMethod("f")\nf.default <- function(x) x', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('nor does one in a loop', 'f <- function(x) for(i in 1:2) UseMethod("f")\nf.default <- function(x) x', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	testStrict('a name of its own beats the built-in the code shadows', 'f <- function(x) { missing <- function(a) a; missing(x) }', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('and reports what that name does instead', 'f <- function(x) { missing <- function(a) 1; missing(x) }', '1@function', Ternary.Never, { x: Ternary.Never });
	testStrict('a factory is not a call of what it is handed', 'f <- function(x) Negate(function(i) x)', '1@function', Ternary.Maybe, { x: Ternary.Maybe });
	/* `match.arg` states its `arg` as a value it computes from, which is what the verdict follows */
	testStrict('a stated value is evaluated', 'f <- function(x = c("a", "b")) match.arg(x)', '1@function', Ternary.Always, { x: Ternary.Always });
	testStrict('what cannot be reached forces nothing', 'f <- function(x) { stop("boom"); x }', '1@function', Ternary.Never, { x: Ternary.Never });
	testStrict('nor does a branch that is never taken', 'f <- function(x) if(FALSE) x', '1@function', Ternary.Never, { x: Ternary.Never });

	/* which argument reaches which parameter */
	testStrict('arguments are matched by position', 'g <- function(p, q) p\nf <- function(a, b) g(b, a)', '2@function', Ternary.Never, { a: Ternary.Never, b: Ternary.Always });
	testStrict('and by name where one is written', 'g <- function(p, q) p\nf <- function(a, b) g(q = a, p = b)', '2@function', Ternary.Never, { a: Ternary.Never, b: Ternary.Always });
	testStrict('a name may be given in part', 'g <- function(value, other) value\nf <- function(a, b) g(val = a, oth = b)', '2@function', Ternary.Never, { a: Ternary.Always, b: Ternary.Never });
}));
