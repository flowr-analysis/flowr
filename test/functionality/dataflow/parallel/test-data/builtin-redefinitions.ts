import type { AnalyzerSetupFunction } from './types';

/**
 * Parallelization side-effect focused test data.
 *
 * These scenarios redefine built-in features and indicate whether a
 * fallback re-analysis is expected once the redefinition is used.
 */
export const RedefinedPrintUsedAcrossFiles: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'print <- function(...) { 7 }' });
	analyzer.addRequest({ request: 'text', content: 'x <- 1' });
	analyzer.addRequest({ request: 'text', content: 'print(x)' });
	return analyzer;
};

export const RedefinedPlusUsedAcrossFiles: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: '`+` <- function(a, b) { a - b }' });
	analyzer.addRequest({ request: 'text', content: 'x <- 5' });
	analyzer.addRequest({ request: 'text', content: 'y <- x + 2' });
	return analyzer;
};

export const RedefinedPrintNotUsedAcrossFiles: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'print <- function(...) { 7 }' });
	analyzer.addRequest({ request: 'text', content: 'x <- 1' });
	analyzer.addRequest({ request: 'text', content: 'y <- x + 2' });
	return analyzer;
};

export const BuiltinUsedWithoutRedefinitionAcrossFiles: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 1' });
	analyzer.addRequest({ request: 'text', content: 'print(x)' });
	return analyzer;
};
