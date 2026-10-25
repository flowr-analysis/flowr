import fs from 'fs';
import path from 'path';
import { describe, test, assert } from 'vitest';
import { withShell } from '../functionality/_helper/shell';
import { decorateLabelContext, label } from '../functionality/_helper/label';
import type { RShell } from '../../src/r-bridge/shell';
import type { FlowrCapabilityId } from '../../src/r-bridge/data/get';
import type { MutationTarget } from '../functionality/_helper/r-mutations';
import { MutationPasses, mutate, observeQueries, passIsAvailable, removalSlice, slice } from '../functionality/_helper/r-mutations';

interface Counterexample extends MutationTarget {
	readonly name:         string;
	readonly capabilities: readonly FlowrCapabilityId[];
	/** code the slice must leave out wherever the (mutated) program still contains it, so a mutant also keeps the slice precise */
	readonly lacks?:       readonly string[];
}

const generatedMutants = new Set<string>();
const attemptedMutants = new Set<string>();
const usedPasses = new Set<string>();
const knownGroups = new Set<string>();
const knownTargets = new Set<string>();
const knownCapabilities = new Set<string>();

const MutationDetailsFile = 'coverage/flowr-mutation-details.json';

function counterexamples(shell: RShell, group: string, cases: readonly Counterexample[]): void {
	knownGroups.add(group);
	for(const { name, capabilities } of cases) {
		knownTargets.add(`${group}: ${name}`);
		for(const capability of capabilities) {
			knownCapabilities.add(capability);
		}
	}
	async function run(what: string): Promise<string> {
		const guarded = `tryCatch(eval(parse(text = ${JSON.stringify(what)})), error = function(e) cat("R error:", conditionMessage(e), "\n"))`;
		await shell.sendCommandWithOutput('flowr_wd <- getwd(); flowr_op <- options()');
		const lines = await shell.sendCommandWithOutput(guarded, { automaticallyTrimOutput: true });
		/* a program may change the working directory, which the next one must not see */
		await shell.sendCommandWithOutput('setwd(flowr_wd); options(flowr_op); graphics.off(); rm(list = setdiff(ls(all.names = TRUE), "flowr_get_ast"))');
		return lines.join('\n');
	}
	async function check(target: Counterexample): Promise<void> {
		const what = `the program sliced for ${target.criterion} is:\n${target.code}`;
		const sliced = await slice(shell, target);
		assert.strictEqual(await run(target.code), target.expected, `the input does not print what this test claims it does, ${what}`);
		const output = await run(sliced);
		const slicedIs = `${what}\nand its slice is:\n${sliced}`;
		assert.notMatch(sliced, /\bmut_[abc]\b/, `the slice keeps a binding nothing reads, ${slicedIs}`);
		assert.strictEqual(output, target.expected, `the slice does not print what the input does, ${slicedIs}`);
		/* removing what only the criterion needs leaves a program that still runs */
		const left = await removalSlice(shell, target);
		assert.notMatch(await run(left), /R error:/, `what the removal slice leaves fails, ${slicedIs}\nand what is left without it is:\n${left}`);
		for(const lacked of target.lacks ?? []) {
			if(target.code.includes(lacked)) {
				assert.notInclude(sliced, lacked, `the slice keeps what it does not need, ${slicedIs}`);
			}
		}
	}
	describe(group, () => {
		for(const counterexample of cases) {
			const { name, capabilities, code } = counterexample;
			test(`${decorateLabelContext(label(name, capabilities), ['slice', 'output'])} (input: ${JSON.stringify(code)})`, () => check(counterexample));
		}
		for(const pass of MutationPasses) {
			describe(pass.name, () => {
				for(const counterexample of cases) {
					const id = `${group}: ${counterexample.name} [${pass.name}]`;
					test(counterexample.name, async(ctx) => {
						attemptedMutants.add(id);
						const mutant = await mutate(shell, counterexample, pass);
						if(mutant === undefined) {
							ctx.skip();
							return;
						}
						generatedMutants.add(id);
						usedPasses.add(pass.name);
						await check(mutant as Counterexample);
						assert.deepStrictEqual(await observeQueries(shell, mutant.code), await observeQueries(shell, counterexample.code),
							`the mutation changes what the queries report about the program, it is:\n${mutant.code}`);
					});
				}
			});
		}
	});
}

describe('Counterexamples against R semantics', { concurrent: false }, withShell(shell => {
	counterexamples(shell, 'Functions stored in containers', [
		{ name: 'call a function held in a list', capabilities: ['dollar-access', 'call-anonymous', 'normal-definition'], code: 'fs <- list(f = function(x) x * 3)\nr <- fs$f(2)\nprint(r)', criterion: '3@r', expected: '[1] 6' },
		{ name: 'call a function held two levels deep', capabilities: ['dollar-access', 'call-anonymous'], code: 'o <- list(inner = list(f = function() 11))\nr <- o$inner$f()\nprint(r)', criterion: '3@r', expected: '[1] 11' },
		{ name: 'argument of a call through $', capabilities: ['dollar-access', 'unnamed-arguments'], code: 'o <- list(f = function(x) x * 2)\nk <- 4\nr <- o$f(k)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'closure in a list sees the later binding', capabilities: ['dollar-access', 'closures'], code: 'k <- 5\nfs <- list(f = function() k)\nk <- 9\nr <- fs$f()\nprint(r)', criterion: '5@r', expected: '[1] 9' },
		{ name: 'two functions assigned through $', capabilities: ['dollar-access', 'replacement-functions'], code: 'o <- list()\no$f <- function() 8\no$g <- function() 9\nr <- o$f() + o$g()\nprint(r)', criterion: '5@r', expected: '[1] 17' },
		{ name: 'function assigned to a list index keeps its body', capabilities: ['double-bracket-access', 'replacement-functions'], code: 'fs <- list()\nfs[[1]] <- function(x) x + 5\nr <- fs[[1]](1)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'functions collected in a loop', capabilities: ['double-bracket-access', 'for-loop', 'closures'], code: 'fs <- list()\nfor(i in 1:2) fs[[i]] <- function() i * 10\nr <- fs[[1]]()\nprint(r)', criterion: '4@r', expected: '[1] 20' },
		{ name: 'function collected by super-assignment from local', capabilities: ['super-left-assignment', 'closures'], code: 'fs <- list()\nfor(i in 1:3) { local({ j <- i; fs[[j]] <<- function() j }) }\nr <- fs[[1]]()\nprint(r)', criterion: '4@r', expected: '[1] 1' },
		{ name: 'closure of a function in a list literal', capabilities: ['double-bracket-access', 'closures'], code: 'k <- 5\nfs <- list(function(x) x + k)\nr <- fs[[1]](1)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'object built from closures over a counter', capabilities: ['dollar-access', 'super-left-assignment', 'closures'], code: 'mk <- function() { cnt <- 0; list(inc = function() cnt <<- cnt + 1, get = function() cnt) }\no <- mk()\no$inc(); o$inc()\nr <- o$get()\nprint(r)', criterion: '5@r', expected: '[1] 2' },
		{ name: 'reference class method mutates its field', capabilities: ['oop-rc', 'dollar-access'], code: 'G <- setRefClass("G2", fields = list(n = "numeric"), methods = list(bump = function() { n <<- n + 1 }))\no <- G$new(n = 1)\no$bump()\nr <- o$n\nprint(r)', criterion: '5@r', expected: '[1] 2' },
	]);

	counterexamples(shell, 'Functions as values', [
		{ name: 'a function read as a value keeps its body', capabilities: ['normal-definition', 'get-function-structure'], code: 'f <- function() { x <- 1; x + 1 }\nr <- length(deparse(f))\nprint(r)', criterion: '3@r', expected: '[1] 5' },
		{ name: 'a function wrapped by Negate is called through the wrapper', capabilities: ['closures', 'normal-definition'], code: 'thr <- 3\nsmall <- function(x) x < thr\nr <- Filter(Negate(small), 1:5)\nprint(r)', criterion: '4@r', expected: '[1] 3 4 5' },
		{ name: 'a function wrapped by Vectorize is called through the wrapper', capabilities: ['closures', 'normal-definition'], code: 'base <- 5\nf <- function(x) x + base\nr <- sapply(1:2, Vectorize(f))\nprint(r)', criterion: '4@r', expected: '[1] 6 7' },
		{ name: 'functions stored in a list keep their free names', capabilities: ['closures', 'call-anonymous'], code: 'k <- 10\nfs <- list(a = function(x) x + k, b = function(x) x * k)\nr <- unname(sapply(fs, function(f) f(2)))\nprint(r)', criterion: '4@r', expected: '[1] 12 20' },
	]);

	counterexamples(shell, 'Closures', [
		{ name: 'a sibling closure sees a write made through <<-', capabilities: ['closure-capture', 'dollar-access'], code: 'make <- function() {\n  x <- 1\n  list(get = function() x, set = function(v) x <<- v)\n}\no <- make()\no$set(5)\nr <- o$get()\nprint(r)', criterion: '8@r', expected: '[1] 5' },
		{ name: 'two instances of the same factory still print correctly', capabilities: ['closures'], code: 'counter <- function() {\n  i <- 0\n  function() {\n    i <<- i + 1\n    i\n  }\n}\nc1 <- counter()\nc2 <- counter()\nc1()\nc1()\nr <- c2()\nprint(r)', criterion: '13@r', expected: '[1] 1' },
	]);

	counterexamples(shell, 'Pure built-ins', [
		{ name: 'setNames leaves its argument alone', capabilities: ['normal-definition'], code: 'df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- setNames(df1, c("A", "B"))\nprint(names(df1))', criterion: '3@print', expected: '[1] "id"   "name"' },
	]);

	counterexamples(shell, 'Reflection', [
		{ name: 'a body written in reads what it names', capabilities: ['modify-function-structure', 'built-in-quoting'], code: 'k <- 7\nf <- function() 0\nbody(f) <- quote(k)\nr <- f()\nprint(r)', criterion: '5@r', expected: '[1] 7' },
		{ name: 'a nested replacement of the formals reaches the call', capabilities: ['modify-function-structure', 'replacement-functions'], code: 'f <- function(x) x + 1\nformals(f)$x <- 10\nr <- f()\nprint(r)', criterion: '4@r', expected: '[1] 11' },
		{ name: 'a nested replacement of the body reaches the call', capabilities: ['modify-function-structure', 'replacement-functions'], code: 'f <- function() list(a = 1)\nbody(f)$a <- 5\nr <- f()$a\nprint(r)', criterion: '4@r', expected: '[1] 5' },
	]);

	counterexamples(shell, 'Names computed at run time', [
		{ name: 'get with the name in a variable', capabilities: ['name-created-resolved', 'built-in-evaluation'], code: 'nm <- "vv"\nvv <- 8\nr <- get(nm)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'get0 with the name in a variable', capabilities: ['name-created', 'name-created-resolved', 'built-in-evaluation'], code: 'nm <- "vv"\nvv <- 8\nr <- get0(nm)\nprint(r)', criterion: '4@r', expected: '[1] 8' },
		{ name: 'match.fun with the name in a variable', capabilities: ['name-created-resolved', 'built-in-evaluation'], code: 's <- "sum"\nf <- match.fun(s)\nr <- f(1:4)\nprint(r)', criterion: '4@r', expected: '[1] 10' },
		{ name: 'get with a name pasted from a number', capabilities: ['name-created-resolved', 'string-templates'], code: 'i <- 1\nv1 <- 5\nr <- get(paste0("v", i))\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		{ name: 'get0 with a name pasted from a number', capabilities: ['name-created', 'name-created-resolved', 'string-templates'], code: 'i <- 1\nv1 <- 5\nr <- get0(paste0("v", i))\nprint(r)', criterion: '4@r', expected: '[1] 5' },
		{ name: 'mget reads every name it is given', capabilities: ['name-created-resolved', 'built-in-evaluation'], code: 'a <- 1\nb <- 2\nr <- sum(unlist(mget(c("a","b"))))\nprint(r)', criterion: '4@r', expected: '[1] 3' },
		{ name: 'exists depends on the binding it asks about', capabilities: ['name-created-resolved', 'search-type'], code: 'nm <- "zzz"\nzzz <- 1\nr <- exists(nm)\nprint(r)', criterion: '4@r', expected: '[1] TRUE' },
		{ name: 'eval of a symbol built from a string', capabilities: ['built-in-evaluation', 'name-created-resolved'], code: 'nm <- "qq"\nqq <- 6\nr <- eval(as.name(nm))\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'rm unshadows the built-in again', capabilities: ['dynamic-variable-removal', 'redefinition-of-built-in-functions-primitives'], code: 'sum <- function(x) 1\nr1 <- sum(1:3)\nrm(sum)\nr <- r1 + sum(1:3)\nprint(r)', criterion: '5@r', expected: '[1] 7' },
	]);

	counterexamples(shell, 'Environments', [
		{ name: 'field written through $ on an environment', capabilities: ['environment-sharing', 'dollar-access'], code: 'e <- new.env()\ne$a <- 1\nr <- e$a\nprint(r)', criterion: '4@r', expected: '[1] 1' },
		{ name: 'function written through $ on an environment', capabilities: ['environment-sharing', 'dollar-access'], code: 'e <- new.env()\ne$f <- function() 15\nr <- e$f()\nprint(r)', criterion: '4@r', expected: '[1] 15' },
		{ name: 'a closure inside a function keeps what it captures', capabilities: ['closures', 'super-left-assignment', 'exceptions-and-errors'], code: 'tally <- 0\nsafe <- function(f) tryCatch(f(), error = function(e) { tally <<- tally + 1; NA })\nignore <- safe(function() stop(\'x\'))\nprint(tally)', criterion: '4@print', expected: '[1] 1' },
		{ name: 'field of an environment read inside a function', capabilities: ['environment-sharing', 'closures'], code: 'e <- new.env()\ne$a <- function() 1\ne$b <- function() e$a() + 1\nr <- e$b()\nprint(r)', criterion: '5@r', expected: '[1] 2' },
		{ name: 'environment modified by a callee', capabilities: ['environment-sharing', 'functions-with-global-side-effects'], code: 'e <- new.env()\ne$a <- 1\nf <- function(en) en$a <- 42\nf(e)\nr <- e$a\nprint(r)', criterion: '6@r', expected: '[1] 42' },
		{ name: 'ls sees what was assigned into the environment', capabilities: ['environment-sharing', 'search-path'], code: 'e <- new.env()\nassign("x1", 1, envir = e)\nr <- length(ls(e))\nprint(r)', criterion: '4@r', expected: '[1] 1' },
		{ name: 'environment<- decides where the body looks up', capabilities: ['environment-sharing', 'modify-function-structure'], code: 'f <- function() x\ne <- new.env()\nassign("x", 77, envir = e)\nenvironment(f) <- e\nr <- f()\nprint(r)', criterion: '6@r', expected: '[1] 77' },
		{ name: 'writing into a closure environment', capabilities: ['environment-sharing', 'closures'], code: 'f <- function() { y <- 3; function() y }\ng <- f()\nenvironment(g)$y <- 10\nr <- g()\nprint(r)', criterion: '5@r', expected: '[1] 10' },
		{ name: 'list2env defines each element as a binding', capabilities: ['environment-sharing', 'dynamic-environment-resolution'], code: 'l <- list(p = 3, q = 4)\ninvisible(list2env(l, envir = environment()))\nr <- p + q\nprint(r)', criterion: '4@r', expected: '[1] 7' },
		{ name: 'makeActiveBinding creates a binding', capabilities: ['environment-sharing', 'closures'], code: 'v <- 13\nmakeActiveBinding("ab", function() v, environment())\nr <- ab\nprint(r)', criterion: '4@r', expected: '[1] 13' },
		{ name: 'reading an active binding runs its function', capabilities: ['environment-sharing', 'closures', 'super-left-assignment'], code: 'n <- 0\nmakeActiveBinding("tick", function() { n <<- n + 1; n }, environment())\ntick\ntick\nprint(n)', criterion: '5@n', expected: '[1] 2' },
		{ name: 'parent.frame()$x reads the caller\'s variable', capabilities: ['parent-frame', 'dollar-access'], code: 'f <- function() { g <- function() parent.frame()$z; z <- 4; g() }\nr <- f()\nprint(r)', criterion: '3@r', expected: '[1] 4' },
		{ name: 'eval.parent assigns in the caller', capabilities: ['built-in-evaluation', 'parent-frame'], code: 'f <- function() eval.parent(quote(pp <- 3))\nf()\nr <- pp\nprint(r)', criterion: '4@r', expected: '[1] 3' },
	]);

	counterexamples(shell, 'Side effects of a function handed to another', [
		{ name: 'sapply over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(sapply(1:3, function(i) s <<- s + i))\nprint(s)', criterion: '3@s', expected: '[1] 6' },
		{ name: 'lapply over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 'acc <- c()\ninvisible(lapply(1:3, function(i) acc <<- c(acc, i)))\nr <- sum(acc)\nprint(r)', criterion: '4@r', expected: '[1] 6' },
		{ name: 'mapply over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 'tot <- 0\ninvisible(mapply(function(a,b) tot <<- tot + a*b, 1:2, 3:4))\nprint(tot)', criterion: '3@tot', expected: '[1] 11' },
		{ name: 'Map over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(Map(function(i) s <<- s + i, 1:3))\nprint(s)', criterion: '3@s', expected: '[1] 6' },
		{ name: 'Reduce over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(Reduce(function(a, b) { s <<- s + b; a + b }, 1:3))\nprint(s)', criterion: '3@s', expected: '[1] 5' },
		{ name: 'Filter over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(Filter(function(i) { s <<- s + i; TRUE }, 1:3))\nprint(s)', criterion: '3@s', expected: '[1] 6' },
		{ name: 'do.call over a closure that super-assigns', capabilities: ['super-left-assignment', 'side-effects-in-argument'], code: 's <- 0\ninvisible(do.call(function(a) s <<- a, list(7)))\nprint(s)', criterion: '3@s', expected: '[1] 7' },
	]);

	counterexamples(shell, 'Condition handling', [
		{ name: 'the error handler wins over the aborted body', capabilities: ['exceptions-and-errors', 'super-left-assignment'], code: 'v <- 0\ntryCatch({ v <- 1; stop("x") }, error = function(e) v <<- 2)\nprint(v)', criterion: '3@v', expected: '[1] 2' },
		{ name: 'finally runs after the handler', capabilities: ['exceptions-and-errors'], code: 'v <- 0\ninvisible(tryCatch({ stop("x") }, error = function(e) NULL, finally = { v <- 3 }))\nprint(v)', criterion: '3@v', expected: '[1] 3' },
		{ name: 'a calling handler writes to its enclosing scope', capabilities: ['exceptions-and-errors', 'super-left-assignment'], code: 'v <- 0\nwithCallingHandlers(warning("w"), warning = function(w) { v <<- 5; invokeRestart("muffleWarning") })\nprint(v)', criterion: '3@v', expected: '[1] 5' },
	]);

	counterexamples(shell, 'Lazy evaluation', [
		{ name: 'a promise is forced after the body assigned', capabilities: ['formals-promises', 'super-left-assignment'], code: 'f <- function(a) { x <<- 99; a }\nx <- 1\nr <- f(x)\nprint(r)', criterion: '4@r', expected: '[1] 99' },
		{ name: 'a default argument sees the reassigned parameter', capabilities: ['formals-default', 'formals-promises'], code: 'f <- function(a, b = a * 2) { a <- 10; b }\nr <- f(3)\nprint(r)', criterion: '3@r', expected: '[1] 20' },
	]);

	counterexamples(shell, 'Loops', [
		{ name: 'while(TRUE) stops at its break', capabilities: ['while-loop', 'break'], code: 'i <- 0\nwhile(TRUE) { i <- i + 1; if(i >= 3) break }\nprint(i)', criterion: '3@print', expected: '[1] 3' }
	]);

	counterexamples(shell, 'Communication through files', [
		{ name: 'cat writes what readLines reads back', capabilities: ['i-o'], code: 'f <- tempfile()\ncat("hi\\n", file = f)\nr <- readLines(f)\nprint(r)', criterion: '4@r', expected: '[1] "hi"' },
		{ name: 'what is read back was written before', capabilities: ['i-o'], code: 'f <- tempfile()\nwriteLines("hi", f)\nr <- readLines(f)\nprint(r)', criterion: '4@r', expected: '[1] "hi"' },
		{ name: 'readRDS depends on the matching saveRDS', capabilities: ['i-o', 'handling-binary-riles'], code: 'f <- tempfile()\nsaveRDS(11, f)\nr <- readRDS(f)\nprint(r)', criterion: '4@r', expected: '[1] 11' },
	]);

	counterexamples(shell, 'Files named in the working directory', [
		{ name: 'a read of one file does not keep a plot written to another', capabilities: ['i-o', 'graphics-state', 'working-directory'], code: 'setwd(tempdir())\nwriteLines("1", "b.txt")\npdf("a.pdf")\nplot(1)\ninvisible(dev.off())\nr <- readLines("b.txt")\nprint(r)', criterion: '7@r', expected: '[1] "1"', lacks: ['pdf(', 'plot(', 'dev.off('] },
		{ name: 'the file a device writes keeps the device', capabilities: ['i-o', 'graphics-state', 'working-directory'], code: 'setwd(tempdir())\nunlink("p.pdf")\npdf("p.pdf")\nplot(1)\ninvisible(dev.off())\nr <- file.exists("p.pdf")\nprint(r)', criterion: '7@r', expected: '[1] TRUE' },
		{ name: 'a device closed in a function writes its file', capabilities: ['i-o', 'graphics-state', 'normal-definition'], code: 'setwd(tempdir())\nunlink("c.pdf")\nclose_dev <- function() invisible(dev.off())\npdf("c.pdf")\nplot(1:3)\nclose_dev()\nr <- file.exists("c.pdf")\nprint(r)', criterion: '8@r', expected: '[1] TRUE' },
		{ name: 'a percent sign in a file name is no pattern', capabilities: ['i-o', 'strings'], code: 'setwd(tempdir())\nwriteLines("x", "o.txt")\nwriteLines("7", "a_%_b.txt")\nr <- readLines("a_%_b.txt")\nprint(r)', criterion: '5@r', expected: '[1] "7"', lacks: ['"o.txt"'] },
		{ name: 'a write to another file is not kept', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "m.txt")\nwriteLines("2", "n.txt")\nr <- readLines("m.txt")\nprint(r)', criterion: '5@r', expected: '[1] "1"', lacks: ['"n.txt"'] },
		{ name: 'a write after the read is not kept', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "q.txt")\nr <- readLines("q.txt")\nwriteLines("2", "q.txt")\nprint(r)', criterion: '5@r', expected: '[1] "1"', lacks: ['"2"'] },
		{ name: 'an overwrite hides the earlier write', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "ow.txt")\nwriteLines("2", "ow.txt")\nr <- readLines("ow.txt")\nprint(r)', criterion: '5@r', expected: '[1] "2"' },
		{ name: 'an append keeps the earlier write', capabilities: ['i-o', 'named-arguments'], code: 'setwd(tempdir())\ncat("a\\n", file = "ap.txt")\ncat("b\\n", file = "ap.txt", append = TRUE)\nr <- length(readLines("ap.txt"))\nprint(r)', criterion: '5@r', expected: '[1] 2' },
		{ name: 'a file name held in a variable', capabilities: ['i-o', 'named-arguments'], code: 'setwd(tempdir())\nnm <- "z.csv"\nwrite.csv(data.frame(a = 4), nm, row.names = FALSE)\nr <- read.csv(nm)$a\nprint(r)', criterion: '5@r', expected: '[1] 4' },
		{ name: 'file names computed in a loop', capabilities: ['i-o', 'for-loop', 'string-templates'], code: 'setwd(tempdir())\nfor(i in 1:2) writeLines(as.character(i), paste0("o", i, ".txt"))\nr <- readLines("o2.txt")\nprint(r)', criterion: '4@r', expected: '[1] "2"' },
		{ name: 'saveRDS to another file is not kept', capabilities: ['i-o', 'handling-binary-riles'], code: 'setwd(tempdir())\nsaveRDS(1, "s1.rds")\nsaveRDS(2, "s2.rds")\nr <- readRDS("s2.rds")\nprint(r)', criterion: '5@r', expected: '[1] 2', lacks: ['"s1.rds"'] },
		{ name: 'a write in a called function reaches the read', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nf <- function(p) writeLines("9", p)\nf("w.txt")\nr <- readLines("w.txt")\nprint(r)', criterion: '5@r', expected: '[1] "9"' },
		{ name: 'each call of a helper writes the file it names', capabilities: ['i-o', 'normal-definition', 'string-templates'], code: 'setwd(tempdir())\nsave_it <- function(n, v) writeLines(v, paste0(n, ".txt"))\nsave_it("pa", "1")\nsave_it("pb", "2")\nr <- readLines("pa.txt")\nprint(r)', criterion: '6@r', expected: '[1] "1"', lacks: ['"pb"'] },
		{ name: 'a helper called again overwrites its file', capabilities: ['i-o', 'normal-definition', 'string-templates'], code: 'setwd(tempdir())\nsave_it <- function(n, v) writeLines(v, paste0(n, ".txt"))\nsave_it("po", "1")\nsave_it("po", "2")\nr <- readLines("po.txt")\nprint(r)', criterion: '6@r', expected: '[1] "2"' },
		{ name: 'a default names the file of a call leaving it out', capabilities: ['i-o', 'normal-definition', 'formals-default'], code: 'setwd(tempdir())\nsave_it <- function(v, n = "pd") writeLines(v, paste0(n, ".txt"))\nsave_it("1")\nsave_it("2", "pe")\nr <- readLines("pd.txt")\nprint(r)', criterion: '6@r', expected: '[1] "1"', lacks: ['"pe"'] },
		{ name: 'a helper writing a file in its body before returning', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nsave_it <- function(p, v) { writeLines(v, p); invisible(nchar(p)) }\nsave_it("pq.txt", "4")\nsave_it("pr.txt", "5")\nr <- readLines("pq.txt")\nprint(r)', criterion: '6@r', expected: '[1] "4"', lacks: ['"pr.txt"'] },
		{ name: 'a helper calling a helper writes the file named at the outer call', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nw <- function(p, v) writeLines(v, p)\ng <- function(p) w(p, toupper(p))\ng("pu.txt")\ng("pv.txt")\nr <- readLines("pu.txt")\nprint(r)', criterion: '7@r', expected: '[1] "PU.TXT"', lacks: ['"pv.txt"'] },
		{ name: 'a read of a file not known keeps every call of the helper', capabilities: ['i-o', 'normal-definition'], code: 'setwd(tempdir())\nsave_it <- function(p, v) writeLines(v, p)\nsave_it("ps.txt", "6")\nsave_it("pt.txt", "6")\nr <- readLines(c("ps.txt", "pt.txt")[nchar("ab")])\nprint(r)', criterion: '6@r', expected: '[1] "6"' },
		{ name: 'a helper piped into writes the file piped in', capabilities: ['i-o', 'normal-definition', 'pipe-and-pipe-bind'], code: 'setwd(tempdir())\nsave_to <- function(p) writeLines("3", p)\n"pp.txt" |> save_to()\nr <- readLines("pp.txt")\nprint(r)', criterion: '5@r', expected: '[1] "3"' },
		{ name: 'unlink removes the file file.exists asks about', capabilities: ['i-o'], code: 'setwd(tempdir())\nwriteLines("1", "u.txt")\nunlink("u.txt")\nr <- file.exists("u.txt")\nprint(r)', criterion: '5@r', expected: '[1] FALSE' },
		{ name: 'file.copy reads what was written to its source', capabilities: ['i-o', 'named-arguments'], code: 'setwd(tempdir())\nwriteLines("c", "src.txt")\ninvisible(file.copy("src.txt", "dst.txt", overwrite = TRUE))\nr <- readLines("dst.txt")\nprint(r)', criterion: '5@r', expected: '[1] "c"' },
		{ name: 'what a sink captures is read back', capabilities: ['i-o'], code: 'setwd(tempdir())\nsink("sk.txt")\nprint(3)\nsink()\nr <- readLines("sk.txt")\nprint(r)', criterion: '6@r', expected: '[1] "[1] 3"' },
		{ name: 'a path below the working directory', capabilities: ['i-o', 'working-directory'], code: 'setwd(tempdir())\ndir.create("pd", showWarnings = FALSE)\nwriteLines("8", "pd/x.txt")\nwriteLines("9", "pd/y.txt")\nr <- readLines("pd/x.txt")\nprint(r)', criterion: '6@r', expected: '[1] "8"', lacks: ['"9"'] },
		{ name: 'the same name in two directories', capabilities: ['i-o', 'working-directory'], code: 'd <- file.path(tempdir(), "sub")\ndir.create(d, showWarnings = FALSE)\nsetwd(tempdir())\nwriteLines("top", "v.txt")\nwriteLines("sub", file.path(d, "v.txt"))\nsetwd(d)\nr <- readLines("v.txt")\nprint(r)', criterion: '8@r', expected: '[1] "sub"' }
	]);

	counterexamples(shell, 'The working directory', [
		{ name: 'a relative read depends on the directory set before', capabilities: ['working-directory', 'i-o'], code: 'd <- file.path(tempdir(), "wd1")\ndir.create(d, showWarnings = FALSE)\nwriteLines("5", file.path(d, "v.txt"))\nsetwd(d)\nr <- readLines("v.txt")\nprint(r)', criterion: '6@r', expected: '[1] "5"' },
		{ name: 'a value does not depend on the directory', capabilities: ['working-directory'], code: 'setwd(tempdir())\nx <- 3\nsetwd(tempdir())\nprint(x)', criterion: '4@x', expected: '[1] 3', lacks: ['setwd('] },
		{ name: 'getwd reads what setwd set', capabilities: ['working-directory'], code: 'setwd(tempdir())\nr <- basename(getwd()) == basename(tempdir())\nprint(r)', criterion: '3@r', expected: '[1] TRUE' },
		{ name: 'setwd returns the directory before', capabilities: ['working-directory'], code: 'setwd(tempdir())\nold <- setwd(dirname(tempdir()))\nr <- basename(old) == basename(tempdir())\nprint(r)', criterion: '4@r', expected: '[1] TRUE' },
		{ name: 'a directory changed in a function', capabilities: ['working-directory', 'normal-definition', 'i-o'], code: 'd <- file.path(tempdir(), "wd2")\ndir.create(d, showWarnings = FALSE)\nwriteLines("6", file.path(d, "v.txt"))\ngo <- function() setwd(d)\ngo()\nr <- readLines("v.txt")\nprint(r)', criterion: '7@r', expected: '[1] "6"' }
	]);

	counterexamples(shell, 'Values beside ambient state', [
		{ name: 'a value does not depend on files, devices or the generator', capabilities: ['i-o', 'graphics-state'], code: 'setwd(tempdir())\nwriteLines("1", "k.txt")\nset.seed(1)\nu <- runif(1)\npdf("k.pdf")\nplot(u)\ninvisible(dev.off())\nv <- rep(c("a", "b"), 2)\nprint(v)', criterion: '9@v', expected: '[1] "a" "b" "a" "b"', lacks: ['writeLines', 'set.seed', 'runif', 'pdf(', 'plot(', 'dev.off', 'setwd('] },
		{ name: 'a package loaded before does not make rep opaque', capabilities: ['library-loading'], code: 'library(dplyr, warn.conflicts = FALSE)\nset.seed(2)\nu <- runif(1)\nv <- rep(1, 3)\nprint(v)', criterion: '5@v', expected: '[1] 1 1 1', lacks: ['set.seed', 'runif'] },
		{ name: 'a draw depends on the seed set before', capabilities: ['functions-with-global-side-effects'], code: 'set.seed(1)\na <- runif(1)\nb <- round(runif(1), 4)\nprint(b)', criterion: '4@b', expected: '[1] 0.3721' },
		{ name: 'printing reads the digits option', capabilities: ['built-in-options'], code: 'options(digits = 3)\nx <- pi\nprint(x)', criterion: '3@print', expected: '[1] 3.14' },
		{ name: 'an option restored is not set anymore', capabilities: ['built-in-options'], code: 'op <- options(digits = 3)\noptions(op)\nx <- pi\nprint(x)', criterion: '4@print', expected: '[1] 3.141593' },
		{ name: 'an environment variable set is read back', capabilities: ['functions-with-global-side-effects'], code: 'Sys.setenv(MUT_X = "7")\nr <- Sys.getenv("MUT_X")\nprint(r)', criterion: '3@r', expected: '[1] "7"' },
		{ name: 'par set before is what par reports', capabilities: ['graphics-state'], code: 'pdf(NULL)\npar(mfrow = c(1, 2))\nr <- par("mfrow")\ninvisible(dev.off())\nprint(r)', criterion: '5@r', expected: '[1] 1 2' }
	]);

	counterexamples(shell, 'Model formulae', [
		{ name: 'a formula reads the names it binds', capabilities: ['model-formula'], code: 'y <- c(1, 2, 4)\nx <- c(1, 2, 3)\nm <- coef(lm(y ~ x))[[2]]\nprint(m)', criterion: '4@m', expected: '[1] 1.5' },
		{ name: 'a formula over the columns of data', capabilities: ['model-formula', 'named-arguments'], code: 'x <- 100\nd <- data.frame(x = 1:3, y = c(2, 4, 6))\nm <- coef(lm(y ~ x, data = d))[[2]]\nprint(m)', criterion: '4@m', expected: '[1] 2' },
		{ name: 'a boxplot over a formula keeps its names', capabilities: ['model-formula', 'graphics-state'], code: 'p <- c(1, 5, 3, 4)\ns <- factor(c("a", "a", "b", "b"))\nb <- boxplot(p ~ s, plot = FALSE)$n\nprint(b)', criterion: '4@b', expected: '[1] 2 2' }
	]);

	counterexamples(shell, 'Plots saved by ggplot2', [
		{ name: 'ggsave saves the last plot', capabilities: ['library-loading', 'graphics-state', 'i-o'], code: 'library(ggplot2)\nsetwd(tempdir())\nunlink("g.pdf")\nggplot(mtcars, aes(mpg, wt)) + geom_point()\nggsave("g.pdf", width = 2, height = 2)\nr <- file.exists("g.pdf")\nprint(r)', criterion: '7@r', expected: '[1] TRUE' },
		{ name: 'ggsave to another file is not kept', capabilities: ['library-loading', 'graphics-state', 'i-o'], code: 'library(ggplot2)\nsetwd(tempdir())\nwriteLines("1", "h.txt")\np <- ggplot(mtcars, aes(mpg, wt)) + geom_point()\nggsave("g2.pdf", p, width = 2, height = 2)\nr <- readLines("h.txt")\nprint(r)', criterion: '7@r', expected: '[1] "1"', lacks: ['ggsave', 'ggplot('] }
	]);

	describe('bookkeeping', () => {
		const partialRun = () => attemptedMutants.size < knownTargets.size * MutationPasses.length;
		test('every pass mutates at least one counterexample', ctx => {
			if(partialRun()) {
				ctx.skip();
				return;
			}
			const idle = MutationPasses.filter(passIsAvailable).map(p => p.name).filter(name => !usedPasses.has(name));
			assert.deepStrictEqual(idle, [], 'these passes never applied, so nothing they claim to check is checked');
		});
		test('record what this run exercised', ctx => {
			if(partialRun()) {
				ctx.skip();
				return;
			}
			assert.isAbove(generatedMutants.size, 0, 'nothing was mutated, so there is no run to record');
			fs.mkdirSync(path.dirname(MutationDetailsFile), { recursive: true });
			fs.writeFileSync(MutationDetailsFile, JSON.stringify({
				passes:          MutationPasses.length,
				groups:          knownGroups.size,
				counterexamples: knownTargets.size,
				capabilities:    knownCapabilities.size,
				mutants:         generatedMutants.size
			}));
		});
	});
}));
