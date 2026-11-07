import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';

/** Slices for output that depends on global state written indirectly, each checked against R. */
describe('Slices keep indirect writes of global state, checked against R', withTreeSitter(parser => {
	const cases: TransitivityCase[] = [
		{ name: 'seed via lapply', code: 'invisible(lapply(1, function(i) set.seed(42)))\nprint(runif(1))' },
		{ name: 'seed via do.call', code: 'do.call(set.seed, list(42))\nprint(runif(1))' },
		{ name: 'seed via eval parse', code: 'eval(parse(text = "set.seed(42)"))\nprint(runif(1))' },
		{ name: 'seed in on.exit', code: 'f <- function() { on.exit(set.seed(42)); 1 }\ninvisible(f())\nprint(runif(1))' },
		{ name: 'seed via S3', code: 'g <- function(x) UseMethod("g")\ng.a <- function(x) set.seed(42)\ng(structure(1, class = "a"))\nprint(runif(1))' },
		{ name: 'digits via do.call', code: 'do.call(options, list(digits = 3))\nprint(pi)' },
		{ name: 'digits via eval parse', code: 'eval(parse(text = "options(digits = 3)"))\nprint(pi)' },
		{ name: 'digits via Map', code: 'invisible(Map(function(d) options(digits = d), 3))\nprint(pi)' },
		{ name: 'digits via closure later', code: 'mk <- function(d) function() options(digits = d)\nh <- mk(3)\nh()\nprint(pi)' },
		{ name: 'digits via Reduce', code: 'invisible(Reduce(function(a, b) { options(digits = b); a }, 3, 0))\nprint(pi)' },
		{ name: 'digits via tryCatch handler', code: 'tryCatch(stop("x"), error = function(e) options(digits = 3))\nprint(pi)' },
		{ name: 'digits via warning handler', code: 'withCallingHandlers({ warning("w"); 1 }, warning = function(w) { options(digits = 3); invokeRestart("muffleWarning") })\nprint(pi)' },
		{ name: 'digits via finally', code: 'tryCatch(1, finally = options(digits = 3))\nprint(pi)' },
		{ name: 'digits via local', code: 'local(options(digits = 3))\nprint(pi)' },
		{ name: 'digits via evalq env', code: 'evalq(options(digits = 3), new.env())\nprint(pi)' },
		{ name: 'env var via sapply', code: 'invisible(sapply("1", function(v) Sys.setenv(A = v)))\nprint(Sys.getenv("A"))' },
		{ name: 'env var via do.call', code: 'do.call(Sys.setenv, list(A = "1"))\nprint(Sys.getenv("A"))' },
		{ name: 'wd via function', code: 'd <- tempdir()\nwriteLines("x", file.path(d, "zz.txt"))\ngo <- function() setwd(d)\ngo()\nprint(readLines("zz.txt"))' },
		{ name: 'digits via replacement fn', code: '`dg<-` <- function(x, value) { options(digits = value); x }\nx <- 1\ndg(x) <- 3\nprint(pi)' },
		{ name: 'digits via R6-like env method', code: 'o <- new.env()\no$set <- function() options(digits = 3)\no$set()\nprint(pi)' },
		{ name: 'digits via match.arg default', code: 'f <- function(d = c(3, 5)) options(digits = d[1])\nf()\nprint(pi)' },
		{ name: 'digits via promise forced later', code: 'f <- function(x) { 1; x }\ninvisible(f(options(digits = 3)))\nprint(pi)' },
		{ name: 'digits via promise in dots', code: 'f <- function(...) list(...)\ninvisible(f(options(digits = 3)))\nprint(pi)' },
		{ name: 'digits via dots element', code: 'f <- function(...) ..1\ninvisible(f(options(digits = 3), 2))\nprint(pi)' },
		{ name: 'digits via substitute eval', code: 'f <- function(e) eval(substitute(e))\nf(options(digits = 3))\nprint(pi)' },
		{ name: 'digits in while', code: 'i <- 0\nwhile(i < 2) { i <- i + 1; if(i == 2) options(digits = 3) }\nprint(pi)' },
		{ name: 'digits in repeat', code: 'i <- 0\nrepeat { i <- i + 1; if(i == 3) { options(digits = 3); break } }\nprint(pi)' },
		{ name: 'digits via sys.function', code: 'f <- function(n) if(n == 0) options(digits = 3) else sys.function()(n - 1)\nf(2)\nprint(pi)' },
		{ name: 'digits via Recall', code: 'f <- function(n) if(n == 0) options(digits = 3) else Recall(n - 1)\nf(2)\nprint(pi)' },
		{ name: 'digits via vapply in fn', code: 'f <- function() invisible(vapply(3, function(d) { options(digits = d); 1 }, 1))\nf()\nprint(pi)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
