import type { AnalyzerSetupFunction } from './types';

/**
 * Combined cascading side-effects and builtin redefinition test data.
 */
export const CascadingSetterWithRedefinedMultiply: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: '`*` <- function(a, b) { a + b }' });
	analyzer.addRequest({ request: 'text', content: 'state <- list(a = 0, b = 0, c = 0)' });
	analyzer.addRequest({ request: 'text', content: 'setA <- function(v) { state$a <<- v }' });
	analyzer.addRequest({ request: 'text', content: 'setB <- function(v) { state$b <<- v; setA(v * 2) }' });
	analyzer.addRequest({ request: 'text', content: 'setC <- function(v) { state$c <<- v; setB(v * 3) }' });
	analyzer.addRequest({ request: 'text', content: 'setC(5)' });
	return analyzer;
};

export const CascadingLoggerWithRedefinedPrint: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'events <- c()' });
	analyzer.addRequest({ request: 'text', content: 'print <- function(...) { events <<- c(events, paste(...)); invisible(NULL) }' });
	analyzer.addRequest({ request: 'text', content: 'pushA <- function(x) { print("A", x) }' });
	analyzer.addRequest({ request: 'text', content: 'pushB <- function(x) { print("B", x); pushA(x + 1) }' });
	analyzer.addRequest({ request: 'text', content: 'pushC <- function(x) { print("C", x); pushB(x + 2) }' });
	analyzer.addRequest({ request: 'text', content: 'pushC(1)' });
	analyzer.addRequest({ request: 'text', content: 'result <- events' });
	return analyzer;
};

export const ClosureCascadeWithRedefinedPlus: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: '`+` <- function(a, b) { a * b }' });
	analyzer.addRequest({ request: 'text', content: 'acc <- 1' });
	analyzer.addRequest({ request: 'text', content: 'mk <- function(seed) { function(v) { acc <<- acc + (seed + v); acc } }' });
	analyzer.addRequest({ request: 'text', content: 'f <- mk(2)' });
	analyzer.addRequest({ request: 'text', content: 'v1 <- f(3)' });
	analyzer.addRequest({ request: 'text', content: 'v2 <- f(4)' });
	return analyzer;
};
