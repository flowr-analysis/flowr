import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';

/** Slices through sourcing, attaching, masking, and changes to functions and environments, each checked against R. */
describe('Slices through sourcing and scoping, checked against R', withTreeSitter(parser => {
	const cases: TransitivityCase[] = [
		{ name: 'source defines', code: 'source("a.R")\nprint(k)', files: { 'a.R': 'k <- 5' } },
		{ name: 'source local env', code: 'e <- new.env()\nsource("a.R", local = e)\nprint(e$k)', files: { 'a.R': 'k <- 5' } },
		{ name: 'source local TRUE in fn', code: 'f <- function() { source("a.R", local = TRUE); k }\nprint(f())', files: { 'a.R': 'k <- 5' } },
		{ name: 'sys.source env', code: 'e <- new.env()\nsys.source("a.R", envir = e)\nprint(get("k", envir = e))', files: { 'a.R': 'k <- 5' } },
		{ name: 'source in loop', code: 'for(i in 1:2) source("a.R")\nprint(k)', files: { 'a.R': 'k <- if(exists("k")) k + 1 else 1' } },
		{ name: 'source sets option', code: 'source("a.R")\nprint(pi)', files: { 'a.R': 'options(digits = 3)' } },
		{ name: 'source defines function', code: 'source("a.R")\nprint(h())', files: { 'a.R': 'j <- 2\nh <- function() j' } },
		{ name: 'source chain', code: 'source("a.R")\nprint(k)', files: { 'a.R': 'source("b.R")\nk <- m + 1', 'b.R': 'm <- 4' } },
		{ name: 'attach list', code: 'attach(list(k = 7))\nprint(k)' },
		{ name: 'attach env later write', code: 'e <- new.env()\nassign("k", 1, envir = e)\nattach(e)\nprint(k)' },
		{ name: 'global masks attached', code: 'attach(list(k = 7))\nk <- 2\nprint(k)' },
		{ name: 'base masked by local', code: 'sum <- function(...) 42\nprint(sum(1, 2))' },
		{ name: 'base via ::', code: 'sum <- function(...) 42\nprint(base::sum(1, 2))' },
		{ name: 'get mode function skips var', code: 'c <- 1\nprint(c(2, 3))' },
		{ name: 'local function shadows global later', code: 'f <- function() { g <- function() 1; g() }\ng <- function() 2\nprint(f())' },
		{ name: 'environment of fn changed', code: 'k <- 1\nf <- function() k\ne <- new.env()\nassign("k", 9, envir = e)\nenvironment(f) <- e\nprint(f())' },
		{ name: 'formals changed', code: 'f <- function(x = 1) x\nformals(f)$x <- 5\nprint(f())' },
		{ name: 'body changed', code: 'k <- 3\nf <- function() 1\nbody(f) <- quote(k)\nprint(f())' },
		{ name: 'delayedAssign', code: 'delayedAssign("v", k + 1)\nk <- 4\nprint(v)' },
		{ name: 'makeActiveBinding', code: 'n <- 0\nmakeActiveBinding("b", function() n + 1, environment())\nn <- 5\nprint(b)' },
		{ name: 'lockBinding still reads', code: 'k <- 3\nlockBinding("k", environment())\nprint(k)' },
		{ name: 'rm then exists', code: 'k <- 3\nrm(k)\nk <- 4\nprint(k)' },
		{ name: 'list2env', code: 'e <- list2env(list(k = 6))\nprint(e$k)' },
		{ name: 'with list', code: 'k <- 1\nprint(with(list(k = 8), k))' },
		{ name: 'within df', code: 'd <- data.frame(a = 1:2)\nd <- within(d, b <- a * 2)\nprint(d$b)' },
		{ name: 'mget', code: 'a <- 1\nb <- 2\nprint(mget(c("a", "b")))' },
		{ name: 'sys.call deparse', code: 'f <- function(x) deparse(sys.call())\nprint(f(1 + 2))' },
		{ name: 'match.call', code: 'f <- function(x, y) match.call()\nprint(f(y = 2, 1))' },
		{ name: 'parent.frame assign', code: 'f <- function() assign("k", 7, envir = parent.frame())\ng <- function() { f(); k }\nprint(g())' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
