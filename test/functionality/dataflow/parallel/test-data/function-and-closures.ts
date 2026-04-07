import type { AnalyzerSetupFunction } from './types';

/**
 * Standard function and closure focused test data.
 *
 * These cases avoid super-assignment side effects and are meant to verify
 * stable lexical scoping and higher-order function behavior.
 */
export const ClosureWithCapture: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 10' });
	analyzer.addRequest({ request: 'text', content: 'makeAdder <- function(n) { function(y) { y + n } }' });
	analyzer.addRequest({ request: 'text', content: 'add5 <- makeAdder(5)' });
	analyzer.addRequest({ request: 'text', content: 'result <- add5(x)' });
	return analyzer;
};

export const FunctionCallingFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'add <- function(a, b) { a + b }' });
	analyzer.addRequest({ request: 'text', content: 'applyTwice <- function(f, x) { f(f(x, 1), 1) }' });
	analyzer.addRequest({ request: 'text', content: 'result <- applyTwice(add, 3)' });
	return analyzer;
};

export const ClosureFactoryWithMultipleInstances: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'factory <- function(offset) { function(v) { v + offset } }' });
	analyzer.addRequest({ request: 'text', content: 'plus2 <- factory(2)' });
	analyzer.addRequest({ request: 'text', content: 'plus5 <- factory(5)' });
	analyzer.addRequest({ request: 'text', content: 'a <- plus2(10)\nb <- plus5(10)' });
	return analyzer;
};

export const NestedFunctionShadowing: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 100' });
	analyzer.addRequest({ request: 'text', content: 'outer <- function(x) { inner <- function(y) { x + y }; inner }' });
	analyzer.addRequest({ request: 'text', content: 'fn <- outer(3)' });
	analyzer.addRequest({ request: 'text', content: 'result <- fn(4)' });
	return analyzer;
};

export const ClosureCapturingUpdatedBinding: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'outer <- 1' });
	analyzer.addRequest({ request: 'text', content: 'f <- function() { outer }' });
	analyzer.addRequest({ request: 'text', content: 'outer <- 2' });
	analyzer.addRequest({ request: 'text', content: 'result <- f()' });
	return analyzer;
};

export const HigherOrderFunctionComposition: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'double <- function(x) { x * 2 }' });
	analyzer.addRequest({ request: 'text', content: 'inc <- function(x) { x + 1 }' });
	analyzer.addRequest({ request: 'text', content: 'compose <- function(f, g) { function(v) { f(g(v)) } }' });
	analyzer.addRequest({ request: 'text', content: 'f <- compose(double, inc)\nresult <- f(10)' });
	return analyzer;
};
