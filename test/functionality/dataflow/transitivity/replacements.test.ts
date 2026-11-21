import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { resolvesLikeR, sliceMatchesR, type TransitivityCase, testing } from './transitivity';

describe('Transitivity through replacements, checked against R', withTreeSitter(parser => {
	describe('slices keep what a replacement changes', () => testing(['replacement-functions'], () => {
		const cases: readonly TransitivityCase[] = [
			{ name: 'a replaced element keeps the list', code: 'l <- list(a = 1, b = 2)\nl$a <- 5\nprint(l$b)' },
			{ name: 'a replacement after a rebinding drops the first', code: 'l <- list(a = 1)\nl <- list(a = 2, b = 3)\nl$a <- 5\nprint(l$b)', dropped: 'list(a = 1)' },
			{ name: 'a replacement in a loop', code: 'l <- list(a = 0)\nfor(i in 1:3) l$a <- l$a + i\nprint(l$a)' },
			{ name: 'two replacements in a loop', code: 'l <- list(a = 0, b = 0)\nfor(i in 1:2) { l$a <- l$a + i; l$b <- l$a + l$b }\nprint(l$b)' },
			{ name: 'a replacement in a function with a super assignment', code: 'l <- list(a = 1)\nf <- function(v) l$a <<- v\nf(2)\nf(3)\nprint(l$a)' },
			{ name: 'a replaced function environment keeps the function', code: 'f <- function() v\nenvironment(f) <- list2env(list(v = 2))\nprint(f())' },
			{ name: 'names of a vector', code: 'x <- c(1, 2)\nnames(x) <- c("a", "b")\nprint(x[["b"]])' },
			{ name: 'an element replaced in a try', code: 'l <- list(a = 1)\ntry({ stop("x"); l$a <- 5 }, silent = TRUE)\nprint(l$a)' }
		];
		for(const c of cases) {
			sliceMatchesR(parser, c);
		}
	}));

	describe('values of list elements', () => testing(['replacement-functions', 'dollar-access', 'double-bracket-access'], () => {
		resolvesLikeR(parser, 'value of a list element', 'l <- list(a = 1)\ny <- l$a\ncat(y)', '2@y');
		resolvesLikeR(parser, 'value of a list element matched partially', 'l <- list(abc = 1)\ny <- l$a\ncat(y)', '2@y');
		resolvesLikeR(parser, 'value of a list element ambiguously matched', 'l <- list(ab = 1, ac = 2)\ny <- l$a\ncat(if(is.null(y)) "NULL" else y)', '2@y');
		resolvesLikeR(parser, 'value of a missing list element', 'l <- list(a = 1)\ny <- l$b\ncat(if(is.null(y)) "NULL" else y)', '2@y');
		resolvesLikeR(parser, 'value of a list element next to an unknown one', 'l <- list(a = runif(1), b = 2)\ny <- l$b\ncat(y)', '2@y');
		resolvesLikeR(parser, 'value of two list elements', 'l <- list(a = 1, b = 10)\ny <- l$a + l$b\ncat(y)', '2@y');
		resolvesLikeR(parser, 'value of a replaced list element', 'l <- list(a = 1)\nl$a <- 5\ny <- l$a\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element replaced by name', 'l <- list(a = 1)\nl[["a"]] <- 5\ny <- l[[1]]\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element replaced by position', 'l <- list(a = 1, b = 2)\nl[[2]] <- 7\ny <- l$b\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element replaced right to left', 'l <- list(a = 1)\n5 -> l$a\ny <- l$a\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element kept by a replacement', 'l <- list(abc = 1)\nl$a <- 5\ny <- l$abc\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element removed', 'l <- list(a = 1, b = 2)\nl$a <- NULL\ny <- l[[1]]\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a nested list element', 'l <- list(a = list(b = 2))\nl$a$b <- 1\ny <- l$a$b\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a nested list element kept', 'l <- list(a = list(b = 2, c = 3))\nl$a$b <- 1\ny <- l$a$c\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a nested list element created', 'l <- list()\nl$a$b <- 1\ny <- l$a$b\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element after a copy is replaced', 'l <- list(a = 1)\nm <- l\nm$a <- 5\ny <- l$a\ncat(y)', '4@y');
		resolvesLikeR(parser, 'value of a list element replaced in a function', 'f <- function(x) { x$a <- 5; x }\nl <- list(a = 1)\nm <- f(l)\ny <- m$a\ncat(y)', '4@y');
		resolvesLikeR(parser, 'value of a list element a function replaces in its copy', 'f <- function(x) { x$a <- 5; x }\nl <- list(a = 1)\nm <- f(l)\ny <- l$a\ncat(y)', '4@y');
		resolvesLikeR(parser, 'value of a list element replaced through a right super assignment', 'l <- list(a = 1)\nf <- function() 5 ->> l$a\nf()\ny <- l$a\ncat(y)', '4@y');
		resolvesLikeR(parser, 'value of list elements replaced by two functions', 'g <- function() l$b <<- 2\nh <- function() l$c <<- 3\nl <- list(a = 1)\ng()\nh()\ny <- l$b\ncat(y)', '6@y', { imprecise: 'resolves 2 and NULL, the read in h also sees the list before g ran' });
		resolvesLikeR(parser, 'value of a list element replaced in an always taken branch', 'l <- list(a = 1)\nif(TRUE) l$a <- 5\ny <- l$a\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element replaced in a branch', 'l <- list(a = 1)\nif(runif(1) > 2) l$a <- 5\ny <- l$a\ncat(y)', '3@y', { imprecise: 'unknown, the branch may run' });
		resolvesLikeR(parser, 'value of a list element replaced in a try', 'l <- list(a = 1)\ntry(l$a <- 5, silent = TRUE)\ny <- l$a\ncat(y)', '3@y', { imprecise: 'resolves 1 and 5, the replacement may raise' });
		resolvesLikeR(parser, 'value of a list element a try never reaches', 'l <- list(a = 1)\ntry({ stop("x"); l$a <- 5 }, silent = TRUE)\ny <- l$a\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element replaced in a loop', 'l <- list(a = 0)\nfor(i in 1:3) l$a <- i\ny <- l$a\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element accumulated in a loop', 'l <- list(a = 0)\nfor(i in 1:3) l$a <- l$a + i\ny <- l$a\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of list elements added in a loop', 'l <- list()\nfor(k in c("x", "y", "z")) l[[k]] <- k\ny <- l$x\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of two list elements replaced in a loop', 'l <- list(a = 0, b = 0)\nfor(i in 1:2) { l$a <- l$a + i; l$b <- l$a + l$b }\ny <- l$b\ncat(y)', '3@y');
		resolvesLikeR(parser, 'value of a list element replaced in some runs of a loop', 'l <- list(a = 0)\nfor(i in 1:3) if(i > 1) l$a <- i\ny <- l$a\ncat(y)', '3@y', { imprecise: 'unknown, the run before need not have replaced it' });
		resolvesLikeR(parser, 'value of a list element replaced in a while loop', 'l <- list(a = 0)\ni <- 0\nwhile(i < 3) { i <- i + 1; l$a <- i }\ny <- l$a\ncat(y)', '4@y', { imprecise: 'unknown, the runs of a while loop are not known' });
		resolvesLikeR(parser, 'value of a list element replaced by two calls', 'l <- list(a = 1)\nf <- function(v) l$a <<- v\nf(2)\nf(3)\ny <- l$a\ncat(y)', '5@y', { imprecise: 'unknown, the second call reads what the first wrote' });
		resolvesLikeR(parser, 'value of list elements added by two calls', 'l <- list()\nf <- function(k) l[[k]] <<- 1\nf("x")\nf("y")\ny <- l$x\ncat(y)', '5@y', { imprecise: 'unknown, the second call reads what the first wrote' });
		resolvesLikeR(parser, 'value of a list element replaced in a closure frame', 'mk <- function() { l <- list(a = 1); list(set = function() l$a <<- 5, get = function() l$a) }\no <- mk()\no$set()\ny <- o$get()\ncat(y)', '4@y', { imprecise: 'unknown, the closure may be called more than once' });
		resolvesLikeR(parser, 'value of a list element replaced by an unknown name', 'l <- list(a = 1, b = 2)\nk <- if(runif(1) > 2) "a" else "b"\nl[[k]] <- 9\ny <- l$a\ncat(y)', '4@y', { imprecise: 'unknown, the name is not known' });
		resolvesLikeR(parser, 'value of a list element replaced by a single bracket', 'l <- list(a = 1)\nl["a"] <- list(5)\ny <- l$a\ncat(y)', '3@y', { imprecise: 'unknown, `[<-` is not applied' });
		resolvesLikeR(parser, 'value of a list renamed', 'l <- list(a = 1)\nnames(l) <- "b"\ny <- l$b\ncat(y)', '3@y', { imprecise: 'unknown, `names<-` is not applied' });
		resolvesLikeR(parser, 'value of a vector given names', 'x <- 1\nnames(x) <- "a"\ny <- x\ncat(y)', '3@y', { imprecise: 'unknown, `names<-` is not applied' });
		resolvesLikeR(parser, 'value of a vector given an attribute', 'x <- 1\nattr(x, "k") <- "v"\ny <- x\ncat(y)', '3@y', { imprecise: 'unknown, `attr<-` is not applied' });
		resolvesLikeR(parser, 'value of a list after a plain call of a replacement function', 'l <- list(a = 1)\nm <- `$<-`(l, "a", 5)\ny <- l$a\ncat(y)', '3@y', { imprecise: 'unknown, the plain call may still rebind' });
		resolvesLikeR(parser, 'value of a data frame column replaced', 'df <- data.frame(x = 1)\ndf$x <- 2\ny <- df$x\ncat(y)', '3@y', { imprecise: 'unknown, data frames are no list the value solver knows' });
		resolvesLikeR(parser, 'value of an environment field', 'e <- new.env()\ne$a <- 5\ny <- e$a\ncat(y)', '3@y', { imprecise: 'unknown, environments are no value the value solver knows' });
		resolvesLikeR(parser, 'value of an environment field set through a copy', 'e <- new.env()\nf <- e\nf$a <- 6\ny <- e$a\ncat(y)', '4@y', { imprecise: 'unknown, environments are no value the value solver knows' });
	}));
}));
