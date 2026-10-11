import { assert, describe, test } from 'vitest';
import { withShell } from '../_helper/shell';
import { decorateLabelContext, label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { canReach } from '../../../src/control-flow/simple-visitor';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { KnownParser } from '../../../src/r-bridge/parser';

/*
 * Promises in combination with higher-order functions, recursion and loops: what runs within an argument (or
 * a default) runs only once, and if, the receiver forces it. Every expected value is the one R prints.
 */
const name = (s: string) => decorateLabelContext(label(s, ['function-calls', 'formals-promises']), ['dataflow']);

describe('Snippets: promises', { concurrent: false }, withShell(shell => {
	async function analyze(parser: KnownParser, code: string) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		return { analyzer, idMap: (await analyzer.normalize()).idMap };
	}

	/** whether control reaches `target` from the start, which has to hold whenever R gets there */
	function assertReaches(title: string, code: string, target: SlicingCriterion, expected: boolean, fails = false) {
		(fails ? test.fails : test).each([shell, new TreeSitterExecutor()])(name(`${title} (%s)`), async parser => {
			const { analyzer, idMap } = await analyze(parser, code);
			const cfg = await analyzer.controlflow(undefined, true);
			assert.strictEqual(canReach(cfg.graph, cfg.entryPoints, SlicingCriterion.parse(target, idMap)), expected);
		});
	}

	/** the slice for `criterion`, run in R, prints what the whole program prints last */
	function assertSliceRuns(title: string, code: string, criterion: SlicingCriterion, lastLine: string) {
		test(name(title), async() => {
			const { analyzer } = await analyze(shell, code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion] }]);
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			shell.clearEnvironment();
			const whole = await shell.sendCommandWithOutput(code);
			shell.clearEnvironment();
			const part = await shell.sendCommandWithOutput(slice);
			shell.clearEnvironment();
			assert.strictEqual(whole.at(-1), lastLine, 'the program itself');
			assert.strictEqual(part.at(-1), lastLine, `the slice:\n${slice}`);
		});
	}

	describe('higher-order functions', () => {
		const applyF = 'apply_f <- function(f, x) f(x)\n';
		assertReaches('a promise handed through to a function that never forces it', applyF + 'g <- function(a) 1\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nh()', '5@"alive"', true);
		assertSliceRuns('the lazy callee decides the result', applyF + 'g <- function(a) 1\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nprint(h())', '7@print', '[1] "alive"');
		assertReaches('a promise handed through to a function that forces it', applyF + 'g <- function(a) a\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nh()', '5@"alive"', false);
		assertSliceRuns('the forcing callee decides the result', applyF + 'g <- function(a) a\nh <- function() {\n  apply_f(g, return(5))\n  "alive"\n}\nprint(h())', '7@print', '[1] 5');
		assertSliceRuns('a closure handed to sapply returns from the closure only', 'h <- function() {\n  r <- sapply(1:3, function(i) if(i == 2) return("x") else i)\n  "end"\n}\nprint(h())', '5@print', '[1] "end"');
		assertReaches('a closure handed to sapply returns from the closure only', 'h <- function() {\n  r <- sapply(1:3, function(i) if(i == 2) return("x") else i)\n  "end"\n}\nh()', '3@"end"', true);
		assertSliceRuns('a closure handed to a function that calls it writes globally', 'x <- 1\ns <- function() x <<- 2\ng <- function(f) f()\ng(s)\ny <- 0\nprint(x)', '6@print', '[1] 2');
		assertSliceRuns('an anonymous closure handed to a function that calls it writes globally', 'x <- 1\ng <- function(f) f()\ng(function() x <<- 2)\nprint(x)', '4@print', '[1] 2');
		assertSliceRuns('a promise captured by a closure is forced when the closure runs', 'mk <- function(x) function() x\nh <- function() {\n  k <- mk(return(1))\n  k()\n  "end"\n}\nprint(h())', '7@print', '[1] 1');
	});

	describe('recursion (fixpoint)', () => {
		assertSliceRuns('a promise handed down until it is forced', 'f <- function(n, x) if(n > 0) f(n - 1, x) else x\nh <- function() {\n  f(3, return(1))\n  "alive"\n}\nprint(h())', '6@print', '[1] 1');
		assertSliceRuns('a promise handed down but never forced', 'rec <- function(n, a) if(n == 0) 0 else rec(n - 1, a)\nh <- function() {\n  rec(3, return(1))\n  "alive"\n}\nprint(h())', '6@print', '[1] "alive"');
		assertReaches('a promise handed down until it is forced', 'f <- function(n, x) if(n > 0) f(n - 1, x) else x\nh <- function() {\n  f(3, return(1))\n  "alive"\n}\nh()', '4@"alive"', false);
		assertReaches('a promise handed down but never forced', 'rec <- function(n, a) if(n == 0) 0 else rec(n - 1, a)\nh <- function() {\n  rec(3, return(1))\n  "alive"\n}\nh()', '4@"alive"', true);
	});

	describe('evaluation order', () => {
		assertSliceRuns('the callee forces its arguments in its own order', 'f <- function(a, b) { b; a }\nf(x <- 1, x <- 2)\nprint(x)', '3@print', '[1] 1');
		assertSliceRuns('a definition in a promise nobody forces does not happen', 'x <- 1\nf <- function(a) if(FALSE) a\nf(x <- 2)\nprint(x)', '4@print', '[1] 1');
		assertSliceRuns('a default sees the body it is forced in', 'f <- function(x = y) { y <- 2; x }\nprint(f())', '2@print', '[1] 2');
		assertSliceRuns('a jump within a default leaves the function using it', 'cond <- TRUE\nf <- function(x = return("early")) { if(cond) x; "late" }\nprint(f())', '3@print', '[1] "early"');
	});

	describe('nested calls', () => {
		const forwarding = 'outer <- function(y) inner(y)\ninner <- function(z) z\nh <- function() {\n  outer(return(1))\n  "alive"\n}\n';
		assertReaches('a promise forwarded to a function that forces it', forwarding + 'h()', '5@"alive"', false);
		assertSliceRuns('a promise forwarded to a function that forces it', forwarding + 'print(h())', '7@print', '[1] 1');
		const dropping = 'outer <- function(y) inner(y)\ninner <- function(z) 0\nh <- function() {\n  outer(return(1))\n  "alive"\n}\n';
		assertReaches('a promise forwarded to a function that drops it', dropping + 'h()', '5@"alive"', true);
		assertSliceRuns('a promise forwarded to a function that drops it', dropping + 'print(h())', '7@print', '[1] "alive"');
		const composed = 'compose <- function(f, g) function(x) f(g(x))\nid <- function(v) v\nk <- compose(id, id)\nh <- function() {\n  k(return(2))\n  "alive"\n}\n';
		assertSliceRuns('a promise handed to a composed closure', composed + 'print(h())', '8@print', '[1] 2');
		const conditional = 'w <- function(a, b) { if(a > 0) b else 0 }\nv <- function(n, q) w(n, q)\nh <- function() {\n  v(0, return("early"))\n  "late"\n}\n';
		assertReaches('a promise forwarded to a function forcing it only on one branch', conditional + 'h()', '5@"late"', true);
		assertSliceRuns('a promise forwarded to a function forcing it only on one branch', conditional + 'print(h())', '7@print', '[1] "late"');
		assertSliceRuns('a definition forwarded to a function that drops it', 'x <- 1\no <- function(a) i(a)\ni <- function(b) if(FALSE) b\no(x <- 2)\nprint(x)', '5@print', '[1] 1');
		assertSliceRuns('a definition forwarded to a function that forces it', 'x <- 1\no <- function(a) i(a)\ni <- function(b) b\no(x <- 2)\nprint(x)', '5@print', '[1] 2');
		assertSliceRuns('a nested call reads what its own global write replaces', 'counter <- 0\ninc <- function() counter <<- counter + 1\nf <- function() inc()\nf()\nprint(counter)', '5@print', '[1] 1');
		assertSliceRuns('a nested call made on some paths only writes maybe', 'counter <- 0\ninc <- function() counter <<- 5\nf <- function(n) if(n > 0) inc()\nf(0)\nprint(counter)', '5@print', '[1] 0');
		assertSliceRuns('draws within nested calls advance the state', 'set.seed(1)\nf <- function() g()\ng <- function() runif(1)\nf()\nr <- runif(1)\nprint(r)', '6@print', '[1] 0.3721239');
	});

	describe('rewriting a closure handed in', () => {
		/* `body<-` on the global binding changes what the promise `f` already refers to, as it is the same closure */
		assertSliceRuns('a body rewritten through the global binding changes the handed-in closure', 'adder <- function(n) function(x) x + n; add1 <- adder(1)\ntwice <- function(f, x) {\n  body(add1) <<- quote(x - n)\n  y <- f(f(x))\n  paste(deparse(body(f)), "=", y)\n}\nprint(twice(add1, 5))', '7@print', '[1] "x - n = 3"');
	});

	describe('the random number generator', () => {
		assertSliceRuns('draws within a higher-order function advance the state', 'set.seed(1)\nxs <- sapply(1:3, function(i) runif(1))\nr <- runif(1)\nprint(r)', '4@print', '[1] 0.9082078');
		assertSliceRuns('draws within evaluated code advance the state', 'set.seed(1)\ne <- quote(runif(1))\neval(e)\nr <- runif(1)\nprint(r)', '5@print', '[1] 0.3721239');
		assertSliceRuns('draws within a loop advance the state', 'set.seed(1)\nf <- function() runif(1)\nfor(i in 1:2) f()\nr <- runif(1)\nprint(r)', '5@print', '[1] 0.5728534');
	});
}));
