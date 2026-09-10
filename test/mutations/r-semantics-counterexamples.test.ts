import fs from 'fs';
import path from 'path';
import { describe, test, assert } from 'vitest';
import { withShell } from '../functionality/_helper/shell';
import { decorateLabelContext, label } from '../functionality/_helper/label';
import type { RShell } from '../../src/r-bridge/shell';
import type { FlowrCapabilityId } from '../../src/r-bridge/data/get';
import type { MutationTarget } from '../functionality/_helper/r-mutations';
import { MutationPasses, mutate, observeQueries, passIsAvailable, slice } from '../functionality/_helper/r-mutations';

interface Counterexample extends MutationTarget {
	readonly name:         string;
	readonly capabilities: readonly FlowrCapabilityId[];
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
		const lines = await shell.sendCommandWithOutput(guarded, { automaticallyTrimOutput: true });
		await shell.sendCommandWithOutput('rm(list = setdiff(ls(all.names = TRUE), "flowr_get_ast"))');
		return lines.join('\n');
	}
	async function check(target: MutationTarget): Promise<void> {
		const what = `the program sliced for ${target.criterion} is:\n${target.code}`;
		const sliced = await slice(shell, target);
		assert.strictEqual(await run(target.code), target.expected, `the input does not print what this test claims it does, ${what}`);
		const output = await run(sliced);
		const slicedIs = `${what}\nand its slice is:\n${sliced}`;
		assert.notMatch(sliced, /\bmut_[abc]\b/, `the slice keeps a binding nothing reads, ${slicedIs}`);
		assert.strictEqual(output, target.expected, `the slice does not print what the input does, ${slicedIs}`);
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
						await check(mutant);
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
