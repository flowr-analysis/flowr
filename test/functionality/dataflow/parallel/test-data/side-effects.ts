import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import type { AnalyzerSetupFunction } from './types';

/**
 * Side-effect focused test data
 *
 * These tests focus on super-assignment side effects,
 * cascading writes, and side effects across file boundaries.
 */
export const ClosureWithSuperAssignment: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'counter <- 0' });
	analyzer.addRequest({ request: 'text', content: 'increment <- function() { counter <<- counter + 1; counter }' });
	analyzer.addRequest({ request: 'text', content: 'v1 <- increment()' });
	analyzer.addRequest({ request: 'text', content: 'v2 <- increment()' });
	analyzer.addRequest({ request: 'text', content: 'print(counter)' });
	return analyzer;
};

export const NestedClosuresWithSideEffects: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'state <- 0' });
	analyzer.addRequest({
		request: 'text',
		content: 'outer <- function(x) {\n  inner <- function(y) {\n    state <<- state + x + y\n  }\n  inner\n}'
	});
	analyzer.addRequest({ request: 'text', content: 'fn1 <- outer(5)' });
	analyzer.addRequest({ request: 'text', content: 'fn1(3)' });
	analyzer.addRequest({ request: 'text', content: 'fn1(2)' });
	analyzer.addRequest({ request: 'text', content: 'result <- state' });
	return analyzer;
};

export const CascadingSideEffects: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'globalState <- list()' });
	analyzer.addRequest({ request: 'text', content: 'setA <- function(val) { globalState$a <<- val }' });
	analyzer.addRequest({ request: 'text', content: 'setB <- function(val) { globalState$b <<- val; setA(val * 2) }' });
	analyzer.addRequest({ request: 'text', content: 'setC <- function(val) { globalState$c <<- val; setB(val * 3) }' });
	analyzer.addRequest({ request: 'text', content: 'setC(5)' });
	analyzer.addRequest({ request: 'text', content: 'print(globalState)' });
	return analyzer;
};

export const SourceWithClosureAndSideEffect: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('closure_lib.R', 'globalCounter <- 0\ngetCounter <- function() { globalCounter }'));
	analyzer.addRequest({ request: 'text', content: 'source("closure_lib.R")' });
	analyzer.addRequest({ request: 'text', content: 'globalCounter <<- 10' });
	analyzer.addRequest({ request: 'text', content: 'val <- getCounter()' });
	return analyzer;
};

export const SourceChainWithClosure: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('base.R', 'baseVar <- 42\ncreateFunc <- function() { function() { baseVar } }'));
	analyzer.addFile(new FlowrInlineTextFile('middle.R', 'source("base.R")\nmyFunc <- createFunc()'));
	analyzer.addRequest({ request: 'text', content: 'source("middle.R")\nresult <- myFunc()\nbaseVar <<- 100\nresult2 <- myFunc()' });
	return analyzer;
};

export const MultipleClosuresCapturingSameVar: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'shared <- 5' });
	analyzer.addRequest({ request: 'text', content: 'fn1 <- function() { shared }' });
	analyzer.addRequest({ request: 'text', content: 'fn2 <- function() { shared }' });
	analyzer.addRequest({ request: 'text', content: 'fn3 <- function() { shared <<- shared + 1 }' });
	analyzer.addRequest({ request: 'text', content: 'fn3()' });
	analyzer.addRequest({ request: 'text', content: 'a <- fn1()\nb <- fn2()' });
	return analyzer;
};

export const ConditionalSideEffectAcrossFiles: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'flag <- TRUE' });
	analyzer.addRequest({ request: 'text', content: 'globalVar <- 0' });
	analyzer.addRequest({ request: 'text', content: 'if (flag) { globalVar <<- 100 } else { globalVar <<- 200 }' });
	analyzer.addRequest({ request: 'text', content: 'result <- globalVar' });
	return analyzer;
};

export const LoopWithSideEffect: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'results <- c()' });
	analyzer.addRequest({ request: 'text', content: 'for (i in 1:5) { results <<- c(results, i * 2) }' });
	analyzer.addRequest({ request: 'text', content: 'print(results)' });
	return analyzer;
};

export const FunctionModifyingExternalState: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'db <- list(records = 0, values = c())' });
	analyzer.addRequest({ request: 'text', content: 'addRecord <- function(val) { db$records <<- db$records + 1; db$values <<- c(db$values, val) }' });
	analyzer.addRequest({ request: 'text', content: 'addRecord(10)' });
	analyzer.addRequest({ request: 'text', content: 'addRecord(20)' });
	analyzer.addRequest({ request: 'text', content: 'print(db)' });
	return analyzer;
};

export const RecursiveClosureWithSideEffect: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'callStack <- c()' });
	analyzer.addRequest({
		request: 'text',
		content: 'factorial <- function(n) {\n  callStack <<- c(callStack, n)\n  if (n <= 1) 1 else n * factorial(n - 1)\n}'
	});
	analyzer.addRequest({ request: 'text', content: 'result <- factorial(4)' });
	analyzer.addRequest({ request: 'text', content: 'print(callStack)' });
	return analyzer;
};

export const CycleDetectionWithSideEffects: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'a <- function() { globalCounter <<- globalCounter + 1; if (globalCounter < 10) b() }' });
	analyzer.addRequest({ request: 'text', content: 'b <- function() { globalCounter <<- globalCounter + 1; if (globalCounter < 10) a() }' });
	analyzer.addRequest({ request: 'text', content: 'globalCounter <- 0' });
	analyzer.addRequest({ request: 'text', content: 'a()' });
	return analyzer;
};

export const SourceFileWithSideEffect: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('sideEffect.R', 'loadedCount <<- if (exists("loadedCount")) loadedCount + 1 else 1'));
	analyzer.addRequest({ request: 'text', content: 'loadedCount <- 0\nsource("sideEffect.R")\nsource("sideEffect.R")\nprint(loadedCount)' });
	return analyzer;
};

export const ClosureWithMultipleSuperAssignments: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 0\ny <- 0' });
	analyzer.addRequest({
		request: 'text',
		content: 'updateBoth <- function(dx, dy) { x <<- x + dx; y <<- y + dy }'
	});
	analyzer.addRequest({ request: 'text', content: 'updateBoth(5, 10)' });
	analyzer.addRequest({ request: 'text', content: 'updateBoth(3, 7)' });
	analyzer.addRequest({ request: 'text', content: 'result <- c(x, y)' });
	return analyzer;
};

export const SourceWithMultipleSideEffects: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('multi_se.R', 'globalA <<- 10\nglobalB <<- globalA + 5\nf <- function() { globalA + globalB }'));
	analyzer.addRequest({ request: 'text', content: 'globalA <- 0\nglobalB <- 0\nsource("multi_se.R")\nresult <- f()' });
	return analyzer;
};
