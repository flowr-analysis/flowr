import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import {
	findSource,
	setSourceProvider
} from '../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import type { RParseRequest } from '../../../../src/r-bridge/retriever';
import { requestProviderFromFile, requestProviderFromText } from '../../../../src/r-bridge/retriever';
import type { FlowrLaxSourcingOptions } from '../../../../src/config';
import { DropPathsOption, InferWorkingDirectory, } from '../../../../src/config';
import path from 'path';

describe('source finding', () => {
	const sources = {
		'a.txt':                                       'N <- 9',
		[`a${path.sep}b.txt`]:                         'f <- function() { function() 3 }',
		'c.txt':                                       'f <- function() { x <<- 3 }',
		[`x${path.sep}y${path.sep}z${path.sep}b.txt`]: 'x <- 3',
		[`x${path.sep}y${path.sep}b.txt`]:             'x <- 3',
		'with-spaces.txt':                             'x <- 3',
	};
	beforeAll(() => {
		setSourceProvider(requestProviderFromText(sources));
	});
	afterAll(() => {
		setSourceProvider(requestProviderFromFile());
	});

	function assertSourceFound(path: string, shouldBe: string[], referenceChain: readonly RParseRequest[] = []) {
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
			const result = findSource(resolveSource, path, { referenceChain });
			assert.deepStrictEqual(result, shouldBe);
		});
	}

	assertSourceFound('a.txt', ['a.txt']);
	assertSourceFound('c.txt', ['c.txt']);
	assertSourceFound('b.txt', [`a${path.sep}b.txt`], [{ request: 'file', content: `a${path.sep}x.txt` }]);
	assertSourceFound('b.txt', [`x${path.sep}y${path.sep}z${path.sep}b.txt`], [{ request: 'file', content: `x${path.sep}y${path.sep}z${path.sep}g.txt` }]);
	assertSourceFound(`..${path.sep}b.txt`, [`x${path.sep}y${path.sep}b.txt`, `x${path.sep}y${path.sep}z${path.sep}b.txt`], [{ request: 'file', content: `x${path.sep}y${path.sep}z${path.sep}g.txt` }]);
	assertSourceFound('with spaces.txt', ['with-spaces.txt']); // space replacements
});
