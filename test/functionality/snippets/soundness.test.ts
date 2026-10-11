import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assert, beforeAll, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';

/*
 * Programs built to break the slicer: higher-order and closure state, environments, active bindings, promises,
 * reflection, ambient state. The slice for the last line, run in R, has to print what the whole program prints.
 */
const run = promisify(execFile);
async function printed(code: string): Promise<string | undefined> {
	const { stdout } = await run('Rscript', ['--vanilla', '-e', code], { cwd: os.tmpdir(), maxBuffer: 1 << 24 });
	return stdout.trimEnd().split('\n').at(-1);
}

const cases: readonly (readonly [string, string])[] = [
	['R5 only', 'Counter <- function() { self <- environment(); n <- 0; inc <- function() n <<- n + 1; self }\nc1 <- Counter()\nc1$inc()\nprint(c1$n)'],
	['local env', 'x <- 1\nlocal({ x <<- 2 })\nprint(x)'],
	['closure in list', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nfs <- list(mk(), mk())\nfs[[1]]()\nr <- fs[[1]]()\nprint(r)'],
	['Reduce closure', 'acc <- 0\nReduce(function(a, b) { acc <<- acc + b; a + b }, 1:3)\nprint(acc)'],
	['on.exit', 'x <- 1\nf <- function() { on.exit(x <<- 5); 2 }\nf()\nprint(x)'],
	['repeat break promise', 'f <- function(a) { repeat { if(a > 0) break }; 3 }\nx <- 0\nr <- f(x <- 1)\nprint(x)'],
	['recursion global', 'cnt <- 0\nf <- function(n) { cnt <<- cnt + 1; if(n > 0) f(n - 1) }\nf(3)\nprint(cnt)'],
	['assign dynamic', 'nm <- paste0("v", 1)\nassign(nm, 42)\nprint(v1)'],
	['get dynamic', 'v2 <- 7\nnm <- "v2"\nprint(get(nm))'],
	['environment(fn)$var', 'mk <- function() { s <- 1; function() s }\nf <- mk()\nenvironment(f)$s <- 9\nprint(f())'],
	['replacement user fn', '`second<-` <- function(x, value) { x[2] <- value; x }\nv <- c(1, 2, 3)\nsecond(v) <- 10\nprint(v)'],
	['names<-', 'v <- 1:2\nnames(v) <- c("a", "b")\nprint(names(v))'],
	['attr<-', 'v <- 1\nattr(v, "u") <- "m"\nprint(attr(v, "u"))'],
	['switch fallthrough', 'k <- "b"\nr <- switch(k, a = , b = 2, 3)\nprint(r)'],
	['do.call list args', 'f <- function(a, b) a - b\nargs <- list(b = 1, a = 5)\nprint(do.call(f, args))'],
	['Map closure global', 'tot <- 0\nMap(function(x, y) tot <<- tot + x * y, 1:2, 3:4)\nprint(tot)'],
	['vapply side effect', 'cnt <- 0\nvapply(1:3, function(i) { cnt <<- cnt + i; 0 }, numeric(1))\nprint(cnt)'],
	['tryCatch finally', 'x <- 1\ntryCatch(stop("e"), error = function(e) x <<- 2, finally = x <<- x * 10)\nprint(x)'],
	['Recall', 'f <- function(n) if(n <= 1) 1 else n * Recall(n - 1)\nprint(f(4))'],
	['sys.function', 'f <- function(n) if(n <= 1) 1 else n * sys.function()(n - 1)\nprint(f(4))'],
	['eval in env', 'e <- new.env()\neval(quote(z <- 3), e)\nprint(e$z)'],
	['evalq local', 'z <- 1\nevalq(z <- 4, globalenv())\nprint(z)'],
	['lazy default uses later local', 'f <- function(a = b) { b <- 5; a }\nprint(f())'],
	['promise forced once', 'cnt <- 0\nf <- function(x) { x; x; x }\nf({ cnt <<- cnt + 1 })\nprint(cnt)'],
	['missing arg', 'f <- function(a) if(missing(a)) "none" else a\nprint(f())'],
	['ellipsis forward', 'g <- function(...) h(...)\nh <- function(a, b) a * b\nprint(g(b = 3, a = 2))'],
	['nargs', 'f <- function(...) nargs()\nprint(f(1, 2, 3))'],
	['match.arg', 'f <- function(t = c("x", "y")) match.arg(t)\nprint(f())'],
	['seed in tryCatch', 'tryCatch(set.seed(2), error = function(e) NULL)\nprint(runif(1))'],
	['options restore', 'op <- options(digits = 3)\noptions(op)\nprint(pi)'],
	['global via assign envir', 'f <- function() assign("g1", 8, envir = globalenv())\nf()\nprint(g1)'],
	['sapply closure draws', 'set.seed(4)\ninvisible(sapply(1:2, function(i) runif(1)))\nprint(runif(1))'],
	['conditional seed in fn', 'f <- function(s) if(s) set.seed(1)\nf(TRUE)\nprint(runif(1))'],
	['while counter', 'i <- 0\nwhile(i < 3) i <- i + 1\nprint(i)'],
	['for over list modify', 'l <- list(1, 2)\nfor(j in seq_along(l)) l[[j]] <- l[[j]] * 2\nprint(l[[2]])'],
	['S3 NextMethod', 'print.a <- function(x, ...) { cat("a "); NextMethod() }\nprint.b <- function(x, ...) cat("b\\n")\nobj <- structure(1, class = c("a", "b"))\nprint(obj)'],
	['R5 like env obj', 'Counter <- function() { self <- environment(); n <- 0; inc <- function() n <<- n + 1; self }\nc1 <- Counter()\nc1$inc()\nprint(c1$n)'],
];

describe('Snippets: soundness of slices', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});
	for(const [name, code] of cases) {
		test.concurrent(name, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [`${code.split('\n').length}@print` as SlicingCriterion] }]);
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			const [whole, part] = await Promise.all([printed(code), printed(slice)]);
			assert.strictEqual(part, whole, `the slice:\n${slice}`);
		});
	}
});
