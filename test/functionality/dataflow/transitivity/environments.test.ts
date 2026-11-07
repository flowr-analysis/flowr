import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase, testing } from './transitivity';

describe('Transitivity through environments and super assignments, checked against R', withTreeSitter(parser => {
	describe('super assignments and assign', () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'assign to the global environment two calls deep', code: 'f <- function() assign("z", 4, envir = .GlobalEnv)\ng <- function() f()\ng()\nprint(z)' },
			{ name: 'a super assignment stops at the enclosing frame', code: 'x <- 0\nf <- function() { x <- 1; g <- function() x <<- 2; g(); x }\nprint(f())' },
			{ name: 'a super assignment leaves the global alone', code: 'x <- 0\nf <- function() { x <- 1; g <- function() x <<- 2; g(); x }\nf()\nprint(x)' },
			{ name: 'assign into the caller frame', code: 'f <- function() assign("w", 3, envir = parent.frame())\ng <- function() { f(); w }\nprint(g())' },
			{ name: 'a super assignment creating a global two frames up', code: 'f <- function() { g <- function() qq <<- 8; g() }\nf()\nprint(qq)' },
			{ name: 'a super assignment through a returned function', code: 'n <- 1\nmk <- function() function() n <<- n * 3\ninc <- mk()\ninc()\ninc()\nprint(n)' },
			{ name: 'a super assignment by a function stored in a list', code: 'n <- 0\nl <- list(up = function() n <<- 5)\nl$up()\nprint(n)' },
			{ name: 'a super assignment the callee never runs', code: 'n <- 0\nf <- function(go) if(go) n <<- 5\nf(FALSE)\nprint(n)' },
			{ name: 'assign with a computed name', code: 'f <- function(nm) assign(nm, 2, envir = .GlobalEnv)\nf("v")\nprint(v)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	});

	describe('environments', () => testing(['environment-sharing'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'local keeps its definitions', code: 'x <- 1\ny <- local({ x <- 2; x + 1 })\nprint(x)' },
			{ name: 'local returns its last value', code: 'k <- 5\ny <- local({ x <- k; x + 1 })\nprint(y)' },
			{ name: 'an environment read by a function', code: 'e <- new.env()\nassign("a", 5, envir = e)\nf <- function(env) get("a", envir = env)\nprint(f(e))' },
			{ name: 'an environment changed by a function', code: 'e <- new.env()\nset <- function(env) env$v <- 6\nset(e)\nprint(e$v)' },
			{ name: 'an environment changed two calls deep', code: 'e <- new.env()\nset <- function(env, x) assign("v", x, envir = env)\nup <- function(env) set(env, 7)\nup(e)\nprint(get("v", envir = e))' },
			{ name: 'an environment changed two calls deep with $', code: 'e <- new.env()\nset <- function(env) env$v <- 7\nup <- function(env) set(env)\nup(e)\nprint(e$v)' },
			{ name: 'with over a list', code: 'd <- list(a = 2)\nk <- 3\nprint(with(d, a * k))' },
			{ name: 'evalq into an environment', code: 'e <- new.env()\nk <- 4\nevalq(m <- k, e)\nprint(get("m", e))' },
			{ name: 'a function environment replaced', code: 'f <- function() z\nenvironment(f) <- list2env(list(z = 13))\nprint(f())' },
			{ name: 'a local function capturing a local', code: 'g <- local({ s <- 2; function(v) v * s })\nprint(g(5))' },
			{ name: 'an environment shared by two closures', code: 'e <- new.env()\nput <- function(v) assign("x", v, envir = e)\ntake <- function() get("x", envir = e)\nput(12)\nprint(take())' },
			{ name: 'sys.function frames with local', code: 'k <- 2\nf <- function() local(k * 3)\nprint(f())' },
			{ name: 'assign under a name a parameter holds', code: 'reg <- new.env()\nregister <- function(name, f) assign(name, f, envir = reg)\nk <- 3\nregister("h", function() k)\nprint(reg$h())' },
			{ name: 'assign under a name a parameter holds from a variable', code: 'reg <- new.env()\nregister <- function(name, f) assign(name, f, envir = reg)\nk <- 3\nnm <- "h"\nregister(nm, function() k)\nprint(reg$h())' },
			{ name: 'assign under a name built from a parameter', code: 'reg <- new.env()\nregister <- function(name, f) assign(paste0("on_", name), f, envir = reg)\nk <- 3\nregister("h", function() k)\nprint(reg$on_h())' },
			{ name: 'assign under names of two calls', code: 'reg <- new.env()\nregister <- function(name, f) assign(name, f, envir = reg)\nk <- 3\nj <- 4\nregister("h", function() k)\nregister("g", function() j)\nprint(reg$g())', dropped: 'k <- 3' },
			{ name: 'assign into an environment handed over under a name handed over', code: 'reg <- new.env()\nregister <- function(env, name, f) assign(name, f, envir = env)\nk <- 3\nregister(reg, "h", function() k)\nprint(reg$h())' },
			{ name: 'assign into the calling frame under a name a parameter holds', code: 'set <- function(name, v) assign(name, v, envir = parent.frame())\nset("x", 5)\nprint(x)' },
			{ name: 'assign into the global environment under a name a parameter holds', code: 'set <- function(name, v) assign(name, v, envir = .GlobalEnv)\nf <- function() set("x", 6)\nf()\nprint(x)' },
			{ name: 'get of a name a parameter holds', code: 'reg <- new.env()\nk <- 3\nassign("h", function() k, envir = reg)\nfetch <- function(name) get(name, envir = reg)\nprint(fetch("h")())' },
			{ name: 'get from an environment a free variable names', code: 'reg <- new.env()\nk <- 3\nassign("h", function() k, envir = reg)\nfetch <- function() get("h", envir = reg)\nprint(fetch()())' },
			{ name: 'exists of a name a parameter holds', code: 'reg <- new.env()\nassign("h", 1, envir = reg)\nhas <- function(name) exists(name, envir = reg)\nprint(has("h"))' },
			{ name: 'rm of a name a parameter holds', code: 'reg <- new.env()\nassign("h", 1, envir = reg)\ndrop <- function(name) rm(list = name, envir = reg)\ndrop("h")\nprint(exists("h", envir = reg))' },
			{ name: 'rm from an environment a free variable names', code: 'reg <- new.env()\nassign("h", 1, envir = reg)\ndrop <- function() rm("h", envir = reg)\ndrop()\nprint(exists("h", envir = reg))' },
			{ name: 'rm from the global environment of a name a parameter holds', code: 'x <- 1\ndrop <- function(n) rm(list = n, envir = .GlobalEnv)\ndrop("x")\nprint(exists("x"))' },
			{ name: 'rm two calls deep of a name a parameter holds', code: 'x <- 1\ndrop <- function(n) rm(list = n, envir = .GlobalEnv)\nf <- function() drop("x")\nf()\nprint(exists("x"))' },
			{ name: 'a dollar assignment into an environment a parameter holds', code: 'reg <- new.env()\nregister <- function(env, f) env$h <- f\nk <- 3\nregister(reg, function() k)\nprint(reg$h())' },
			{ name: 'a dollar assignment into an environment at two calls', code: 'reg <- new.env()\nregister <- function(env, f) env$h <- f\nk <- 3\nj <- 4\nregister(reg, function() k)\nregister(reg, function() j)\nprint(reg$h())', dropped: 'k <- 3', imprecise: 'keeps k <- 3, the read reaches the replacement in the body, which reads what every call hands over' },
			{ name: 'a double bracket assignment into an environment a parameter holds', code: 'reg <- new.env()\nregister <- function(env, f) env[["h"]] <- f\nk <- 3\nregister(reg, function() k)\nprint(reg$h())' },
			{ name: 'a dollar assignment into a list a parameter holds', code: 'l <- list(h = function() 1)\nset <- function(x, f) { x$h <- f; x }\nk <- 3\nl2 <- set(l, function() k)\nprint(l$h())', dropped: 'k <- 3' },
			{ name: 'assign two calls deep under a name a parameter holds', code: 'reg <- new.env()\nregister <- function(name, f) assign(name, f, envir = reg)\nk <- 3\nsetup <- function() register("h", function() k)\nsetup()\nprint(reg$h())' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('values', () => {
		resolvesLikeR(parser, 'a super assignment through a returned function', 'n <- 1\nmk <- function() function() n <<- 3\ninc <- mk()\ninc()\ncat(n)', '5@n');
		resolvesLikeR(parser, 'assign to the global environment two calls deep', 'f <- function() assign("z", 4, envir = .GlobalEnv)\ng <- function() f()\ng()\ncat(z)', '4@z');
		resolvesLikeR(parser, 'local keeps its definitions', 'x <- 1\ny <- local({ x <- 2; x + 1 })\ncat(x)', '3@x');
		resolvesLikeR(parser, 'local returns its last value', 'y <- local({ x <- 2; x + 1 })\ncat(y)', '2@y');
		resolvesLikeR(parser, 'assign under a name a parameter holds', 'reg <- new.env()\nset <- function(name, v) assign(name, v, envir = reg)\nset("a", 1)\nset("b", 2)\ny <- get("b", envir = reg)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'get of a name a parameter holds', 'reg <- new.env()\nassign("a", 1, envir = reg)\nassign("b", 2, envir = reg)\nfetch <- function(name) get(name, envir = reg)\ny <- fetch("b")\ncat(y)', '5@y', { imprecise: 'resolves 1 and 2, the body reads what every call names' });
		resolvesLikeR(parser, 'a dollar assignment into an environment a parameter holds', 'e <- new.env()\nset <- function(env, v) env$x <- v\nset(e, 1)\nset(e, 2)\ny <- get("x", envir = e)\ncat(y)', '5@y');
		resolvesLikeR(parser, 'a dollar assignment into a closure environment handed over', 'mk <- function() { v <- 1; function() v }\ng <- mk()\nput <- function(env, x) env$v <- x\nput(environment(g), 4)\ny <- g()\ncat(y)', '5@y');
		resolvesLikeR(parser, 'get without an environment of a name a parameter holds', 'k <- 1\nj <- 2\nf <- function(n) get(n)\ny <- f("j")\ncat(y)', '4@y');
		resolvesLikeR(parser, 'get without an environment sees the frame of the call', 'k <- 1\nf <- function(n) { k <- 7; get(n) }\ny <- f("k")\ncat(y)', '3@y');
		resolvesLikeR(parser, 'get without an environment sees the frame of the definition', 'mk <- function() { k <- 5; function(n) get(n) }\nk <- 1\nf <- mk()\ny <- f("k")\ncat(y)', '4@y');
		resolvesLikeR(parser, 'get without an environment sees a local written after the definition', 'mk <- function() { f <- function(n) get(n); k <- 5; f }\nk <- 1\nf <- mk()\ny <- f("k")\ncat(y)', '4@y');
		resolvesLikeR(parser, 'get without an environment sees a global written after the definition', 'k <- 1\nf <- function(n) { get(n) }\nk <- 9\ny <- f("k")\ncat(y)', '4@y');
		resolvesLikeR(parser, 'a super assignment the callee never runs', 'n <- 0\nf <- function(go) if(go) n <<- 5\nf(FALSE)\ncat(n)', '4@n');
	});
}));
