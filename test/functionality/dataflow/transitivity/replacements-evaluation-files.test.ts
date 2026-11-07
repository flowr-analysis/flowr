import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Slices through nested replacements, non-standard evaluation, files, connections, and RNG state, checked against R. */
describe('Slices through replacements, evaluation, and files, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'nested names replacement', code: 'x <- c(a = 1, b = 2)\nnames(x)[2] <- "z"\nprint(names(x))' },
		{ name: 'attr replacement', code: 'x <- 1\nk <- "u"\nattr(x, "unit") <- k\nprint(attr(x, "unit"))' },
		{ name: 'levels replacement', code: 'f <- factor(c("a", "b"))\nlevels(f) <- c("x", "y")\nprint(as.character(f))' },
		{ name: 'dim replacement', code: 'x <- 1:6\ndim(x) <- c(2, 3)\nprint(ncol(x))' },
		{ name: 'body replacement then call', code: 'k <- 3\nf <- function() 1\nbody(f) <- quote(k * 2)\nprint(f())' },
		{ name: 'element of list replacement chain', code: 'l <- list(a = list(b = 1))\nl$a$b <- 7\nprint(l$a$b)' },
		{ name: 'vector index replacement in loop', code: 'v <- numeric(3)\nfor(i in 1:3) v[i] <- i * 2\nprint(v)' },
		{ name: 'bquote eval', code: 'k <- 4\ne <- bquote(.(k) + 1)\nprint(eval(e))' },
		{ name: 'substitute in function eval', code: 'f <- function(x) eval(substitute(x), list(a = 10))\nk <- 2\nprint(f(a + k))' },
		{ name: 'subset with variable', code: 'd <- data.frame(a = 1:5)\nt <- 3\nr <- subset(d, a > t)\nprint(nrow(r))' },
		{ name: 'transform', code: 'k <- 10\nd <- data.frame(a = 1:2)\nd <- transform(d, b = a + k)\nprint(d$b)' },
		{ name: 'with data frame', code: 'k <- 2\nd <- data.frame(a = 1:2)\nprint(with(d, a * k))' },
		{ name: 'write then read file', code: 'f <- tempfile()\nk <- "hello"\nwriteLines(k, f)\nprint(readLines(f))' },
		{ name: 'saveRDS readRDS', code: 'f <- tempfile()\nk <- 42\nsaveRDS(k, f)\nprint(readRDS(f))' },
		{ name: 'cat append then read', code: 'f <- tempfile()\ncat("a\\n", file = f)\ncat("b\\n", file = f, append = TRUE)\nprint(readLines(f))' },
		{ name: 'textConnection', code: 'k <- "x,y"\ncon <- textConnection(k)\nprint(readLines(con))' },
		{ name: 'set.seed sample', code: 'set.seed(1)\nx <- sample(1:10, 3)\nprint(x)' },
		{ name: 'RNGkind', code: 'RNGkind("Mersenne-Twister")\nset.seed(2)\nprint(runif(1))' },
		{ name: 'Sys.setlocale collate', code: 'invisible(Sys.setlocale("LC_COLLATE", "C"))\nprint(sort(c("b", "A", "a")))' },
		{ name: 'options scipen', code: 'options(scipen = 100)\nprint(1e10)' },
		{ name: 'sprintf with options digits unaffected', code: 'k <- 3.14159\nprint(sprintf("%.2f", k))' },
		{ name: 'assign in loop names', code: 'for(i in 1:2) assign(paste0("v", i), i * 3)\nprint(v2)' },
		{ name: 'mget loop names', code: 'v1 <- 1\nv2 <- 2\nprint(unlist(mget(paste0("v", 1:2))))' },
		{ name: 'exists then get', code: 'k <- 5\nif(exists("k")) r <- get("k") else r <- 0\nprint(r)' },
		{ name: 'environment counter list', code: 'mk <- function() { n <- 0; list(inc = function() n <<- n + 1, get = function() n) }\nc1 <- mk()\nc1$inc()\nc1$inc()\nprint(c1$get())' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
