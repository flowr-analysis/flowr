import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Slices through promises, defaults, recursion, and closures capturing state, checked against R. */
describe('Slices through laziness and recursion, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'promise forced late sees later write', code: 'k <- 1\nf <- function(x) { k <<- 5; x }\nprint(f(k))' },
		{ name: 'default sees local', code: 'f <- function(a, b = a * 2) { a <- 10; b }\nprint(f(1))' },
		{ name: 'force in closure factory', code: 'mk <- function(x) { force(x); function() x }\nk <- 2\nh <- mk(k)\nk <- 9\nprint(h())' },
		{ name: 'lazy closure factory', code: 'mk <- function(x) function() x\nk <- 2\nh <- mk(k)\nk <- 9\nprint(h())' },
		{ name: 'promise side effect once', code: 'n <- 0\nf <- function(x) { x; x; n }\nprint(f(n <- n + 1))' },
		{ name: 'mutual recursion', code: 'ev <- function(n) if(n == 0) TRUE else od(n - 1)\nod <- function(n) if(n == 0) FALSE else ev(n - 1)\nprint(ev(4))' },
		{ name: 'recursion with global accumulator', code: 'acc <- 0\nf <- function(n) { if(n > 0) { acc <<- acc + n; f(n - 1) } }\nf(3)\nprint(acc)' },
		{ name: 'memo via environment', code: 'memo <- new.env()\nfib <- function(n) { key <- as.character(n); if(!is.null(memo[[key]])) return(memo[[key]]); r <- if(n < 2) n else fib(n - 1) + fib(n - 2); memo[[key]] <- r; r }\nprint(fib(10))' },
		{ name: 'delayedAssign forced after change', code: 'k <- 1\ndelayedAssign("p", k * 10)\nk <- 2\nprint(p)' },
		{ name: 'substitute deparse', code: 'f <- function(x) deparse(substitute(x))\nprint(f(a + b))' },
		{ name: 'missing default promise', code: 'g <- function(x) if(missing(x)) "none" else x\nf <- function(y) g(y)\nprint(f())' },
		{ name: 'dots names', code: 'f <- function(...) names(list(...))\nprint(f(a = 1, b = 2))' },
		{ name: 'nargs', code: 'f <- function(a, b, c) nargs()\nprint(f(1, 2))' },
		{ name: 'sys.function recursion', code: 'f <- function(n) if(n == 0) "done" else sys.function()(n - 1)\nprint(f(3))' },
		{ name: 'on.exit with return value', code: 'f <- function() { x <- 1; on.exit(x <- 2); x }\nprint(f())' },
		{ name: 'closure modifies enclosing in loop', code: 'make <- function() { s <- 0; add <- function(v) s <<- s + v; for(i in 1:3) add(i); s }\nprint(make())' },
		{ name: 'lapply closure captures loop var lazily', code: 'fs <- lapply(1:3, function(i) function() i)\nprint(fs[[2]]())' },
		{ name: 'for closure captures last', code: 'fs <- list()\nfor(i in 1:3) { local({ j <- i; fs[[j]] <<- function() j }) }\nprint(fs[[2]]())' },
		{ name: 'environment of closure modified', code: 'f <- function() { v <- 1; function() v }\ng <- f()\nenvironment(g)$v <- 8\nprint(g())' },
		{ name: 'Reduce building closures', code: 'add <- function(n) function(x) x + n\nfs <- lapply(1:3, add)\nprint(Reduce(function(acc, f) f(acc), fs, 0))' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
