import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** `do.call` hands quoted code to the function it calls, which runs it once it forces that argument, checked against R. */
describe('Quoted code handed on by do.call, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'do.call quote never forced', code: 'n <- 0\nf <- function(a) 1\nr <- do.call(f, list(quote(n <- 5)))\nprint(n)' },
		{ name: 'do.call quote named', code: 'n <- 0\nf <- function(a) a\nr <- do.call(f, list(a = quote(n <- 5)))\nprint(n)' },
		{ name: 'do.call quote in variable', code: 'n <- 0\nq <- quote(n <- 5)\nf <- function(a) a\nr <- do.call(f, list(q))\nprint(n)' },
		{ name: 'do.call two quotes', code: 'n <- 0\nm <- 0\nf <- function(a, b) a + b\nr <- do.call(f, list(quote(n <- 5), quote(m <- 2)))\nprint(n + m)' },
		{ name: 'do.call quote', code: 'n <- 0\nf <- function(a) a\nr <- do.call(f, list(quote(n <- 5)))\nprint(n)' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
