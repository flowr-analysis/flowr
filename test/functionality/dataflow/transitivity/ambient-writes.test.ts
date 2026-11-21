import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { writesLikeR } from './transitivity';

const ok = '\nif(getOption("digits") == 3) cat("ok")';
/**
 * Global state written through calls flowR has to follow (higher-order functions, `do.call`, `eval`, dispatch, ...),
 * each checked against what R leaves changed.
 */
describe('Ambient writes through indirect calls, checked against R', withTreeSitter(parser => {
	const cases: [string, string, number, string[], string?][] = [
		['eval parse', 'eval(parse(text = "options(digits = 3)"))' + ok, 1, ['#option:digits']],
		['with', 'with(list(d = 3), options(digits = d))' + ok, 1, ['#option:digits']],
		['eval parse in fn', 'f <- function() eval(parse(text = "options(digits = 3)"))\nf()' + ok, 2, ['#option:digits']],
		['eval str2lang', 'eval(str2lang("options(digits = 3)"))' + ok, 1, ['#option:digits']],
		['eval parse var', 'x <- "options(digits = 3)"\neval(parse(text = x))' + ok, 2, ['#option:digits']],
		['eval parse two', 'eval(parse(text = "y <- 1; options(digits = 3)"))' + ok, 1, ['#option:digits']]
	];
	for(const [name, code, line, writes, imprecise] of cases) {
		writesLikeR(parser, name, code, line, writes, imprecise === undefined ? {} : { imprecise });
	}
	describe('through functions the program defines', () => {
		const env = '\nif(Sys.getenv("FLOWR_T") == "1") cat("ok")';
		const own: [string, string, number, string[], string?][] = [
			['an option handed on by name', 'g <- function(d) options(digits = d)\ng(3)' + ok, 2, ['#option:digits']],
			['an option from the default of a parameter', 'g <- function(d = 3) options(digits = d)\ng()' + ok, 2, ['#option:digits']],
			['an option handed on through the dots', 'g <- function(...) options(...)\ng(digits = 3)' + ok, 2, ['#option:digits'], 'the dots stand for any option while the graph is built, so it writes some option'],
			['an option handed on through two functions', 'g <- function(...) options(...)\nh <- function(...) g(...)\nh(digits = 3)' + ok, 3, ['#option:digits'], 'the dots stand for any option while the graph is built, so it writes some option'],
			['an option handed on by a recursive function', 'g <- function(n, ...) if(n > 0) g(n - 1, ...) else options(...)\ng(2, digits = 3)' + ok, 2, ['#option:digits'], 'the dots stand for any option while the graph is built, so it writes some option'],
			['an option a flag handed on switches on', 'g <- function(set = FALSE) if(set) options(digits = 3)\nh <- function(...) g(...)\nh(set = TRUE)' + ok, 3, ['#option:digits']],
			['an environment variable handed on through the dots', 'g <- function(...) Sys.setenv(...)\ng(FLOWR_T = "1")' + env, 2, ['#env:FLOWR_T'], 'the dots stand for any variable while the graph is built, so it writes some variable'],
			['an option handed on through do.call of the dots', 'g <- function(...) do.call(options, list(...))\ng(digits = 3)' + ok, 2, ['#option:digits'], 'the dots stand for any option while the graph is built, so it writes some option']
		];
		for(const [name, code, line, writes, imprecise] of own) {
			writesLikeR(parser, name, code, line, writes, imprecise === undefined ? {} : { imprecise });
		}
	});
}));
