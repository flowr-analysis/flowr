import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { callsLikeR, resolvesLikeR, sliceMatchesR, type TransitivityCase, testing } from './transitivity';

describe('Transitivity through recursion and higher-order calls, checked against R', withTreeSitter(parser => {
	describe('recursion', () => testing(['recursion'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a recursive factorial', code: 'fact <- function(n) if(n <= 1) b else n * fact(n - 1)\nb <- 1\nprint(fact(5))' },
			{ name: 'mutual recursion', code: 'ev <- function(n) if(n == 0) yes else od(n - 1)\nod <- function(n) if(n == 0) !yes else ev(n - 1)\nyes <- TRUE\nprint(ev(4))' },
			{ name: 'a recursive accumulator', code: 'acc <- 0\nr <- function(n) { if(n > 0) { acc <<- acc + n; r(n - 1) } }\nr(3)\nprint(acc)' },
			{ name: 'Recall', code: 'b <- 1\nf <- function(n) if(n <= 1) b else n * Recall(n - 1)\nprint(f(4))' },
			{ name: 'a side effect in mutual recursion', code: 'cnt <- 0\na <- function(n) { cnt <<- cnt + 1; if(n > 0) bb(n - 1) }\nbb <- function(n) a(n)\na(2)\nprint(cnt)' },
			{ name: 'an option set in a recursive function', code: 'a <- function(n) { if(n > 0) a(n - 1) else options(digits = 3) }\na(2)\nprint(pi)' },
			{ name: 'a recursive closure', code: 'mk <- function(k) { g <- function(n) if(n == 0) k else g(n - 1); g }\nh <- mk(9)\nprint(h(3))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('higher-order calls', () => testing(['higher-order-functions'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a super assignment in an lapply callback', code: 's <- 0\ninvisible(lapply(1:3, function(i) s <<- s + i))\nprint(s)' },
			{ name: 'a global read by a Map callback', code: 'k <- 10\nf <- function(a, b) a + b + k\nprint(Map(f, 1:2, 3:4)[[2]])' },
			{ name: 'a global read by a Reduce callback', code: 'k <- 2\nprint(Reduce(function(a, b) a * b + k, 1:3))' },
			{ name: 'do.call of an alias', code: 'g <- function(a) a + y\ny <- 5\nh <- g\nprint(do.call(h, list(1)))' },
			{ name: 'do.call by name', code: 'g <- function(a) a + y\ny <- 5\nprint(do.call("g", list(1)))' },
			{ name: 'sapply with a named function', code: 'm <- 3\nsc <- function(v) v * m\nprint(sum(sapply(1:2, sc)))' },
			{ name: 'purrr map with a closure', code: 'library(purrr)\nm <- 3\nprint(map_dbl(1:2, function(v) v * m)[2])', sigdb: true },
			{ name: 'a namespaced purrr map with a closure', code: 'm <- 3\ny <- purrr::map_dbl(1:2, function(v) v * m)\nprint(y[2])' },
			{ name: 'a super assignment in a purrr walk callback', code: 's <- 0\npurrr::walk(1:3, function(i) s <<- s + i)\nprint(s)' },
			{ name: 'a purrr map2 with a closure', code: 'm <- 3\ny <- purrr::map2_dbl(1:2, 1:2, function(a, b) a * b * m)\nprint(y[2])' },
			{ name: 'match.fun by name', code: 'z <- 1\nf <- function(x) x + z\nprint(match.fun("f")(1))' },
			{ name: 'Filter with a predicate reading a global', code: 'lim <- 2\nprint(Filter(function(v) v > lim, 1:4))' },
			{ name: 'a callback stored and called later', code: 'reg <- list()\non <- function(f) reg[[1]] <<- f\nk <- 8\non(function() k)\nprint(reg[[1]]())' },
			{ name: 'a super assignment in a vapply callback three calls deep', code: 's <- 0\nadd <- function(i) s <<- s + i\nstep <- function(i) add(i)\ninvisible(vapply(1:3, function(i) step(i), numeric(1)))\nprint(s)' },
			{ name: 'an option set in a Map callback', code: 'invisible(Map(function(d) options(digits = d), 3))\nprint(pi)' },
			{ name: 'a function returned by a higher-order call', code: 'k <- 7\ncompose <- function(f, g) function(x) g(f(x))\nh <- compose(function(x) x + 1, function(x) x * k)\nprint(h(1))' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('values', () => {
		resolvesLikeR(parser, 'a recursive accumulator', 'acc <- 0\nr <- function(n) { if(n > 0) { acc <<- 6; r(n - 1) } }\nr(3)\ncat(acc)', '4@acc', { imprecise: 'resolves 0 and 6, R runs the call that sets 6' });
		resolvesLikeR(parser, 'do.call of a constant function', 'g <- function() 5\ny <- do.call(g, list())\ncat(y)', '3@y');
		resolvesLikeR(parser, 'a super assignment in an lapply callback', 's <- 0\ninvisible(lapply(1, function(i) s <<- 4))\ncat(s)', '3@s');
	});

	describe('call targets', () => testing(['higher-order-functions'], () => {
		callsLikeR(parser, 'a function passed as an argument', 'h <- function() 1\ng <- h\nf <- function(k) k()\nf(g)\ncat("ok")', '3:18', ['1@function']);
		callsLikeR(parser, 'a returned function', 'mk <- function()\n  function() 1\nr <- mk()\nr()\ncat("ok")', '4@r', ['2@function']);
		callsLikeR(parser, 'a function passed through two calls', 'h <- function() 1\nap <- function(k) k()\nwr <- function(k) ap(k)\nwr(h)\ncat("ok")', '2:19', ['1@function']);
		callsLikeR(parser, 'an lapply callback calling a global function', 'h <- function(i) i\ninvisible(lapply(1, function(i) h(i)))\ncat("ok")', '2@h', ['1@function']);
		callsLikeR(parser, 'Recall calls its function', 'f <- function(n) if(n > 0) Recall(n - 1) else 0\nf(1)\ncat("ok")', '1@Recall', ['1@function']);
	}));
	describe('functions handed down several levels', () => testing(['higher-order-functions'], () => {
		/* `l<i>` calls its first parameter with the rest, so the function `h` reaches `l1` through `depth` calls of parameters */
		const handedDown = (depth: number) => Array.from({ length: depth - 1 }, (_, i) => {
			const params = [...Array.from({ length: i + 1 }, (_, j) => `g${i + 1 - j}`).slice(0, -1), 'f', 'x'].join(', ');
			return `l${i + 2} <- function(g${i + 2}, ${params}) g${i + 2}(${params})`;
		}).join('\n') + `\ninvisible(l${depth}(${Array.from({ length: depth - 1 }, (_, i) => `l${depth - 1 - i}`).join(', ')}, h, 1))`;
		const cases: readonly TransitivityCase[] = [
			{ name: 'a function applied twice by a composed closure', code: 'k <- 5\nj <- 2\nh <- function(x) x + k\nhh <- function(x) x + j\napply_twice <- function(f, x) f(f(x))\ncompose <- function(g) function(x) apply_twice(g, x)\nprint(compose(h)(1))', dropped: 'j <- 2' },
			{ name: 'a function handed down four calls', code: 'k <- 5\nh <- function(x) x + k\nap1 <- function(f1, x) f1(x)\nap2 <- function(f2, x) ap1(f2, x)\nap3 <- function(f3, x) ap2(f3, x)\nap4 <- function(f4, x) ap3(f4, x)\nprint(ap4(h, 1))' },
			{ name: 'a side effect of a function handed down through eighty calls of parameters', code: `n <- 0\nh <- function(x) { n <<- x; x }\nl1 <- function(f, x) f(x)\n${handedDown(80)}\nprint(n)` },
			{ name: 'a side effect of a function handed down through six calls of parameters', code: 'n <- 0\nh <- function(x) { n <<- x; x }\nl1 <- function(f, x) f(x)\nl2 <- function(g2, f, x) g2(f, x)\nl3 <- function(g3, g2, f, x) g3(g2, f, x)\nl4 <- function(g4, g3, g2, f, x) g4(g3, g2, f, x)\nl5 <- function(g5, g4, g3, g2, f, x) g5(g4, g3, g2, f, x)\nl6 <- function(g6, g5, g4, g3, g2, f, x) g6(g5, g4, g3, g2, f, x)\ninvisible(l6(l5, l4, l3, l2, l1, h, 1))\nprint(n)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
		callsLikeR(parser, 'a function applied twice by a composed closure', 'h <- function(x) x\napply_twice <- function(f, x) f(f(x))\ncompose <- function(g) function(x) apply_twice(g, x)\ninvisible(compose(h)(1))\ncat("ok")', '2:33', ['1@function']);
		callsLikeR(parser, 'a function handed down four calls defined in reverse', 'ap4 <- function(f4, x) ap3(f4, x)\nap3 <- function(f3, x) ap2(f3, x)\nap2 <- function(f2, x) ap1(f2, x)\nap1 <- function(f1, x) f1(x)\nh <- function(x) x\ninvisible(ap4(h, 1))\ncat("ok")', '4:24', ['5@function']);
		callsLikeR(parser, 'the outer function of a curried call', 'h <- function(x) x\nmk <- function(a) function(b) function(c) a(b(c))\ninc <- function(v) v\ninvisible(mk(h)(inc)(1))\ncat("ok")', '2:43', ['1@function']);
		callsLikeR(parser, 'the inner function of a curried call', 'h <- function(x) x\nmk <- function(a) function(b) function(c) a(b(c))\ninc <- function(v) v\ninvisible(mk(h)(inc)(1))\ncat("ok")', '2:45', ['3@function']);
		callsLikeR(parser, 'a function handed down through six calls of parameters', 'h <- function(x) x\nl1 <- function(f, x) f(x)\nl2 <- function(g2, f, x) g2(f, x)\nl3 <- function(g3, g2, f, x) g3(g2, f, x)\nl4 <- function(g4, g3, g2, f, x) g4(g3, g2, f, x)\nl5 <- function(g5, g4, g3, g2, f, x) g5(g4, g3, g2, f, x)\nl6 <- function(g6, g5, g4, g3, g2, f, x) g6(g5, g4, g3, g2, f, x)\ninvisible(l6(l5, l4, l3, l2, l1, h, 1))\ncat("ok")', '2:22', ['1@function']);
	}));
}));
