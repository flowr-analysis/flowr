import { describe, test, assert } from 'vitest';
import { withShell } from '../../../_helper/shell';
import { decorateLabelContext, dropTestLabel, label, type TestLabel } from '../../../_helper/label';
import type { RShell } from '../../../../../src/r-bridge/shell';
import { createSlicePipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { deterministicCountingIdGenerator } from '../../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SlicingCriterion } from '../../../../../src/slicing/criterion/parse';

/**
 * Slices `code` for `criterion`, then runs the input and the reconstructed slice in R and requires both to print
 * `expected`. Checking what is printed rather than the shape of the slice is what makes these tests about R's
 * semantics: whatever the slice looks like, dropping something the criterion needs shows up here.
 *
 * Pass `unsound` for a case flowR is known to get wrong; the test then has to fail, so fixing the analysis
 * makes it fail loudly instead of going unnoticed.
 */
function assertSliceKeepsOutput(
	name: TestLabel,
	shell: RShell,
	code: string,
	criterion: SlicingCriterion,
	expected: string,
	unsound = false
): void {
	const testName = `${decorateLabelContext(name, ['slice', 'output'])} (input: ${JSON.stringify(code)})`;
	if(unsound) {
		dropTestLabel(name);
	}
	(unsound ? test.fails : test)(testName, async() => {
		const result = await createSlicePipeline(shell, {
			getId:     deterministicCountingIdGenerator(0),
			context:   contextFromInput(code),
			criterion: [criterion]
		}).allRemainingSteps();
		const reconstructed = result.reconstruct.code;
		const sliced = Array.isArray(reconstructed) ? reconstructed.join('\n') : reconstructed;

		assert.strictEqual(await run(code), expected, 'the input does not print what this test claims it does');
		assert.strictEqual(await run(sliced), expected, `the slice does not print what the input does, it is:\n${sliced}`);
	});

	/**
	 * HANDLE WITH UTTER CARE! Runs in an R shell on the host system, just like `assertSliced`'s output checks.
	 *
	 * A slice that is wrong may not even run, and the shell's R is not interactive, so an uncaught error would end
	 * the session for every test after this one; `try` keeps it alive and turns the error into missing output.
	 * Evaluating the whole program as one expression also drops the auto-printing of intermediate results, which
	 * a slice legitimately introduces by dropping an unused assignment target or an `invisible` wrapper.
	 */
	async function run(what: string): Promise<string> {
		const lines = await shell.sendCommandWithOutput(
			`try(eval(parse(text = ${JSON.stringify(what)})), silent = TRUE)`,
			{ automaticallyTrimOutput: true }
		);
		shell.clearEnvironment();
		return lines.join('\n');
	}
}

describe('Counterexamples against R semantics', { concurrent: false }, withShell(shell => {
	describe('Functions stored in containers', () => {
		assertSliceKeepsOutput(label('call a function held in a list', ['dollar-access', 'call-anonymous', 'normal-definition']),
			shell, 'fs <- list(f = function(x) x * 3)\nr <- fs$f(2)\nprint(r)', '3@r', '[1] 6'
		);
		assertSliceKeepsOutput(label('call a function held two levels deep', ['dollar-access', 'call-anonymous']),
			shell, 'o <- list(inner = list(f = function() 11))\nr <- o$inner$f()\nprint(r)', '3@r', '[1] 11'
		);
		assertSliceKeepsOutput(label('argument of a call through $', ['dollar-access', 'unnamed-arguments']),
			shell, 'o <- list(f = function(x) x * 2)\nk <- 4\nr <- o$f(k)\nprint(r)', '4@r', '[1] 8'
		);
		assertSliceKeepsOutput(label('closure in a list sees the later binding', ['dollar-access', 'closures']),
			shell, 'k <- 5\nfs <- list(f = function() k)\nk <- 9\nr <- fs$f()\nprint(r)', '5@r', '[1] 9'
		);
		assertSliceKeepsOutput(label('two functions assigned through $', ['dollar-access', 'replacement-functions']),
			shell, 'o <- list()\no$f <- function() 8\no$g <- function() 9\nr <- o$f() + o$g()\nprint(r)', '5@r', '[1] 17'
		);
		assertSliceKeepsOutput(label('function assigned to a list index keeps its body', ['double-bracket-access', 'replacement-functions']),
			shell, 'fs <- list()\nfs[[1]] <- function(x) x + 5\nr <- fs[[1]](1)\nprint(r)', '4@r', '[1] 6'
		);
		assertSliceKeepsOutput(label('functions collected in a loop', ['double-bracket-access', 'for-loop', 'closures']),
			shell, 'fs <- list()\nfor(i in 1:2) fs[[i]] <- function() i * 10\nr <- fs[[1]]()\nprint(r)', '4@r', '[1] 20'
		);
		assertSliceKeepsOutput(label('function collected by super-assignment from local', ['super-left-assignment', 'closures']),
			shell, 'fs <- list()\nfor(i in 1:3) { local({ j <- i; fs[[j]] <<- function() j }) }\nr <- fs[[1]]()\nprint(r)', '4@r', '[1] 1'
		);
		assertSliceKeepsOutput(label('closure of a function in a list literal', ['double-bracket-access', 'closures']),
			shell, 'k <- 5\nfs <- list(function(x) x + k)\nr <- fs[[1]](1)\nprint(r)', '4@r', '[1] 6'
		);
		assertSliceKeepsOutput(label('object built from closures over a counter', ['dollar-access', 'super-left-assignment', 'closures']),
			shell, 'mk <- function() { cnt <- 0; list(inc = function() cnt <<- cnt + 1, get = function() cnt) }\no <- mk()\no$inc(); o$inc()\nr <- o$get()\nprint(r)', '5@r', '[1] 2'
		);
		assertSliceKeepsOutput(label('reference class method mutates its field', ['oop-r6', 'dollar-access']),
			shell, 'G <- setRefClass("G2", fields = list(n = "numeric"), methods = list(bump = function() { n <<- n + 1 }))\no <- G$new(n = 1)\no$bump()\nr <- o$n\nprint(r)', '5@r', '[1] 2'
		);
	});

	describe('Functions as values', () => {
		/* the value of a function is its body, so a criterion reading the function itself needs all of it;
		   a slice may only trim the body where the function is called and just part of it is needed */
		assertSliceKeepsOutput(label('a function read as a value keeps its body', ['normal-definition', 'get-function-structure']),
			/* slicing a definition deliberately gives the stub, so this needs "reached as a value" to be told apart */
			shell, 'f <- function() { x <- 1; x + 1 }\nr <- length(deparse(f))\nprint(r)', '3@r', '[1] 5'
		);
		/* the wrapper a higher-order built-in hands back calls what it wraps */
		assertSliceKeepsOutput(label('a function wrapped by Negate is called through the wrapper', ['closures', 'normal-definition']),
			shell, 'thr <- 3\nsmall <- function(x) x < thr\nr <- Filter(Negate(small), 1:5)\nprint(r)', '4@r', '[1] 3 4 5'
		);
		assertSliceKeepsOutput(label('a function wrapped by Vectorize is called through the wrapper', ['closures', 'normal-definition']),
			shell, 'base <- 5\nf <- function(x) x + base\nr <- sapply(1:2, Vectorize(f))\nprint(r)', '4@r', '[1] 6 7'
		);
		/* a closure no call is linked to still runs somewhere, and binds its free names lexically */
		assertSliceKeepsOutput(label('functions stored in a list keep their free names', ['closures', 'call-anonymous']),
			shell, 'k <- 10\nfs <- list(a = function(x) x + k, b = function(x) x * k)\nr <- unname(sapply(fs, function(f) f(2)))\nprint(r)', '4@r', '[1] 12 20'
		);
	});

	describe('Pure built-ins', () => {
		/* `setNames` hands back a renamed copy, so its argument is not redefined and the slice drops the call */
		assertSliceKeepsOutput(label('setNames leaves its argument alone', ['normal-definition']),
			shell, 'df1 <- data.frame(id = 1:5, name = "A")\ndf2 <- setNames(df1, c("A", "B"))\nprint(names(df1))', '3@print', '[1] "id"   "name"'
		);
	});

	describe('Reflection', () => {
		/* `body(f) <- quote(k)` puts a name into the function, so what that name is bound to is read on the call */
		assertSliceKeepsOutput(label('a body written in reads what it names', ['modify-function-structure', 'built-in-quoting']),
			shell, 'k <- 7\nf <- function() 0\nbody(f) <- quote(k)\nr <- f()\nprint(r)', '5@r', '[1] 7'
		);
		/* a replacement keeps the target a function, so the call reads what the replacement made of it */
		assertSliceKeepsOutput(label('a nested replacement of the formals reaches the call', ['modify-function-structure', 'replacement-functions']),
			shell, 'f <- function(x) x + 1\nformals(f)$x <- 10\nr <- f()\nprint(r)', '4@r', '[1] 11'
		);
		assertSliceKeepsOutput(label('a nested replacement of the body reaches the call', ['modify-function-structure', 'replacement-functions']),
			shell, 'f <- function() list(a = 1)\nbody(f)$a <- 5\nr <- f()$a\nprint(r)', '4@r', '[1] 5'
		);
	});

	describe('Names computed at run time', () => {
		assertSliceKeepsOutput(label('get with the name in a variable', ['name-created', 'built-in-evaluation']),
			shell, 'nm <- "vv"\nvv <- 8\nr <- get(nm)\nprint(r)', '4@r', '[1] 8'
		);
		assertSliceKeepsOutput(label('match.fun with the name in a variable', ['name-created', 'built-in-evaluation']),
			shell, 's <- "sum"\nf <- match.fun(s)\nr <- f(1:4)\nprint(r)', '4@r', '[1] 10'
		);
		/* R pastes with as.character, so a numeric part names a variable just as a string one does */
		assertSliceKeepsOutput(label('get with a name pasted from a number', ['name-created', 'string-templates']),
			shell, 'i <- 1\nv1 <- 5\nr <- get(paste0("v", i))\nprint(r)', '4@r', '[1] 5'
		);
		assertSliceKeepsOutput(label('mget reads every name it is given', ['name-created', 'built-in-evaluation']),
			shell, 'a <- 1\nb <- 2\nr <- sum(unlist(mget(c("a","b"))))\nprint(r)', '4@r', '[1] 3'
		);
		assertSliceKeepsOutput(label('exists depends on the binding it asks about', ['name-created', 'search-type']),
			shell, 'nm <- "zzz"\nzzz <- 1\nr <- exists(nm)\nprint(r)', '4@r', '[1] TRUE'
		);
		assertSliceKeepsOutput(label('eval of a symbol built from a string', ['built-in-evaluation', 'name-created']),
			shell, 'nm <- "qq"\nqq <- 6\nr <- eval(as.name(nm))\nprint(r)', '4@r', '[1] 6'
		);
		assertSliceKeepsOutput(label('rm unshadows the built-in again', ['dynamic-variable-removal', 'redefinition-of-built-in-functions-primitives']),
			shell, 'sum <- function(x) 1\nr1 <- sum(1:3)\nrm(sum)\nr <- r1 + sum(1:3)\nprint(r)', '5@r', '[1] 7'
		);
	});

	describe('Environments', () => {
		assertSliceKeepsOutput(label('field written through $ on an environment', ['environment-sharing', 'dollar-access']),
			shell, 'e <- new.env()\ne$a <- 1\nr <- e$a\nprint(r)', '4@r', '[1] 1'
		);
		assertSliceKeepsOutput(label('function written through $ on an environment', ['environment-sharing', 'dollar-access']),
			shell, 'e <- new.env()\ne$f <- function() 15\nr <- e$f()\nprint(r)', '4@r', '[1] 15'
		);
		/* a closure written inside a function binds what it captures where that function is called */
		assertSliceKeepsOutput(label('a closure inside a function keeps what it captures', ['closures', 'super-left-assignment', 'exceptions-and-errors']),
			shell, 'tally <- 0\nsafe <- function(f) tryCatch(f(), error = function(e) { tally <<- tally + 1; NA })\nignore <- safe(function() stop(\'x\'))\nprint(tally)', '4@print', '[1] 1'
		);
		assertSliceKeepsOutput(label('field of an environment read inside a function', ['environment-sharing', 'closures']),
			shell, 'e <- new.env()\ne$a <- function() 1\ne$b <- function() e$a() + 1\nr <- e$b()\nprint(r)', '5@r', '[1] 2'
		);
		/* an environment is not copied on modify, so the callee writes the caller's object */
		assertSliceKeepsOutput(label('environment modified by a callee', ['environment-sharing', 'functions-with-global-side-effects']),
			shell, 'e <- new.env()\ne$a <- 1\nf <- function(en) en$a <- 42\nf(e)\nr <- e$a\nprint(r)', '6@r', '[1] 42'
		);
		assertSliceKeepsOutput(label('ls sees what was assigned into the environment', ['environment-sharing', 'search-path']),
			shell, 'e <- new.env()\nassign("x1", 1, envir = e)\nr <- length(ls(e))\nprint(r)', '4@r', '[1] 1'
		);
		assertSliceKeepsOutput(label('environment<- decides where the body looks up', ['dynamic-scope-changes', 'modify-function-structure']),
			shell, 'f <- function() x\ne <- new.env()\nassign("x", 77, envir = e)\nenvironment(f) <- e\nr <- f()\nprint(r)', '6@r', '[1] 77'
		);
		assertSliceKeepsOutput(label('writing into a closure environment', ['dynamic-scope-changes', 'closures']),
			shell, 'f <- function() { y <- 3; function() y }\ng <- f()\nenvironment(g)$y <- 10\nr <- g()\nprint(r)', '5@r', '[1] 10'
		);
		assertSliceKeepsOutput(label('list2env defines each element as a binding', ['dynamic-scope-changes', 'environment-sharing']),
			shell, 'l <- list(p = 3, q = 4)\ninvisible(list2env(l, envir = environment()))\nr <- p + q\nprint(r)', '4@r', '[1] 7'
		);
		assertSliceKeepsOutput(label('makeActiveBinding creates a binding', ['dynamic-scope-changes', 'anonymous-bindings']),
			shell, 'v <- 13\nmakeActiveBinding("ab", function() v, environment())\nr <- ab\nprint(r)', '4@r', '[1] 13'
		);
		/* every read of an active binding runs its function */
		assertSliceKeepsOutput(label('reading an active binding runs its function', ['dynamic-scope-changes', 'anonymous-bindings', 'super-left-assignment']),
			shell, 'n <- 0\nmakeActiveBinding("tick", function() { n <<- n + 1; n }, environment())\ntick\ntick\nprint(n)', '5@n', '[1] 2'
		);
		/* a field of the caller's frame is a free name of the function, bound where it is called */
		assertSliceKeepsOutput(label('parent.frame()$x reads the caller\'s variable', ['environment-parent', 'dollar-access']),
			shell, 'f <- function() { g <- function() parent.frame()$z; z <- 4; g() }\nr <- f()\nprint(r)', '3@r', '[1] 4'
		);
		assertSliceKeepsOutput(label('eval.parent assigns in the caller', ['built-in-evaluation', 'environment-parent']),
			shell, 'f <- function() eval.parent(quote(pp <- 3))\nf()\nr <- pp\nprint(r)', '4@r', '[1] 3'
		);
	});

	describe('Side effects of a function handed to another', () => {
		assertSliceKeepsOutput(label('sapply over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 's <- 0\ninvisible(sapply(1:3, function(i) s <<- s + i))\nprint(s)', '3@s', '[1] 6'
		);
		assertSliceKeepsOutput(label('lapply over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 'acc <- c()\ninvisible(lapply(1:3, function(i) acc <<- c(acc, i)))\nr <- sum(acc)\nprint(r)', '4@r', '[1] 6'
		);
		assertSliceKeepsOutput(label('mapply over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 'tot <- 0\ninvisible(mapply(function(a,b) tot <<- tot + a*b, 1:2, 3:4))\nprint(tot)', '3@tot', '[1] 11'
		);
		assertSliceKeepsOutput(label('Map over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 's <- 0\ninvisible(Map(function(i) s <<- s + i, 1:3))\nprint(s)', '3@s', '[1] 6'
		);
		assertSliceKeepsOutput(label('Reduce over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 's <- 0\ninvisible(Reduce(function(a, b) { s <<- s + b; a + b }, 1:3))\nprint(s)', '3@s', '[1] 5'
		);
		assertSliceKeepsOutput(label('Filter over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 's <- 0\ninvisible(Filter(function(i) { s <<- s + i; TRUE }, 1:3))\nprint(s)', '3@s', '[1] 6'
		);
		assertSliceKeepsOutput(label('do.call over a closure that super-assigns', ['super-left-assignment', 'side-effects-in-argument']),
			shell, 's <- 0\ninvisible(do.call(function(a) s <<- a, list(7)))\nprint(s)', '3@s', '[1] 7'
		);
	});

	describe('Condition handling', () => {
		assertSliceKeepsOutput(label('the error handler wins over the aborted body', ['exceptions-and-errors', 'super-left-assignment']),
			shell, 'v <- 0\ntryCatch({ v <- 1; stop("x") }, error = function(e) v <<- 2)\nprint(v)', '3@v', '[1] 2'
		);
		assertSliceKeepsOutput(label('finally runs after the handler', ['exceptions-and-errors']),
			shell, 'v <- 0\ninvisible(tryCatch({ stop("x") }, error = function(e) NULL, finally = { v <- 3 }))\nprint(v)', '3@v', '[1] 3'
		);
		assertSliceKeepsOutput(label('a calling handler writes to its enclosing scope', ['exceptions-and-errors', 'super-left-assignment']),
			shell, 'v <- 0\nwithCallingHandlers(warning("w"), warning = function(w) { v <<- 5; invokeRestart("muffleWarning") })\nprint(v)', '3@v', '[1] 5'
		);
	});

	describe('Lazy evaluation', () => {
		/* `a` is forced only after the body ran, so it sees the super-assigned value, not the one at the call */
		assertSliceKeepsOutput(label('a promise is forced after the body assigned', ['formals-promises', 'super-left-assignment']),
			shell, 'f <- function(a) { x <<- 99; a }\nx <- 1\nr <- f(x)\nprint(r)', '4@r', '[1] 99'
		);
		/* the default is evaluated in the function's own environment, so it uses `a` as the body left it */
		assertSliceKeepsOutput(label('a default argument sees the reassigned parameter', ['formals-default', 'formals-promises']),
			shell, 'f <- function(a, b = a * 2) { a <- 10; b }\nr <- f(3)\nprint(r)', '3@r', '[1] 20'
		);
	});

	describe('Communication through files', () => {
		assertSliceKeepsOutput(label('what is read back was written before', ['i-o']),
			shell, 'f <- tempfile()\nwriteLines("hi", f)\nr <- readLines(f)\nprint(r)', '4@r', '[1] "hi"'
		);
		assertSliceKeepsOutput(label('readRDS depends on the matching saveRDS', ['i-o', 'handling-binary-riles']),
			shell, 'f <- tempfile()\nsaveRDS(11, f)\nr <- readRDS(f)\nprint(r)', '4@r', '[1] 11'
		);
	});
}));
