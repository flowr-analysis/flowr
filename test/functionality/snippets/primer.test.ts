import { canReach } from '../../../src/control-flow/simple-visitor';
import { afterAll, assert, describe, test } from 'vitest';
import { assertDataflow, assertSliced, assumeLoadedPackages, withShell } from '../_helper/shell';
import { label } from '../_helper/label';
import { emptyGraph } from '../../../src/dataflow/graph/dataflowgraph-builder';
import { Ternary } from '../../../src/util/logic';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import type { RShell } from '../../../src/r-bridge/shell';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { extractCfg } from '../../../src/control-flow/control-flow-graph';
import { happensBefore } from '../../../src/control-flow/happens-before';
import { contextFromInput } from '../../../src/project/context/flowr-analyzer-context';

/** one-directional variant of the happens-before helper, as the end of a function may be unreachable */
function assertOrder(shell: RShell, code: string, a: SlicingCriterion, b: SlicingCriterion, expected: Ternary, fails = false) {
	describe(code, () => {
		(fails ? test.fails : test).each([shell, new TreeSitterExecutor()])('%s', async parser => {
			const result = await createDataflowPipeline(parser, { context: contextFromInput(code) }).allRemainingSteps();
			const cfg = extractCfg(result.dataflow);
			const actual = happensBefore(cfg.graph, SlicingCriterion.parse(a, result.normalize.idMap), SlicingCriterion.parse(b, result.normalize.idMap));
			assert.strictEqual(actual, expected);
		});
	});
}

/** whether control reaches `target` from the start of the program */
function assertReaches(shell: RShell, code: string, target: SlicingCriterion, expected: boolean) {
	describe(code, () => {
		test.each([shell, new TreeSitterExecutor()])('reaches %s', async parser => {
			const result = await createDataflowPipeline(parser, { context: contextFromInput(code) }).allRemainingSteps();
			const cfg = extractCfg(result.dataflow);
			assert.strictEqual(canReach(cfg.graph, cfg.entryPoints, SlicingCriterion.parse(target, result.normalize.idMap)), expected);
		});
	});
}

assumeLoadedPackages('dplyr');

const sec = (s: string) => label(s, ['name-normal', 'function-calls']);

describe('Snippets: primer', { concurrent: false }, withShell(shell => {
	describe('values: growing vectors', () => {
		assertSliced(sec('primer:values x[5] <- 1'), shell, 'x <- 1\nx[5] <- 1\nprint(x)', ['3@print'], 'x <- 1\nx[5] <- 1\nprint(x)');
		assertSliced(sec('primer:values NULL turns into vector'), shell, 'g <- NULL\ng[1] <- 1\nprint(g)', ['3@print'], 'g <- NULL\ng[1] <- 1\nprint(g)');
	});

	describe('promises: default argument side effects', () => {
		const f = 'f <- function(x = {\n  x <- 1\n  2\n}) { x * 2 }\n';
		const g = 'g <- function(x = {\n  x <- 1\n  2\n}) { x + x }\n';
		assertSliced(sec('primer:promises f()'), shell, f + 'r <- f()\nprint(r)', ['6@print'], 'f <- function(x={x <- 1; 2}) x * 2\nr <- f()\nprint(r)', { expectedOutput: '[1] 4', expectedSliceOutput: '[1] 4' });
		assertSliced(sec('primer:promises g()'), shell, g + 'r <- g()\nprint(r)', ['6@print'], 'g <- function(x={x <- 1; 2}) x + x\nr <- g()\nprint(r)', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
		assertSliced(sec('primer:promises unforced default is not needed'), shell, 'k <- function(x = {\n  x <- 1\n  2\n}) { 3 }\nr <- k()\nprint(r)', ['6@print'], 'k <- function(x={x <- 1; 2}) 3\nr <- k()\nprint(r)', { expectedOutput: '[1] 3', expectedSliceOutput: '[1] 3' });
	});

	describe('env: assign into the caller', () => {
		const code = 'f <- function() {\n    var_name <- "x"\n    assign(var_name, 42, envir = parent.frame())\n}\nf()\nprint(x)';
		assertSliced(sec('primer:env assign parent.frame'), shell, code, ['6@print'], 'f <- function() {\n        var_name <- "x"\n        assign(var_name, 42, envir = parent.frame())\n    }\nf()\nprint(x)', { expectedOutput: '[1] 42', expectedSliceOutput: '[1] 42' });
		assertDataflow(sec('primer:env use of x reads the assign'), shell, code, emptyGraph().reads('6@x', '3@var_name'),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true });
	});

	describe('nse', () => {
		assertSliced(sec('primer:nse subset and with'), shell, 'df <- data.frame(x = c(-1, 2))\nsubset(df, x > 0)\nwith(df, mean(x))', ['3@with'], 'df <- data.frame(x = c(-1, 2))\nwith(df, mean(x))');
		assertSliced(sec('primer:nse subset'), shell, 'df <- data.frame(x = c(-1, 2))\nsubset(df, x > 0)\nwith(df, mean(x))', ['2@subset'], 'df <- data.frame(x = c(-1, 2))\nsubset(df, x > 0)');
	});

	describe('reflection', () => {
		const code = 'f <- function(x = {\n  x <- 2\n  1\n}) x + x\nf()\nformals(f) <- alist(x = 5)\nbody(f)    <- quote(x <<- x + x)\nf()\neval(parse(text = "`<-` <- `*`"))\nx <- 2\nprint(x)';
		/* after `eval(parse(...))`, `x <- 2` multiplies instead of assigning, so only the call of the rewritten `f` sets `x` */
		assertSliced(sec('primer:reflection session'), shell, code, ['11@print'],
			'f <- function(x={x <- 2; 1}) x + x\nformals(f) <- alist(x = 5)\nbody(f) <- quote(x <<- x + x)\nf()\nprint(x)',
			{ expectedOutput: '[1] 3\n[1] 20\n[1] 10', expectedSliceOutput: '[1] 10' });
	});

	describe('redefining control flow', () => {
		const code = '`if` <- function(cond, true, false) {\n  force(true)\n  force(false)\n}\nif(x > 0) { print("positive")\n} else { print("non-positive") }';
		assertDataflow(sec('primer:reflection redefined if is a call of the user function'), shell, code,
			emptyGraph().calls('5@if', '1@function'),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true });
		/* reading `true` forces the promise just as `force(true)` does */
		assertSliced(sec('primer:reflection redefined if keeps the definition'), shell, code, ['6@print'],
			'`if` <- function(cond, true, false) {\n        true\n        force(false)\n    }\nif(x > 0) { print("positive") } else\n{ print("non-positive") }',
			{ expectedOutput: '[1] "positive"\n[1] "non-positive"', expectedSliceOutput: '[1] "positive"\n[1] "non-positive"' });
	});

	describe('oop', () => {
		const code = 'x <- "hello"\nprint(x)\nprint.character <- function(...) 42\nprint(x)';
		assertSliced(sec('primer:oop S3 method added later'), shell, code, ['4@print'], 'x <- "hello"\nprint.character <- function(...) 42\nprint(x)', { expectedOutput: '[1] "hello"\n[1] 42', expectedSliceOutput: '[1] 42' });
		assertSliced(sec('primer:oop S3 method not yet defined'), shell, code, ['2@print'], 'x <- "hello"\nprint(x)');
	});

	describe('control: warn option', () => {
		/* running the slices sets the option in the shared session */
		afterAll(() => shell.sendCommand('options(warn = 0)'));
		const code = 'f <- function() {\n  n <- as.integer("a")\n  "after"\n}\nf()\noptions(warn = 2)\nr <- tryCatch(f(), error = function(e) "aborted")\nprint(r)';
		assertSliced(sec('primer:control warn option'), shell, code, ['8@print'],
			'f <- function() {\n        as.integer("a")\n        "after"\n    }\noptions(warn = 2)\nr <- tryCatch(f(), error = function(e) "aborted")\nprint(r)',
			{ expectedOutput: '[1] "after"\n[1] "aborted"', expectedSliceOutput: '[1] "aborted"' });
		const f = 'f <- function() {\n  n <- as.integer("a")\n  "after"\n}\n';
		const fn = 'f <- function() {\n        as.integer("a")\n        "after"\n    }\n';
		const tc = (block = 'f()') => `r <- tryCatch(${block}, error = function(e) "aborted")\nprint(r)`;
		/* each checked with R: the slice keeps what may warn exactly when `warn` may be 2 or more */
		for(const [label, setup, criterion, sliced, block, output] of [
			['warn 1', 'options(warn = 1)\n', '7@print', 'f <- function() "after"\noptions(warn = 1)\n', 'f()', '[1] "after"'],
			['suppressWarnings', 'options(warn = 2)\n', '7@print', 'f <- function() "after"\noptions(warn = 2)\n', 'suppressWarnings(f())', '[1] "after"'],
			['muffled', 'options(warn = 2)\n', '7@print', 'f <- function() "after"\noptions(warn = 2)\n', 'withCallingHandlers(f(), warning = function(w) invokeRestart("muffleWarning"))', '[1] "after"'],
			['muffled in braces', 'options(warn = 2)\n', '7@print', 'f <- function() "after"\noptions(warn = 2)\n', 'withCallingHandlers(f(), warning = function(w) { invokeRestart("muffleWarning") })', '[1] "after"'],
			['not muffled', 'options(warn = 2)\n', '7@print', fn + 'options(warn = 2)\n', 'withCallingHandlers(f(), warning = function(w) 1)', '[1] "aborted"'],
			['muffled messages only', 'options(warn = 2)\n', '7@print', fn + 'options(warn = 2)\n', 'withCallingHandlers(f(), message = function(m) invokeRestart("muffleMessage"))', '[1] "aborted"'],
			['branch', 'if(runif(1) < 2) options(warn = 2)\n', '7@print', fn + 'if(runif(1) < 2) options(warn = 2)\n', 'f()', '[1] "aborted"'],
			['in function', 'g <- function() options(warn = 2)\ng()\n', '8@print', fn + 'g <- function() options(warn = 2)\ng()\n', 'f()', '[1] "aborted"'],
			['restore', 'options(warn = 0)\nop <- options(warn = 2)\noptions(op)\n', '9@print', fn + 'options(warn = 0)\nop <- options(warn = 2)\noptions(op)\n', 'f()', '[1] "after"'],
		] as const) {
			assertSliced(sec(`primer:control warn option ${label}`), shell, f + setup + tc(block), [criterion], sliced + tc(block), { expectedSliceOutput: output });
		}
		assertSliced(sec('primer:control warn option warning'), shell, 'options(warn = 2)\nr <- tryCatch(warning("w"), error = function(e) "aborted")\nprint(r)', ['3@print'], 'options(warn = 2)\nr <- tryCatch(warning("w"), error = function(e) "aborted")\nprint(r)', { expectedSliceOutput: '[1] "aborted"' });
		assertSliced(sec('primer:control warn option try'), shell, f + 'options(warn = 2)\nr <- try(f(), silent = TRUE)\nprint(class(r))', ['7@print'], fn + 'options(warn = 2)\nr <- try(f(), silent = TRUE)\nprint(class(r))', { expectedSliceOutput: '[1] "try-error"' });
	});

	describe('control: return in a promise', () => {
		const h = 'h <- function() {\n  g(return("h early"))\n  "h end"\n}\n';
		const forcing = 'g <- function(a) {\n  a\n  "g end"\n}\n' + h + 'r <- h()\nprint(r)';
		const lazy = 'g <- function(a) {\n  "g end"\n}\n' + h + 'r <- h()\nprint(r)';
		/* the `a` that forces the promise is what makes `h` return early, so the slice keeps it */
		assertSliced(sec('primer:control forcing return'), shell, forcing, ['10@print'], 'g <- function(a) {\n        a\n        "g end"\n    }\nh <- function() {\n        g(return("h early"))\n        "h end"\n    }\nr <- h()\nprint(r)', { expectedOutput: '[1] "h early"', expectedSliceOutput: '[1] "h early"' });
		assertSliced(sec('primer:control not forcing return'), shell, lazy, ['9@print'],
			'g <- function(a) "g end"\nh <- function() {\n        g(return("h early"))\n        "h end"\n    }\nr <- h()\nprint(r)',
			{ expectedOutput: '[1] "h end"', expectedSliceOutput: '[1] "h end"' });
		assertReaches(shell, forcing, '7@"h end"', false);
		assertReaches(shell, lazy, '6@"h end"', true);
		assertOrder(shell, lazy, '5@g', '6@"h end"', Ternary.Always);
	});

	describe('state', () => {
		assertSliced(sec('primer:state set.seed'), shell, 'set.seed(1)\nrunif(1)\nr <- runif(1)\nprint(r)', ['4@print'], 'set.seed(1)\nrunif(1)\nr <- runif(1)\nprint(r)', { expectedOutput: '[1] 0.2655087\n[1] 0.3721239', expectedSliceOutput: '[1] 0.2655087\n[1] 0.3721239' });
		assertSliced(sec('primer:state graphics device'), shell, 'plot(1:10)\npoints(10:1)', ['2@points'], 'plot(1:10)\npoints(10:1)');
	});

	describe('intertwine', () => {
		const factor = 'x <- 1:3\nclass(x)  <- "factor"\nlevels(x) <- c("a", "b", "c")\nprint(typeof(x))\nprint(class(x))';
		assertSliced(sec('intertwine factor class'), shell, factor, ['5@print'], 'x <- 1 : 3\nclass(x) <- "factor"\nlevels(x) <- c("a", "b", "c")\nprint(class(x))');
		assertSliced(sec('intertwine factor typeof'), shell, factor, ['4@print'], 'x <- 1 : 3\nclass(x) <- "factor"\nlevels(x) <- c("a", "b", "c")\nprint(typeof(x))');
		const col = 'df <- data.frame(a = 1, b = 2)\nflag <- runif(1) > 0.5\ncol <- if(flag) "a" else "b"\nr <- df[[col]]';
		assertSliced(sec('intertwine dynamic column'), shell, col, ['4@r'], 'df <- data.frame(a = 1, b = 2)\nflag <- runif(1) > 0.5\ncol <- if(flag) "a" else\n    "b"\nr <- df[[col]]');
		const fn = 'flag <- runif(1) > 0.5\nmethod <- if(flag) "sum" else "max"\nfn <- get(method)\nfn(1)';
		assertSliced(sec('intertwine dynamic function'), shell, fn, ['3@fn'], 'flag <- runif(1) > 0.5\nmethod <- if(flag) "sum" else\n    "max"\nfn <- get(method)');
	});

	describe('abstract interpretation: pipeline', () => {
		const code = 'df <- data.frame(id = 1:4, score = 1:4)\ndf2 <- df |> filter(score > 2) |>\n  mutate(lvl = score^2) |> select(-score)\ndf2$lvl';
		assertSliced(sec('ai:shape pipeline'), shell, code, ['4@df2'], 'df <- data.frame(id = 1:4, score = 1:4)\ndf2 <- df |> filter(score > 2) |> mutate(lvl = score^2) |> select(-score)\ndf2');
	});

	describe('cycle figure', () => {
		const code = 'avg <- function(df, col, n = nrow(df)) {\n  if(anyNA(df))\n    df <- na.omit(df)\n  sum(df[[col]]) / n\n}\ndf <- data.frame(a = c(1, NA, 3))\nr <- avg(df, "a")\nprint(r)';
		assertSliced(sec('cycle:avg'), shell, code, ['8@print'], 'avg <- function(df, col, n=nrow(df)) {\n        if(anyNA(df)) df <- na.omit(df)\n        sum(df[[col]]) / n\n    }\ndf <- data.frame(a = c(1, NA, 3))\nr <- avg(df, "a")\nprint(r)', { expectedOutput: '[1] 2', expectedSliceOutput: '[1] 2' });
		assertDataflow(sec('cycle:avg lazy n sees na.omit definition'), shell, code,
			emptyGraph().reads('1@[2]df', '1@[1]df').reads('1@[2]df', '3@[1]df'),
			{ resolveIdsAsCriterion: true, expectIsSubgraph: true });
	});
}));
