import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Slices through early exits, errors, handlers, restarts, and exit hooks, each checked against R. */
describe('Slices through exits and conditions, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'return in loop', code: 'f <- function() { for(i in 1:5) if(i == 3) return(i * 10); 0 }\nprint(f())' },
		{ name: 'side effect before stop in try', code: 'n <- 0\ninvisible(try({ n <- 5; stop("x") }, silent = TRUE))\nprint(n)' },
		{ name: 'side effect before stop in tryCatch', code: 'n <- 0\ntryCatch({ n <- 5; stop("x") }, error = function(e) NULL)\nprint(n)' },
		{ name: 'finally writes', code: 'n <- 0\ntryCatch(stop("x"), error = function(e) NULL, finally = n <- 7)\nprint(n)' },
		{ name: 'handler value', code: 'r <- tryCatch(stop("x"), error = function(e) 42)\nprint(r)' },
		{ name: 'handler reads condition message', code: 'm <- "boom"\nr <- tryCatch(stop(m), error = function(e) conditionMessage(e))\nprint(r)' },
		{ name: 'on.exit after FALSE order', code: 'v <- c()\nf <- function() { on.exit(v <<- c(v, 1)); on.exit(v <<- c(v, 2), add = TRUE, after = FALSE); 0 }\ninvisible(f())\nprint(v)' },
		{ name: 'on.exit sees later local', code: 'f <- function() { on.exit(r <<- x); x <- 4; 0 }\ninvisible(f())\nprint(r)' },
		{ name: 'warn 2 turns warning to error', code: 'n <- 0\noptions(warn = 2)\ntryCatch({ warning("w"); n <- 5 }, error = function(e) NULL)\nprint(n)' },
		{ name: 'withRestarts', code: 'r <- withRestarts(invokeRestart("myR", 3), myR = function(v) v * 2)\nprint(r)' },
		{ name: 'signalCondition calling handler', code: 'n <- 0\nwithCallingHandlers(signalCondition(simpleCondition("c")), condition = function(c) n <<- 6)\nprint(n)' },
		{ name: 'break in switch in loop', code: 'n <- 0\nfor(i in 1:5) { switch(as.character(i), "3" = break, n <- n + 1) }\nprint(n)' },
		{ name: 'next in repeat', code: 'i <- 0\nn <- 0\nrepeat { i <- i + 1; if(i > 4) break; if(i %% 2 == 0) next; n <- n + i }\nprint(n)' },
		{ name: 'return from lapply callback', code: 'r <- lapply(1:3, function(i) { if(i == 2) return(20); i })\nprint(r[[2]])' },
		{ name: 'stopifnot passes', code: 'x <- 3\nstopifnot(x > 1)\nprint(x)' },
		{ name: 'invisible value', code: 'f <- function() invisible(5)\ny <- f()\nprint(y)' },
		{ name: 'error in default of unforced arg', code: 'f <- function(a = stop("no")) 1\nprint(f())' },
		{ name: 'conditional return value', code: 'f <- function(x) { if(x > 0) return("pos"); "neg" }\nprint(f(-1))' },
		{ name: 'while with break value', code: 'i <- 0\nwhile(TRUE) { i <- i + 2; if(i > 5) break }\nprint(i)' },
		{ name: 'Recall accumulator', code: 'f <- function(n, acc = 0) if(n == 0) acc else Recall(n - 1, acc + n)\nprint(f(4))' },
		{ name: 'tryCatch warning handler value', code: 'r <- tryCatch(as.integer("x"), warning = function(w) -1L)\nprint(r)' },
		{ name: 'try returns error object class', code: 'r <- try(log(-1), silent = TRUE)\nprint(r)' },
		{ name: 'error after write in function', code: 'n <- 0\nf <- function() { n <<- 3; stop("x") }\ninvisible(try(f(), silent = TRUE))\nprint(n)' },
		{ name: 'finally in function with return', code: 'n <- 0\nf <- function() tryCatch(return(1), finally = n <<- 8)\ninvisible(f())\nprint(n)' },
		{ name: 'sys.on.exit', code: 'n <- 0\nf <- function() { on.exit(n <<- 2); 1 }\ninvisible(f())\nprint(n)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
