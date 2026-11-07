import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { writesLikeR } from './transitivity';

const ok = '\nif(getOption("digits") == 3) cat("ok")';
const env = '\nif(Sys.getenv("A") == "1") cat("ok")';
/**
 * Global state written through calls flowR has to follow (higher-order functions, `do.call`, `eval`, dispatch, ...),
 * each checked against what R leaves changed.
 */
describe('Ambient writes through indirect calls, checked against R', withTreeSitter(parser => {
	const cases: [string, string, number, string[], string?][] = [
		['Map', 'invisible(Map(function(f) f(), list(function() options(digits = 3))))' + ok, 1, ['#option:digits']],
		['do.call string', 'do.call("options", list(digits = 3))' + ok, 1, ['#option:digits'], 'the call target is a string, so flowR writes any option'],
		['do.call fn', 'do.call(options, list(digits = 3))' + ok, 1, ['#option:digits'], 'the arguments are a list, so flowR writes any option'],
		['eval parse', 'eval(parse(text = "options(digits = 3)"))' + ok, 1, ['#option:digits']],
		['eval quote', 'eval(quote(options(digits = 3)))' + ok, 1, ['#option:digits']],
		['local', 'local({ options(digits = 3) })' + ok, 1, ['#option:digits']],
		['on.exit', 'f <- function() { on.exit(options(digits = 3)); 1 }\nf()' + ok, 2, ['#option:digits']],
		['sapply setenv', 'invisible(sapply(1, function(i) Sys.setenv(A = "1")))' + env, 1, ['#env:A']],
		['options list', 'options(list(digits = 3))' + ok, 1, ['#option:digits'], 'the options are given as one list, so flowR writes any option'],
		['options var', 'o <- list(digits = 3)\noptions(o)' + ok, 2, ['#option:digits'], 'the options are given as a variable, so flowR writes any option'],
		['Filter', 'invisible(Filter(function(x) { options(digits = 3); TRUE }, 1))' + ok, 1, ['#option:digits']],
		['list of fns $', 'fs <- list(a = function() options(digits = 3))\nfs$a()' + ok, 2, ['#option:digits']],
		['list of fns [[', 'fs <- list(a = function() options(digits = 3))\nfs[["a"]]()' + ok, 2, ['#option:digits']],
		['get options', 'get("options")(digits = 3)' + ok, 1, ['#option:digits']],
		['match.fun options', 'match.fun("options")(digits = 3)' + ok, 1, ['#option:digits']],
		['iife', '(function() options(digits = 3))()' + ok, 1, ['#option:digits']],
		['dots to options', 'f <- function(...) options(...)\nf(digits = 3)' + ok, 2, ['#option:digits'], 'the options are handed on as dots, so flowR writes any option'],
		['mapply setenv', 'invisible(mapply(function(n, v) do.call(Sys.setenv, setNames(list(v), n)), "A", "1"))' + env, 1, ['#env:A'], 'the name comes from setNames, so flowR writes any variable'],
		['switch numeric', 'f <- function() switch(2, 1, options(digits = 3))\nf()' + ok, 2, ['#option:digits']],
		['vapply if', 'invisible(vapply(1, function(i) { if(i > 0) options(digits = 3); 1 }, 1))' + ok, 1, ['#option:digits']],
		['Reduce accumulate', 'invisible(Reduce(function(a, b) { options(digits = 3); a + b }, 1:3, accumulate = TRUE))' + ok, 1, ['#option:digits']],
		['tryCatch finally', 'tryCatch(stop("x"), error = function(e) 1, finally = options(digits = 3))' + ok, 1, ['#option:digits']],
		['withCallingHandlers', 'withCallingHandlers(warning("w"), warning = function(w) { options(digits = 3); invokeRestart("muffleWarning") })' + ok, 1, ['#option:digits']],
		['Recall', 'f <- function(n) if(n > 0) Recall(n - 1) else options(digits = 3)\nf(2)' + ok, 2, ['#option:digits']],
		['fn from fn', 'mk <- function() function() options(digits = 3)\nmk()()' + ok, 2, ['#option:digits']],
		['assign fn', 'assign("h", function() options(digits = 3))\nh()' + ok, 2, ['#option:digits']],
		['env fn', 'e <- new.env()\ne$h <- function() options(digits = 3)\ne$h()' + ok, 3, ['#option:digits']],
		['S3 method', 'p <- function(x) UseMethod("p")\np.a <- function(x) options(digits = 3)\np(structure(1, class = "a"))' + ok, 3, ['#option:digits']],
		['R5 replacement', '`f<-` <- function(x, value) { options(digits = value); x }\nx <- 1\nf(x) <- 3' + ok, 3, ['#option:digits']],
		['pipe', 'h <- function(d) options(digits = d)\n3 |> h()' + ok, 2, ['#option:digits']],
		['sys.function', 'f <- function(n) { if(n == 0) options(digits = 3) else sys.function()(n - 1) }\nf(1)' + ok, 2, ['#option:digits']],
		['setNames do.call', 'do.call(options, setNames(list(3), "digits"))' + ok, 1, ['#option:digits'], 'the names come from setNames, so flowR writes any option'],
		['Sys.setenv list', 'do.call(Sys.setenv, list(A = "1"))' + env, 1, ['#env:A'], 'the variables are given as a list, so flowR writes any variable'],
		['replicate', 'invisible(replicate(1, options(digits = 3)))' + ok, 1, ['#option:digits']],
		['outer fun', 'invisible(outer(1, 1, function(x, y) { options(digits = 3); x }))' + ok, 1, ['#option:digits']],
		['apply', 'invisible(apply(matrix(1), 1, function(r) options(digits = 3)))' + ok, 1, ['#option:digits']],
		['tapply', 'invisible(tapply(1, 1, function(r) options(digits = 3)))' + ok, 1, ['#option:digits']],
		['environment eval', 'e <- new.env()\neval(quote(options(digits = 3)), e)' + ok, 2, ['#option:digits']],
		['evalq', 'evalq(options(digits = 3), new.env())' + ok, 1, ['#option:digits']],
		['with', 'with(list(d = 3), options(digits = d))' + ok, 1, ['#option:digits']],
		['eval parse in fn', 'f <- function() eval(parse(text = "options(digits = 3)"))\nf()' + ok, 2, ['#option:digits']],
		['eval str2lang', 'eval(str2lang("options(digits = 3)"))' + ok, 1, ['#option:digits']],
		['eval parse var', 'x <- "options(digits = 3)"\neval(parse(text = x))' + ok, 2, ['#option:digits']],
		['eval parse two', 'eval(parse(text = "y <- 1; options(digits = 3)"))' + ok, 1, ['#option:digits']]
	];
	for(const [name, code, line, writes, imprecise] of cases) {
		writesLikeR(parser, name, code, line, writes, imprecise === undefined ? {} : { imprecise });
	}
}));
