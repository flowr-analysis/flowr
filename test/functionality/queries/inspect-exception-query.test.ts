import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { testAnyCase, testEachCase } from '../_helper/query';

describe('Inspect Exception Query', withTreeSitter(parser => {
	const mayThrow = (points: readonly unknown[]) => points.length > 0;
	/** Whether the query says any of the program's function definitions may throw. */
	const testExceptions = testAnyCase(parser, 'inspect-exception', r => r.exceptions, mayThrow);

	testExceptions('a stop throws', 'f <- function() stop("x")', true);
	testExceptions('so does one its callee makes', 'g <- function() stop("x")\nf <- function() g()', true);
	testExceptions('a conditional one throws too', 'f <- function() if(runif(1) > .5) stop("x")', true);
	testExceptions('an assertion throws when it fails', 'f <- function(x) stopifnot(x > 0)', true);
	testExceptions('a caught error does not leave the function', 'f <- function() tryCatch(stop("x"), error = function(e) NULL)', false);
	testExceptions('nor does one wrapped in try', 'f <- function() try(stop("x"))', false);
	testExceptions('a warning is no exception', 'f <- function() warning("x")', false);

	/** Whether the query says each definition of the program may throw, keyed by the definition as it is written. */
	const testEachException = testEachCase(parser, 'inspect-exception', r => r.exceptions, mayThrow);

	/* a guard around a call guards what the call raises, just as it does what is written in its place */
	testEachException('tryCatch around a call to a thrower', 'f <- function() stop("x")\ng <- function() tryCatch(f(), error = function(e) 0)', {
		'function() stop("x")':                            true,
		'function(e) 0':                                   false,
		'function() tryCatch(f(), error = function(e) 0)': false
	});
	testEachException('try around a call to a thrower', 'f <- function() stop("x")\ng <- function() try(f(), silent = TRUE)', {
		'function() stop("x")':               true,
		'function() try(f(), silent = TRUE)': false
	});
	testEachException('a handler that cannot catch it leaves the call alone', 'f <- function() stop("x")\ng <- function() tryCatch(f(), warning = function(w) 0)', {
		'function() stop("x")':                              true,
		'function(w) 0':                                     false,
		'function() tryCatch(f(), warning = function(w) 0)': true
	});
	testEachException('an unguarded call next to a guarded one still throws', 'f <- function() stop("x")\ng <- function() { f(); tryCatch(f(), error = function(e) 0) }', {
		'function() stop("x")':                                     true,
		'function(e) 0':                                            false,
		'function() { f(); tryCatch(f(), error = function(e) 0) }': true
	});
	testEachException('a handler raising through a call throws in turn', 'f <- function() stop("x")\ng <- function() tryCatch(0, error = function(e) f())', {
		'function() stop("x")':                            true,
		'function(e) f()':                                 true,
		'function() tryCatch(0, error = function(e) f())': true
	});

	/* a handler catches an error only when it is named for a class the error carries */
	testEachException('interrupt catches no error', 'f <- function() tryCatch(stop("q"), interrupt = function(e) 0)', {
		'function(e) 0':                                             false,
		'function() tryCatch(stop("q"), interrupt = function(e) 0)': true
	});
	testEachException('nor does warning', 'f <- function() tryCatch(stop("x"), warning = function(w) 0)', {
		'function(w) 0':                                           false,
		'function() tryCatch(stop("x"), warning = function(w) 0)': true
	});
	testEachException('nor a class of the caller\'s own', 'f <- function() tryCatch(stop("x"), myCondition = function(e) 0)', {
		'function(e) 0':                                               false,
		'function() tryCatch(stop("x"), myCondition = function(e) 0)': true
	});
	testEachException('finally never catches', 'f <- function() tryCatch(stop("x"), finally = print(1))', {
		'function() tryCatch(stop("x"), finally = print(1))': true
	});
	testEachException('condition catches everything', 'f <- function() tryCatch(stop("x"), condition = function(e) 0)', {
		'function(e) 0':                                             false,
		'function() tryCatch(stop("x"), condition = function(e) 0)': false
	});
	testEachException('so does the class stop raises', 'f <- function() tryCatch(stop("x"), simpleError = function(e) 0)', {
		'function(e) 0':                                               false,
		'function() tryCatch(stop("x"), simpleError = function(e) 0)': false
	});
	testEachException('withCallingHandlers hands the error on', 'f <- function() withCallingHandlers(stop("x"), error = function(e) 0)', {
		'function(e) 0':                                                    false,
		'function() withCallingHandlers(stop("x"), error = function(e) 0)': true
	});
	testEachException('a handler that rethrows throws', 'f <- function() tryCatch(stop("x"), error = function(e) stop("re"))', {
		'function(e) stop("re")':                                         true,
		'function() tryCatch(stop("x"), error = function(e) stop("re"))': true
	});
	testEachException('a finally that throws throws', 'f <- function() tryCatch(1, finally = stop("f"))', {
		'function() tryCatch(1, finally = stop("f"))': true
	});
}));
