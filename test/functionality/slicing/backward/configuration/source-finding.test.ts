import { assert, describe, test } from 'vitest';
import {
	findSource
} from '../../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import { type FlowrLaxSourcingOptions , DropPathsOption, InferWorkingDirectory, } from '../../../../../src/config';
import path from 'path';
import { contextFromSources } from '../../../../../src/project/context/flowr-analyzer-context';

describe('source finding', () => {
	const ctx = contextFromSources({
		'a.txt':                                       'N <- 9',
		[`a${path.sep}b.txt`]:                         'f <- function() { function() 3 }',
		'c.txt':                                       'f <- function() { x <<- 3 }',
		[`x${path.sep}y${path.sep}z${path.sep}b.txt`]: 'x <- 3',
		[`x${path.sep}y${path.sep}b.txt`]:             'x <- 3',
		'with-spaces.txt':                             'x <- 3',
	});

	function assertSourceFound(path: string, shouldBe: string[], referenceChain: readonly (string | undefined)[] = []) {
		test(`finds source for ${path}`, () => {
			const resolveSource: FlowrLaxSourcingOptions = {
				dropPaths:             DropPathsOption.All,
				ignoreCapitalization:  true,
				inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
				searchPath:            [],
				applyReplacements:     [
					{ },
					{ ' ': '-' }
				]
			};
			const result = findSource(resolveSource, path, { referenceChain, ctx });
			assert.deepStrictEqual(result, shouldBe);
		});
	}

	assertSourceFound('a.txt', ['a.txt']);
	assertSourceFound('c.txt', ['c.txt']);
	assertSourceFound('b.txt', [`a${path.sep}b.txt`], [`a${path.sep}x.txt`]);
	assertSourceFound('b.txt', [`x${path.sep}y${path.sep}z${path.sep}b.txt`], [`x${path.sep}y${path.sep}z${path.sep}g.txt`]);
	assertSourceFound(`..${path.sep}b.txt`, [`x${path.sep}y${path.sep}b.txt`, `x${path.sep}y${path.sep}z${path.sep}b.txt`], [`x${path.sep}y${path.sep}z${path.sep}g.txt`]);
	assertSourceFound('with spaces.txt', ['with-spaces.txt']); // space replacements
});
