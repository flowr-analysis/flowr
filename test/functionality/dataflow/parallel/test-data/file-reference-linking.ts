import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import type { AnalyzerSetupFunction } from './types';

/**
 * File reference linking focused test data.
 *
 * These tests exercise source chains and cross-file symbol usage to verify
 * references are linked to the correct file-provided definitions.
 */
export const DirectSourceLinking: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('constants.R', 'PI <- 3.14'));
	analyzer.addRequest({ request: 'text', content: 'source("constants.R")\nr <- 2\narea <- PI * r * r' });
	return analyzer;
};

export const ChainedSourceLinking: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('defs.R', 'base <- 7'));
	analyzer.addFile(new FlowrInlineTextFile('bridge.R', 'source("defs.R")\nvalue <- base + 1'));
	analyzer.addRequest({ request: 'text', content: 'source("bridge.R")\nresult <- value * 3' });
	return analyzer;
};

export const FunctionReferenceThroughSource: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('math.R', 'add <- function(a, b) { a + b }'));
	analyzer.addFile(new FlowrInlineTextFile('pipeline.R', 'source("math.R")\nrun <- function(x) { add(x, 2) }'));
	analyzer.addRequest({ request: 'text', content: 'source("pipeline.R")\nout <- run(5)' });
	return analyzer;
};

export const SourceOrderOverridesReference: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('defaults.R', 'threshold <- 5'));
	analyzer.addFile(new FlowrInlineTextFile('override.R', 'threshold <- 10'));
	analyzer.addRequest({ request: 'text', content: 'source("defaults.R")\nsource("override.R")\nresult <- threshold + 1' });
	return analyzer;
};

export const SourceInsideHelperFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('helpers.R', 'helper <- function(v) { v * 4 }'));
	analyzer.addRequest({ request: 'text', content: 'load <- function() { source("helpers.R") }\nload()\nresult <- helper(3)' });
	return analyzer;
};
