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
			{ name: 'an environment read by a function', code: 'e <- new.env()\nassign("a", 5, envir = e)\nf <- function(env) get("a", envir = env)\nprint(f(e))', red: 'R prints 5, the slice drops the assign into e the function reads through its parameter' },
			{ name: 'an environment changed by a function', code: 'e <- new.env()\nset <- function(env) env$v <- 6\nset(e)\nprint(e$v)' },
			{ name: 'an environment changed two calls deep', code: 'e <- new.env()\nset <- function(env, x) assign("v", x, envir = env)\nup <- function(env) set(env, 7)\nup(e)\nprint(get("v", envir = e))', red: 'R prints 7, the slice drops up(e), the write through a parameter is not passed up two calls' },
			{ name: 'an environment changed two calls deep with $', code: 'e <- new.env()\nset <- function(env) env$v <- 7\nup <- function(env) set(env)\nup(e)\nprint(e$v)', red: 'R prints 7, the slice drops up(e) and prints NULL' },
			{ name: 'with over a list', code: 'd <- list(a = 2)\nk <- 3\nprint(with(d, a * k))' },
			{ name: 'evalq into an environment', code: 'e <- new.env()\nk <- 4\nevalq(m <- k, e)\nprint(get("m", e))' },
			{ name: 'a function environment replaced', code: 'f <- function() z\nenvironment(f) <- list2env(list(z = 13))\nprint(f())' },
			{ name: 'a local function capturing a local', code: 'g <- local({ s <- 2; function(v) v * s })\nprint(g(5))' },
			{ name: 'an environment shared by two closures', code: 'e <- new.env()\nput <- function(v) assign("x", v, envir = e)\ntake <- function() get("x", envir = e)\nput(12)\nprint(take())' },
			{ name: 'sys.function frames with local', code: 'k <- 2\nf <- function() local(k * 3)\nprint(f())' }
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
		resolvesLikeR(parser, 'a super assignment the callee never runs', 'n <- 0\nf <- function(go) if(go) n <<- 5\nf(FALSE)\ncat(n)', '4@n', { imprecise: 'resolves 0 and 5, R never takes the branch' });
	});
}));
