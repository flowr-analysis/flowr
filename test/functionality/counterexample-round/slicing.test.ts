import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assert, beforeAll, describe, test } from 'vitest';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { TreeSitterExecutor } from '../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';
import type { SlicingCriterion } from '../../../src/slicing/criterion/parse';

const run = promisify(execFile);
async function printed(code: string): Promise<string | undefined> {
	const { stdout } = await run('Rscript', ['--vanilla', '-e', code], { cwd: os.tmpdir(), maxBuffer: 1 << 24, timeout: 10000 });
	return stdout.trimEnd().split('\n').at(-1);
}

/*
 * Counterexamples: the slice for the last line, run in R, prints something other than the whole program (or does not terminate).
 * All of them currently fail and are marked with `fails`.
 */
const cases: readonly (readonly [string, string, string?])[] = [
	['unconditional break dropped (for)', 'for(i in 1:3) { g <- i; break }\nprint(g)'],
	['unconditional break dropped (repeat, slice never terminates)', 'repeat { g <- 5; break }\nprint(g)'],
	['constant-true break dropped (repeat, slice never terminates)', 'repeat { g <- 5; if(TRUE) break }\nprint(g)'],
	['return in tryCatch handler escapes the caller', 'f <- function() { tryCatch(stop("a"), error = function(e) return(1)); 2 }\nprint(f())'],
	['second eval of the same quote', 'w <- 1\ne <- quote(w <- w + 1)\neval(e)\neval(e)\nprint(w)'],
	['eval of a global quote inside a function', 'e <- quote(w <<- w + 1)\nw <- 1\nf <- function() eval(e)\nf()\nf()\nprint(w)'],
	['eval of a quote in a loop', 'e <- quote(w <- w + 1)\nw <- 1\nfor(i in 1:3) eval(e)\nprint(w)'],
	['UseMethod reconstructed as its argument', 'gen <- function(x) UseMethod("gen")\ngen.default <- function(x) cnt <<- 1\ngen(1)\nprint(cnt)'],
	['S3 method redefined after the call', 'gen <- function(x) UseMethod("gen")\ngen.a <- function(x) "1"\nr <- gen(structure(1, class = "a"))\ngen.a <- function(x) "2"\nprint(r)'],
	['user method of a built-in generic', 'summary.zz <- function(object, ...) { cnt <<- 1; 0 }\nsummary(structure(1, class = "zz"))\nprint(cnt)'],
	['user format method with prior value', 'cnt <- 0\nformat.zz <- function(x, ...) { cnt <<- cnt + 1; "zz" }\nformat(structure(1, class = "zz"))\nprint(cnt)'],
	['closure from local', 'counter <- local({ i <- 0; function() { i <<- i + 1; i } })\ncounter()\nprint(counter())'],
	['closures in a list called in a for loop', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nL <- list(mk())\nfor(f in L) f()\nprint(L[[1]]())'],
	['closures in a list called via lapply', 'mk <- function() { n <- 0; function() { n <<- n + 1; n } }\nL <- list(mk())\ninvisible(lapply(L, function(g) g()))\nprint(L[[1]]())'],
	['with calls a closure of the environment', 'o <- local({ n <- 0; inc <- function() n <<- 1; environment() })\nwith(o, inc())\nprint(o$n)'],
	['with calls a built-in only', 'o <- local({ n <- 0; environment() })\nwith(o, sum(1))\nprint(o$n)', 'with'],
	['active binding setter', 'v <- 0\nmakeActiveBinding("ab", function(val) v <<- val, environment())\nab <- 4\nprint(v)'],
	['assignment to another name than the active binding', 'v <- 0\nmakeActiveBinding("ab", function(val) v <<- val, environment())\ncd <- 4\nprint(v)', 'cd <- 4'],
	['assign into sys.frame(-1)', 'f <- function() { v <- 1; g <- function() assign("v", 2, envir = sys.frame(-1)); g(); v }\nprint(f())'],
	['assign into the own frame leaves the global one', 'v <- 1\nf <- function() { v <- 5; assign("v", 2, envir = environment()); v }\nx <- f()\nprint(v)', 'x <-'],
	['delayedAssign writes a variable when forced', 'delayedAssign("p", {x <<- 2})\nx <- 1\np\nprint(x)'],
	['delayedAssign forces a closure writing a variable', 'f <- function() { x <<- 2; 0 }\ndelayedAssign("p", f())\nx <- 1\np\nprint(x)'],
	['delayedAssign forces a closure writing another variable', 'f <- function() { y <<- 2; 0 }\ndelayedAssign("p", f())\nx <- 1\np\nprint(x)', 'delayedAssign'],
	['closure returned by sys.function called within a function', 'make_hook <- function() {\n  calls <- 0\n  hook <- function() { calls <<- calls + 1; sys.function() }\n  hook\n}\nh <- make_hook()\nrun <- function() { h2 <- h(); h2(); 0 }\nrun()\nprint(environment(h)$calls)'],
	['closure returned by a call of a factory result within a function', 'n <- 0\nmk <- function() { f <- function() { n <<- n + 1; sys.function() }; f }\nrun <- function() { g <- mk()(); g() }\nrun()\nprint(n)'],
	['closure returned within a function but not called', 'n <- 0\nmk <- function() { f <- function() { n <<- n + 1; sys.function() }; f }\nrun <- function() { g <- mk()(); 0 }\nrun()\nprint(n)', 'g <-'],
];

describe('Counterexample round: slicing', () => {
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
		}, 60000);
	}
});
