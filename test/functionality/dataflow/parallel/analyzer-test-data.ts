import { FlowrInlineTextFile } from '../../../../src/project/context/flowr-file';
import type { FlowrAnalyzer } from '../../../../src/project/flowr-analyzer';


export type AnalyzerSetupFunction = (analyzer: FlowrAnalyzer) => FlowrAnalyzer;


/**
 * Simple Analysis Tests Data
 */

export const SingleFile: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 3' });
	return analyzer;
};

export const MultiFile: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 3' });
	analyzer.addRequest({ request: 'text', content: 'y <- 2\n print(y)' });
	analyzer.addRequest({ request: 'text', content: 'z <- x + 1\n print(z)' });
	return analyzer;
};

export const MultiDef: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 2' });
	analyzer.addRequest({ request: 'text', content: 'x' });
	analyzer.addRequest({ request: 'text', content: 'x <- 3' });
	analyzer.addRequest({ request: 'text', content: 'x' });
	return analyzer;
};

/**
 * More Complex Analysis Test Data
 */

export const ComplexVariableChains: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 5' });
	analyzer.addRequest({ request: 'text', content: 'y <- x * 2' });
	analyzer.addRequest({ request: 'text', content: 'z <- y + 1' });
	analyzer.addRequest({ request: 'text', content: 'print(z)' });
	return analyzer;
};

export const MultipleUsages: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'CONST <- 42' });
	analyzer.addRequest({ request: 'text', content: 'a <- CONST + 1' });
	analyzer.addRequest({ request: 'text', content: 'b <- CONST * 2' });
	analyzer.addRequest({ request: 'text', content: 'result <- a + b' });
	return analyzer;
};

export const FunctionDefinition: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'add <- function(a, b) { a + b }' });
	analyzer.addRequest({ request: 'text', content: 'result <- add(3, 4)' });
	analyzer.addRequest({ request: 'text', content: 'print(result)' });
	return analyzer;
};

export const ConditionalDefinitions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'flag <- readline()' });
	analyzer.addRequest({ request: 'text', content: 'if (flag) { x <- 10 } else { x <- 20 }' });
	analyzer.addRequest({ request: 'text', content: 'y <- x + 5' });
	return analyzer;
};

export const LoopsWithCrossFile: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'data <- readline()' });
	analyzer.addRequest({ request: 'text', content: 'sum <- 0\nfor (val in data) { sum <- sum + val }' });
	analyzer.addRequest({ request: 'text', content: 'print(sum)' });
	return analyzer;
};

export const VariableShadowing: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'x <- 10' });
	analyzer.addRequest({ request: 'text', content: 'x <- 20' });
	analyzer.addRequest({ request: 'text', content: 'y <- x * 2' });
	return analyzer;
};

export const NestedFunctions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'outer <- function(a) { inner <- function(b) { a + b } ; inner }' });
	analyzer.addRequest({ request: 'text', content: 'fn <- outer(5)' });
	analyzer.addRequest({ request: 'text', content: 'result <- fn(3)' });
	return analyzer;
};

/**
 * Source Based Analysis Test Data
 */

const SourceSimple: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('lib.R', 'helper <- function(x) { x * 2 }'));
	analyzer.addRequest({ request: 'text', content: 'source("lib.R")\nresult <- helper(5)' });
	return analyzer;
};

const SourceMultiple: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('config.R', 'DEBUG <- TRUE\nVERSION <- "1.0"'));
	analyzer.addFile(new FlowrInlineTextFile('utils.R', 'source("config.R")\nlog <- function(msg) { if (DEBUG) print(msg) }'));
	analyzer.addRequest({ request: 'text', content: 'source("utils.R")\nlog("Hello")' });
	return analyzer;
};

const SourceWithDefinitions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('module.R', 'module_var <- 42\nmodule_func <- function(x) { module_var + x }'));
	analyzer.addRequest({
		request: 'text',
		content: 'source("module.R")\ny <- module_var\nz <- module_func(10)\nprint(z)'
	});
	return analyzer;
};

const SourceChain: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('level1.R', 'x <- 1'));
	analyzer.addFile(new FlowrInlineTextFile('level2.R', 'source("level1.R")\ny <- x + 1'));
	analyzer.addRequest({
		request: 'text',
		content: 'source("level2.R")\nz <- y * 2\nprint(z)'
	});
	return analyzer;
};

const SourceWithConditional: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('optional.R', 'optional_var <- 99'));
	analyzer.addRequest({
		request: 'text',
		content: 'if (TRUE) { source("optional.R") }\nresult <- optional_var + 1\nprint(result)'
	});
	return analyzer;
};

/**
 * Active Dependencies and Side Effect based tests
 */
export const ConstConditionalDefinitions: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'flag <- TRUE' });
	analyzer.addRequest({ request: 'text', content: 'if (flag) { x <- 10 } else { x <- 20 }' });
	analyzer.addRequest({ request: 'text', content: 'y <- x + 5' });
	return analyzer;
};

export const ConstLoopsWithCrossFile: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'data <- c(1, 2, 3)' });
	analyzer.addRequest({ request: 'text', content: 'sum <- 0\nfor (val in data) { sum <- sum + val }' });
	analyzer.addRequest({ request: 'text', content: 'print(sum)' });
	return analyzer;
};

/**
 * Collections of Analysis Test Cases
 */

export interface NamedTestCase {
    name:  string;
    setup: AnalyzerSetupFunction;
}

export type AnalyzerSetupCluster = NamedTestCase[];

export const simpleDataflowTests: AnalyzerSetupCluster = [
	{ name: 'SingleFile', setup: SingleFile },
	{ name: 'MultiDef', setup: MultiDef },
	{ name: 'MultiFile', setup: MultiFile }
];

export const complexDataflowTests: AnalyzerSetupCluster = [
	{ name: 'ComplexVariableChains', setup: ComplexVariableChains },
	{ name: 'MultipleUsages', setup: MultipleUsages },
	{ name: 'FunctionDefinition', setup: FunctionDefinition },
	{ name: 'ConditionalDefinitions', setup: ConditionalDefinitions },
	{ name: 'LoopsWithCrossFile', setup: LoopsWithCrossFile },
	{ name: 'VariableShadowing', setup: VariableShadowing },
	{ name: 'NestedFunctions', setup: NestedFunctions }
];

export const sourceBasedDataflowTests: AnalyzerSetupCluster = [
	{ name: 'SourceSimple', setup: SourceSimple },
	{ name: 'SourceMultiple', setup: SourceMultiple },
	{ name: 'SourceWithDefinitions', setup: SourceWithDefinitions },
	{ name: 'SourceChain', setup: SourceChain },
	{ name: 'SourceWithConditional', setup: SourceWithConditional }
];