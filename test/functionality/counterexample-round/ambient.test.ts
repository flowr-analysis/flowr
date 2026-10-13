import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assert, beforeAll, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';

const run = promisify(execFile);
async function printed(code: string): Promise<string | undefined> {
	try {
		const { stdout } = await run('Rscript', ['--vanilla', '-e', code], { cwd: os.tmpdir(), maxBuffer: 1 << 24 });
		return stdout.trimEnd().split('\n').at(-1);
	} catch(e) {
		return `ERROR ${String((e as { stderr?: string }).stderr).trim().split('\n').slice(0, 2).join(' | ')}`;
	}
}

const cases: readonly (readonly [string, string, string?])[] = [
	['reading .Random.seed', 'set.seed(1)\nprint(.Random.seed[3])'],
	['exists .Random.seed after a draw', 'x <- runif(1)\nprint(exists(".Random.seed"))'],
	['restoring a saved .Random.seed', 'set.seed(1)\ns <- .Random.seed\nx <- runif(1)\n.Random.seed <- s\nprint(runif(1))'],
	['restoring a saved .Random.seed via assign', 'set.seed(1)\ns <- .Random.seed\nx <- runif(1)\nassign(".Random.seed", s, envir = globalenv())\nprint(runif(1))'],
	['RNGkind', 'RNGkind("Wichmann-Hill")\nset.seed(1)\nprint(runif(1))'],
	['RNGkind sample.kind', 'RNGkind(sample.kind = "Rounding")\nset.seed(1)\nprint(sample(10, 1))'],
	['set.seed kind persists', 'set.seed(1, kind = "Marsaglia-Multicarry")\nx <- runif(1)\nset.seed(1)\nprint(runif(1))'],
	['Vectorize', 'set.seed(1)\ng <- Vectorize(runif)\ng(1)\nprint(runif(1))'],
	['Vectorize of a function without effects', 'set.seed(1)\ng <- Vectorize(function(x) x + 1)\ng(1)\nprint(runif(1))', 'g(1)'],
	['Negate', 'set.seed(1)\ng <- Negate(function(x) runif(1) > 2)\ng(1)\nprint(runif(1))'],
	['Negate of a built-in without effects', 'set.seed(1)\ng <- Negate(is.null)\ng(1)\nprint(runif(1))', 'g(1)'],
	['factory over a built-in parameter', 'set.seed(1)\nmk <- function(f) function() f(1)\nh <- mk(runif)\nh()\nprint(runif(1))'],
	['factory over a built-in without effects', 'set.seed(1)\nmk <- function(f) function() f(1)\nh <- mk(sqrt)\nh()\nprint(runif(1))', 'h()'],
	['factory over a closure parameter', 'set.seed(1)\nmk <- function(f) function() f()\nh <- mk(function() runif(1))\nh()\nprint(runif(1))'],
	['factory over options', 'mk <- function(f) function() f(digits = 3)\nh <- mk(options)\nh()\nprint(pi)'],
	['factory over writeLines', 'p <- tempfile()\nmk <- function(f) function() f("w", p)\nh <- mk(writeLines)\nh()\nprint(readLines(p))'],
	['factory over a built-in writing no file', 'p <- tempfile()\nwriteLines("a", p)\nmk <- function(f) function() f("w")\nh <- mk(nchar)\nh()\nprint(readLines(p))', 'h()'],
	['withr::local_seed in a function', 'f <- function() { withr::local_seed(3); runif(1) }\nset.seed(1)\nf()\nprint(runif(1))'],
	['delayedAssign draw', 'set.seed(1)\ndelayedAssign("dd", runif(1))\ndd\nprint(runif(1))'],
	['delayedAssign never forced', 'set.seed(1)\ndelayedAssign("dd", runif(1))\nee <- 2\nee\nprint(runif(1))', 'delayedAssign'],
	['delayedAssign options', 'delayedAssign("dd", options(digits = 3))\ndd\nprint(pi)'],
	['delayedAssign options never forced', 'delayedAssign("dd", options(digits = 3))\nprint(pi)', 'delayedAssign'],
	['body<-', 'set.seed(1)\nf <- function() 1\nbody(f) <- quote(runif(1))\nf()\nprint(runif(1))'],
	['S3 method draws', 'set.seed(1)\nfoo <- function(x) UseMethod("foo")\nfoo.default <- function(x) runif(1)\nfoo(1)\nprint(runif(1))'],
	['S3 method sets options', 'foo <- function(x) UseMethod("foo")\nfoo.default <- function(x) options(digits = 3)\nfoo(1)\nprint(pi)'],
	['auto-printing method draws', 'set.seed(1)\nprint.zz <- function(x, ...) { runif(1); invisible(x) }\nx <- structure(1, class = "zz")\nx\nprint(runif(1))'],
	['finalizer draws', 'set.seed(1)\ne <- new.env()\nreg.finalizer(e, function(e) runif(1))\nrm(e)\ninvisible(gc())\nprint(runif(1))'],
	['finalizer never registered', 'set.seed(1)\ne <- new.env()\nf <- function(e) runif(1)\nrm(e)\ninvisible(gc())\nprint(runif(1))', 'gc'],
	['writeLines to a connection then close', 'p <- tempfile()\ncon <- file(p, "w")\nwriteLines("c", con)\nclose(con)\nprint(readLines(p))'],
	['append connection', 'p <- tempfile()\nwriteLines("x", p)\ncon <- file(p, "a")\nwriteLines("y", con)\nclose(con)\nprint(readLines(p)[2])'],
	['flush connection', 'p <- tempfile()\ncon <- file(p, "w")\nwriteLines("y", con)\nflush(con)\nprint(readLines(p))'],
	['sink to a connection', 'p <- tempfile()\nzz <- file(p, "w")\nsink(zz)\ncat("s\\n")\nsink()\nclose(zz)\nprint(readLines(p))'],
	['capture.output to a file', 'p <- tempfile()\ncapture.output(print(5), file = p)\nprint(readLines(p))'],
	['dput dget', 'p <- tempfile()\ndput(3, file = p)\nprint(dget(p))'],
	['file.exists after a write', 'p <- file.path(tempdir(), "e.txt")\nwriteLines("x", p)\nprint(file.exists(p))'],
	['file.size after a write', 'p <- tempfile()\nwriteLines("abc", p)\nprint(file.size(p))'],
	['file.info after a write', 'p <- tempfile()\nwriteLines("abc", p)\nprint(file.info(p)$size)'],
	['source of a file written in a function', 'p <- tempfile()\nf <- function() writeLines("zz <- 3", p)\nf()\nsource(p)\nprint(zz)'],
	['warn 2 aborts an assignment in try', 'options(warn = 2)\nx <- 1\ntry(x <- as.numeric("a"), silent = TRUE)\nprint(x)'],
	['warn 2 aborts a loop in try', 'options(warn = 2)\nn <- 0\ntry(for(i in 1:3) { n <- n + 1; log(-1) }, silent = TRUE)\nprint(n)'],
	['warn 2 aborts a super-assignment', 'options(warn = 2)\nx <- 1\nf <- function() { log(-1); x <<- 2 }\ntry(f(), silent = TRUE)\nprint(x)'],
	['warn 2 set in a function aborts', 'x <- 1\nf <- function() options(warn = 2)\nf()\ntry({ log(-1); x <- 5 }, silent = TRUE)\nprint(x)'],
	['stop in a called function aborts try', 'x <- 1\nf <- function() stop("s")\ntry({ f(); x <- 2 }, silent = TRUE)\nprint(x)'],
];

describe('Counterexamples: ambient state', () => {
	beforeAll(async() => {
		await TreeSitterExecutor.initTreeSitter();
	});
	for(const [name, code, absent] of cases) {
		test(name, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(new TreeSitterExecutor()).build();
			analyzer.addRequest(code);
			const sliced = await analyzer.query([{ type: 'static-slice', criteria: [`${code.split('\n').length}@print` as SlicingCriterion] }]);
			const slice = (Object.values(sliced['static-slice'].results)[0] as { reconstruct: { code: string } }).reconstruct.code;
			const [whole, part] = await Promise.all([printed(code), printed(slice)]);
			assert.strictEqual(part, whole, `the slice:\n${slice}`);
			if(absent !== undefined) {
				assert.notInclude(slice, absent, `the slice:\n${slice}`);
			}
		});
	}
});
