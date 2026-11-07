import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { sliceMatchesR, type TransitivityCase } from './transitivity';
/** Lookups whose name is only known at runtime, checked against R. */
describe('Lookups of names known only at runtime, checked against R', withTreeSitter(parser => {
	const cases: readonly TransitivityCase[] = [
		{ name: 'mget of computed names', code: 'v1 <- 1\nv2 <- 2\nprint(unlist(mget(paste0("v", 1:2))))' },
		{ name: 'get of a random name', code: 'v1 <- 1\nprint(get(sample(c("v1"), 1)))' },
		{ name: 'get of a random name in a function', code: 'f <- function() { a <- 3; get(sample(c("a"), 1)) }\nprint(f())' },
		{ name: 'get of a random global name in a function', code: 'a <- 4\nf <- function() get(sample(c("a"), 1))\nprint(f())' },
		{ name: 'get0 of a random name', code: 'v1 <- 5\nprint(get0(sample(c("v1"), 1)))' },
		{ name: 'get of a random name from an environment', code: 'e <- new.env()\nassign("v", 6, envir = e)\nprint(get(sample(c("v"), 1), envir = e))' },
		{ name: 'mget of a random name from an environment', code: 'e <- new.env()\nassign("v", 7, envir = e)\nprint(unlist(mget(sample(c("v"), 1), envir = e)))' }
	];
	for(const c of cases) {
		sliceMatchesR(parser, c);
	}
}));
