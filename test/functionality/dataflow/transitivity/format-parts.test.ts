import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Methods for the class of a part (a data frame column) that format and print reach, checked against R. */
describe('Format and print reach methods of parts, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'format of a data frame column', code: 'k <- 1\nformat.zz <- function(x, ...) { k <<- 9; "z" }\nd <- data.frame(a = 1)\nd$a <- structure(1, class = "zz")\ninvisible(format(d))\nprint(k)' },
		{ name: 'format result used', code: 'format.zz <- function(x, ...) rep("z", length(x))\nd <- data.frame(a = 1)\nd$a <- structure(1, class = "zz")\nprint(format(d))' },
		{ name: 'print data frame column method', code: 'k <- 1\nformat.zz <- function(x, ...) { k <<- 9; "z" }\nd <- data.frame(a = 1)\nd$a <- structure(1, class = "zz")\nprint(d)\ncat(k)' },
		{ name: 'data frame built with classed column', code: 'k <- 1\nformat.zz <- function(x, ...) { k <<- 9; "z" }\nd <- data.frame(a = I(structure(1, class = "zz")))\ninvisible(format(d))\nprint(k)' },
		{ name: 'format of a classed vector directly', code: 'k <- 1\nformat.zz <- function(x, ...) { k <<- 9; "z" }\ninvisible(format(structure(1, class = "zz")))\nprint(k)' },
		{ name: 'format data frame method user', code: 'k <- 1\nformat.data.frame <- function(x, ...) { k <<- 9; "z" }\nd <- data.frame(a = 1)\ninvisible(format(d))\nprint(k)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
