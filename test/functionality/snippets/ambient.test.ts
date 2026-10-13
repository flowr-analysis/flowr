import { assert, describe, test } from 'vitest';
import { withShell } from '../_helper/shell';
import { decorateLabelContext, label } from '../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';

/*
 * The ambient state (random numbers, options, graphics) flows through every way of calling a function: the slice for
 * the last line, run in R, prints what the whole program prints. Every expected value is the one R prints.
 */
const name = (s: string) => decorateLabelContext(label(s, ['function-calls', 'side-effects-in-function-call']), ['dataflow', 'slice']);

/* R keeps the state across runs, so each one starts from a fresh generator, the initial options, and no device */
const reset = 'RNGkind("default", "default", "default"); if(exists(".Random.seed", globalenv())) rm(".Random.seed", envir = globalenv()); if(!exists(".flowr_opts")) .flowr_opts <- options(); invisible(options(.flowr_opts)); graphics.off(); palette("default")';

describe('Snippets: ambient state', { concurrent: false }, withShell(shell => {
	function assertSliceRuns(title: string, code: string, lastLine: string) {
		test(name(title), async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(shell).build();
			analyzer.addRequest(code);
			const criterion = `${code.split('\n').length}@print` as const;
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [criterion] }]);
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			const run = async(c: string) => {
				shell.clearEnvironment();
				await shell.sendCommandWithOutput(reset);
				return (await shell.sendCommandWithOutput(c)).at(-1);
			};
			assert.strictEqual(await run(code), lastLine, 'the program itself');
			assert.strictEqual(await run(slice), lastLine, `the slice:\n${slice}`);
		});
	}

	describe('random numbers', () => {
		const rng = (title: string, body: string, expected: string) => assertSliceRuns(title, `set.seed(1)\n${body}\nr <- runif(1)\nprint(r)`, expected);
		const one = '[1] 0.3721239';
		const two = '[1] 0.5728534';
		describe('user functions', () => {
			rng('a direct call', 'f <- function() runif(1)\nf()', one);
			rng('a nested call', 'g <- function() runif(1)\nf <- function() g()\nf()', one);
			rng('a nested call defined later', 'f <- function() g()\ng <- function() runif(1)\nf()', one);
			rng('a recursive call', 'f <- function(n) if(n > 0) { runif(1); f(n - 1) }\nf(2)', two);
			rng('mutually recursive calls', 'a <- function(n) if(n > 0) b(n - 1)\nb <- function(n) { runif(1); a(n) }\na(2)', two);
			rng('a call on a true condition', 'f <- function() runif(1)\nc <- TRUE\nif(c) f()', one);
			rng('a call on a false condition', 'f <- function() runif(1)\nc <- FALSE\nif(c) f()', '[1] 0.2655087');
			rng('a call in a for loop', 'f <- function() runif(1)\nfor(i in 1:2) f()', two);
			rng('a call in a while loop', 'f <- function() runif(1)\ni <- 0\nwhile(i < 2) { f(); i <- i + 1 }', two);
			rng('a draw on the taken path of the callee', 'f <- function(n) if(n > 1) runif(1)\nf(2)', one);
			rng('a draw on the path the callee does not take', 'f <- function(n) if(n > 1) runif(1)\nf(0)', '[1] 0.2655087');
			rng('a reseed within a call', 'f <- function() set.seed(42)\nf()', '[1] 0.914806');
			rng('a draw whose result is assigned', 'f <- function() runif(1)\nx <- f()', one);
			rng('a draw in a loop within the callee', 'f <- function() for(i in 1) runif(1)\nf()', one);
			rng('a seed restored through .Random.seed', 's <- .Random.seed\nrunif(1)\nf <- function() assign(".Random.seed", s, envir = globalenv())\nf()', '[1] 0.2655087');
			rng('a seed restored through a super-assignment', 's <- .Random.seed\nrunif(1)\nf <- function() .Random.seed <<- s\nf()', '[1] 0.2655087');
		});
		describe('higher-order functions', () => {
			const g = 'g <- function(f) f(1)\n';
			rng('a built-in handed to a user function', g + 'g(runif)', one);
			rng('a built-in handed down twice', g + 'k <- function(f) g(f)\nk(runif)', one);
			rng('a sampler handed to a user function', 'g <- function(f) f(10)\ng(sample)', '[1] 0.2059746');
			rng('an anonymous closure handed to a user function', g + 'g(function(n) runif(n))', one);
			rng('a named closure handed to a user function', g + 'h <- function(n) runif(n)\ng(h)', one);
			rng('a closure handed down twice', g + 'k <- function(f) g(f)\nk(function(n) runif(n))', one);
			rng('a reseeding closure handed to a user function', 'g <- function(f) f()\ng(function() set.seed(42))', '[1] 0.914806');
			rng('a draw after the callback within the caller', 'g <- function(f) { f(1); runif(1) }\ng(runif)', two);
			rng('a closure from a factory', 'mk <- function() function() runif(1)\nk <- mk()\nk()', one);
			rng('a closure in a list', 'l <- list(f = function() runif(1))\nl$f()', one);
			rng('a closure in a list by index', 'l <- list(function() runif(1))\nl[[1]]()', one);
			rng('a built-in stored in a variable', 'h <- runif\nh(1)', one);
			rng('lapply', 'x <- lapply(1:2, function(i) runif(1))', two);
			rng('sapply with a built-in', 'x <- sapply(1:2, runif)', '[1] 0.9082078');
			rng('vapply', 'x <- vapply(1:2, function(i) runif(1), numeric(1))', two);
			rng('Map', 'x <- Map(function(i) runif(1), 1:2)', two);
			rng('mapply', 'x <- mapply(function(i) runif(1), 1:2)', two);
			rng('Filter', 'x <- Filter(function(i) runif(1) > 0.5, 1:2)', two);
			rng('Reduce', 'x <- Reduce(function(a, b) a + runif(1), 1:3)', two);
			rng('do.call with a built-in', 'x <- do.call(runif, list(2))', two);
			rng('do.call with a name', 'x <- do.call("runif", list(2))', two);
			rng('do.call with a closure', 'x <- do.call(function(n) runif(n), list(2))', two);
			rng('lapply reseeding', 'x <- lapply(1, function(i) set.seed(42))', '[1] 0.914806');
			rng('purrr::map', 'x <- purrr::map(1:2, function(i) runif(1))', two);
			rng('Map with a built-in', 'x <- Map(runif, 1:2)', '[1] 0.9082078');
			rng('mapply with a built-in', 'x <- mapply(runif, 1:2)', '[1] 0.9082078');
			rng('a user function handed to sapply', g + 'x <- sapply(1:2, function(i) g(runif))', two);
			rng('do.call of a user function', g + 'x <- do.call(g, list(runif))', one);
			rng('a higher-order call within a function', g + 'w <- function() g(runif)\nw()', one);
			rng('a higher-order call in a loop', g + 'for(i in 1:2) g(runif)', two);
			rng('a higher-order call on a condition', g + 'c <- TRUE\nif(c) g(runif)', one);
			rng('a higher-order call within local', g + 'local(g(runif))', one);
			rng('a recursive higher-order call', 'g <- function(f, n) if(n > 0) { f(1); g(f, n - 1) }\ng(runif, 2)', two);
			rng('a promise within a handed closure', g + 'h <- function(x) x\ng(function(n) h(runif(n)))', one);
			rng('a callback seeding before a draw of the caller', 'g <- function(f) { f(); runif(1) }\nx <- g(function() set.seed(42))', '[1] 0.9370754');
			assertSliceRuns('a draw in a function called after a higher-order call', 'set.seed(1)\ng <- function(f) f(1)\ng(runif)\nk <- function() runif(1)\nr <- k()\nprint(r)', one);
			assertSliceRuns('the value of a higher-order call', 'set.seed(1)\ng <- function(f) { f(1); runif(1) }\nprint(g(runif))', one);
		});
		describe('promises', () => {
			rng('a draw forced by the callee', 'h <- function(x) x\nh(runif(1))', one);
			rng('a draw the callee never forces', 'h <- function(x) 1\nh(runif(1))', '[1] 0.2655087');
			rng('a draw forced twice', 'h <- function(x) { x; x }\nh(runif(1))', one);
			rng('a draw forced within a nested callee', 'i <- function(y) y\nh <- function(x) i(x)\nh(runif(1))', one);
			rng('a default forced', 'f <- function(x = runif(1)) x\nf()', one);
			rng('a default never forced', 'f <- function(x = runif(1)) 1\nf()', '[1] 0.2655087');
			rng('a draw handed to a user function that forces it later', 'h <- function(x) { y <- 1; x + y }\nh(runif(1))', one);
		});
		describe('evaluation contexts', () => {
			rng('local', 'local(runif(1))', one);
			rng('a call within local', 'local({ f <- function() runif(1); f() })', one);
			rng('eval of a quote', 'eval(quote(runif(1)))', one);
			rng('eval of a stored quote', 'e <- quote(runif(1))\neval(e)', one);
			rng('tryCatch code', 'tryCatch(runif(1), error = function(e) 0)', one);
			rng('tryCatch handler', 'tryCatch(stop("x"), error = function(e) runif(1))', one);
			rng('tryCatch finally', 'tryCatch(1, finally = runif(1))', one);
			rng('on.exit', 'f <- function() { on.exit(runif(1)); 1 }\nf()', one);
			rng('withr::with_seed restores the generator', 'withr::with_seed(42, runif(1))', '[1] 0.2655087');
		});
		describe('the state of the generator', () => {
			assertSliceRuns('reading .Random.seed', 'set.seed(1)\nprint(.Random.seed[3])', '[1] -169270483');
			assertSliceRuns('restoring a saved .Random.seed', 'set.seed(1)\ns <- .Random.seed\nx <- runif(1)\n.Random.seed <- s\nprint(runif(1))', '[1] 0.2655087');
			assertSliceRuns('RNGkind before a seed', 'RNGkind("Wichmann-Hill")\nset.seed(1)\nprint(runif(1))', '[1] 0.1297134');
			assertSliceRuns('the kind set.seed sets persists', 'set.seed(1, kind = "Wichmann-Hill")\nx <- runif(1)\nset.seed(1)\nprint(runif(1))', '[1] 0.1297134');
		});
	});

	describe('options', () => {
		const digits = (title: string, body: string, expected = '[1] 3.14') => assertSliceRuns(title, `${body}\nprint(pi)`, expected);
		const set = 'function() options(digits = 3)';
		digits('a direct call', `f <- ${set}\nf()`);
		digits('a nested call', `f <- ${set}\nk <- function() f()\nk()`);
		digits('a recursive call', 'f <- function(n) if(n > 0) f(n - 1) else options(digits = 3)\nf(2)');
		digits('a call on a condition', `f <- ${set}\nc <- TRUE\nif(c) f()`);
		digits('a call in a loop', `f <- ${set}\nfor(i in 1:2) f()`);
		digits('a call on the path not taken', 'f <- function(n) if(n > 1) options(digits = 3)\nf(0)', '[1] 3.141593');
		digits('a closure handed to a user function', `g <- function(f) f()\ng(${set})`);
		digits('a named closure handed to a user function', `g <- function(f) f()\nh <- ${set}\ng(h)`);
		digits('options handed to a user function', 'g <- function(f, ...) f(...)\ng(options, digits = 3)');
		digits('lapply', 'x <- lapply(1, function(i) options(digits = 3))');
		digits('do.call', 'do.call(options, list(digits = 3))');
		digits('a closure from a factory', `mk <- function() ${set}\nk <- mk()\nk()`);
		digits('a promise forced by the callee', 'h <- function(x) x\nh(options(digits = 3))');
		digits('a promise the callee never forces', 'h <- function(x) 1\nh(options(digits = 3))', '[1] 3.141593');
		digits('local', 'local(options(digits = 3))');
		digits('withr::local_options in a function', 'f <- function() withr::local_options(digits = 3)\nf()', '[1] 3.141593');
		digits('tryCatch', 'tryCatch(options(digits = 3), error = function(e) 0)');
		digits('a higher-order call within a function', `g <- function(f) f()\nw <- function() g(${set})\nw()`);
		digits('a higher-order call on a condition', `g <- function(f) f()\nc <- TRUE\nif(c) g(${set})`);
		digits('a closure handed down twice', `g <- function(f) f()\nk <- function(f) g(f)\nk(${set})`);
		digits('options handed to sapply', 'x <- sapply(1, function(i) options(digits = 3))');
		assertSliceRuns('printing in a function called after a higher-order call', `g <- function(f) f()\ng(${set})\nk <- function() format(pi)\nprint(k())`, '[1] "3.14"');
		assertSliceRuns('getOption after a closure handed to a user function', 'g <- function(f) f()\ng(function() options(myopt = 5))\nprint(getOption("myopt"))', '[1] 5');
		const warns = 'r <- tryCatch({ warning("w"); "no" }, error = function(e) "error")\nprint(r)';
		assertSliceRuns('warn set in a called function', `f <- function() options(warn = 2)\nf()\n${warns}`, '[1] "error"');
		assertSliceRuns('warn set in a closure handed to a user function', `g <- function(f) f()\ng(function() options(warn = 2))\n${warns}`, '[1] "error"');
		assertSliceRuns('warn set in lapply', `x <- lapply(1, function(i) options(warn = 2))\n${warns}`, '[1] "error"');
		assertSliceRuns('warn set by options handed to a user function', `g <- function(f, ...) f(...)\ng(options, warn = 2)\n${warns}`, '[1] "error"');
		assertSliceRuns('warn set before a warning within a function', 'g <- function(f) f()\ng(function() options(warn = 2))\nk <- function() tryCatch({ warning("w"); "no" }, error = function(e) "error")\nprint(k())', '[1] "error"');
		assertSliceRuns('warn kept below two', `f <- function() options(warn = 1)\nf()\n${warns}`, '[1] "no"');
	});

	assertSliceRuns('a super-assignment in a closure handed down twice', 'x <- 1\ng <- function(f) f()\nk <- function(f) g(f)\nk(function() x <<- 2)\nprint(x)', '[1] 2');

	describe('files', () => {
		const file = (title: string, body: string, expected: string) => assertSliceRuns(title, `p <- tempfile()\n${body}`, expected);
		file('a connection written and closed', 'con <- file(p, "w")\nwriteLines("c", con)\nclose(con)\nprint(readLines(p))', '[1] "c"');
		file('a connection appended to', 'writeLines("x", p)\ncon <- file(p, "a")\nwriteLines("y", con)\nclose(con)\nprint(readLines(p)[2])', '[1] "y"');
		file('a connection flushed', 'con <- file(p, "w")\nwriteLines("y", con)\nflush(con)\nprint(readLines(p))', '[1] "y"');
		file('a sink to a connection', 'zz <- file(p, "w")\nsink(zz)\ncat("s\\n")\nsink()\nclose(zz)\nprint(readLines(p))', '[1] "s"');
		file('capture.output to a file', 'capture.output(print(5), file = p)\nprint(readLines(p))', '[1] "[1] 5"');
		file('dput and dget', 'dput(3, file = p)\nprint(dget(p))', '[1] 3');
		file('file.size', 'writeLines("abc", p)\nprint(file.size(p))', '[1] 4');
		file('a file sourced after a call wrote it', 'f <- function() writeLines("zz <- 3", p)\nf()\nsource(p)\nprint(zz)', '[1] 3');
		file('cat appending in a function', 'cat("a\\n", file = p)\nw <- function(s) cat(s, "\\n", file = p, append = TRUE)\nw("b")\nprint(length(readLines(p)))', '[1] 2');
	});

	describe('graphics', () => {
		const mar = (title: string, body: string, expected = '[1] 1 1 1 1') => assertSliceRuns(title, `${body}\nprint(par("mar"))`, expected);
		const set = 'function() par(mar = c(1, 1, 1, 1))';
		mar('a direct call', `f <- ${set}\nf()`);
		mar('a nested call', `f <- ${set}\nk <- function() f()\nk()`);
		mar('a call in a loop', `f <- ${set}\nfor(i in 1:2) f()`);
		mar('a closure handed to a user function', `g <- function(f) f()\ng(${set})`);
		mar('par handed to a user function', 'g <- function(f, ...) f(...)\ng(par, mar = c(1, 1, 1, 1))');
		mar('lapply', 'x <- lapply(1, function(i) par(mar = c(1, 1, 1, 1)))');
		mar('a promise forced by the callee', 'h <- function(x) x\nh(par(mar = c(1, 1, 1, 1)))');
		mar('a plot after the call', `f <- ${set}\nf()\nplot(1)`);
		mar('a higher-order call within a function', `g <- function(f) f()\nw <- function() g(${set})\nw()`);
		mar('do.call with par', 'do.call(par, list(mar = c(1, 1, 1, 1)))');
		mar('palette handed to a user function does not touch the parameters', 'g <- function(f, ...) f(...)\ng(palette, "R3")', '[1] 5.1 4.1 4.1 2.1');
		assertSliceRuns('palette handed to a user function', 'g <- function(f, ...) f(...)\ng(palette, "R3")\nprint(palette()[2])', '[1] "red"');
		assertSliceRuns('palette set in a closure handed to a user function', 'g <- function(f) f()\ng(function() palette("R3"))\nprint(palette()[2])', '[1] "red"');
	});
}));
