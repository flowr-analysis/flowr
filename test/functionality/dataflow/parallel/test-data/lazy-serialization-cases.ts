import { FlowrInlineTextFile } from '../../../../../src/project/context/flowr-file';
import type { AnalyzerSetupFunction } from './types';
import type { TestSuite } from './test-suites';

const SingleFileUsedAndUnusedFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
unused <- function(x) {
  x + 1
}

used <- function(y) {
  y * 2
}

result <- used(5)
`
	});
	return analyzer;
};

const NestedUnusedFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({
		request: 'text',
		content: `
outer <- function(v) {
  helper <- function(z) {
    z + 10
  }
  v * 2
}

result <- outer(3)
`
	});
	return analyzer;
};

const MultiFileUnusedFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addRequest({ request: 'text', content: 'a <- 1' });
	analyzer.addRequest({
		request: 'text',
		content: `
unused <- function(k) {
  k + a
}

used <- function(m) {
  m * a
}

out <- used(4)
`
	});
	return analyzer;
};

const SourceWithUnusedFunction: AnalyzerSetupFunction = (analyzer) => {
	analyzer.addFile(new FlowrInlineTextFile('lazy-source-lib.R', `
lib_unused <- function(p) {
  p - 1
}

lib_used <- function(q) {
  q + 2
}
`));
	analyzer.addRequest({
		request: 'text',
		content: `
source("lazy-source-lib.R")
res <- lib_used(5)
`
	});
	return analyzer;
};

export const lazySerializationPreservationTests: TestSuite = [
	{ name: 'SingleFileUsedAndUnusedFunction', setup: SingleFileUsedAndUnusedFunction },
	{ name: 'NestedUnusedFunction', setup: NestedUnusedFunction },
	{ name: 'MultiFileUnusedFunction', setup: MultiFileUnusedFunction }
];

export const lazySerializationSourceTests: TestSuite = [
	{ name: 'SourceWithUnusedFunction', setup: SourceWithUnusedFunction }
];
