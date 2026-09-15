import { describe } from 'vitest';
import { IncrementalMutationType } from '../../util/incremental/dataflow-graph/incremental-mutations';
import { assertIncrementalDataflowGraphMatches } from '../../_helper/shell';

const singleFile = {
	'script.R': `x <- 1
y <- 2
print(x + y)`
};

const singleFileMutations = [
	IncrementalMutationType.AddLastLine,
	IncrementalMutationType.DeleteLastLine,
	IncrementalMutationType.DeleteRandomLine,
	IncrementalMutationType.DuplicateRandomLine,
	IncrementalMutationType.NoOp,
	IncrementalMutationType.AddComment,
	IncrementalMutationType.AddWhitespace
];

const multiFileMutations = [
	IncrementalMutationType.AddSourcedFile,
	IncrementalMutationType.RemoveSourcedFile
];

const multiFile = {
	'main.R': `x <- 1
print(x)
source("sourced.R")`,
	'sourced.R': `sourced_value <- 42
sourced_fn <- function() sourced_value`
};

describe('incremental dataflow (single file, exact type, :dataflow)', () => {
	assertIncrementalDataflowGraphMatches(singleFile, { allowedMutations: [...singleFileMutations, ...multiFileMutations ], strict: true, oracle: ':dataflow' });
});

describe('incremental dataflow (single file, allow fallback to Full, :dataflow)', () => {
	assertIncrementalDataflowGraphMatches(singleFile, { allowedMutations: [...singleFileMutations, ...multiFileMutations], strict: false, oracle: ':dataflow' });
});

describe('incremental dataflow (multiple files, allow fallback to Full, :dataflow)', () => {
	assertIncrementalDataflowGraphMatches(multiFile, { allowedMutations: [
		IncrementalMutationType.AddSourcedFile,
		IncrementalMutationType.RemoveSourcedFile
	], strict: false, oracle: ':dataflow' });
});

describe('incremental dataflow (multiple files, exact type, :dataflow)', () => {
	assertIncrementalDataflowGraphMatches(multiFile, { allowedMutations: [], strict: true, oracle: ':dataflow' });
});

describe('incremental dataflow (single file, exact type, query:dataflow)', () => {
	assertIncrementalDataflowGraphMatches(singleFile, { allowedMutations: [...singleFileMutations, ...multiFileMutations], strict: true, oracle: 'query:dataflow' });
});

describe('incremental dataflow (single file, allow fallback to Full, query:dataflow)', () => {
	assertIncrementalDataflowGraphMatches(singleFile, { allowedMutations: [...singleFileMutations, ...multiFileMutations], strict: false, oracle: 'query:dataflow' });
});
