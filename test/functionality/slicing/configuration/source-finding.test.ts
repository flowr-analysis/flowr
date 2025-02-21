import { afterAll, assert, beforeAll, describe, test } from 'vitest';
import {
	findSource,
	setSourceProvider
} from '../../../../src/dataflow/internal/process/functions/call/built-in/built-in-source';
import type { RParseRequest } from '../../../../src/r-bridge/retriever';
import { requestProviderFromFile, requestProviderFromText } from '../../../../src/r-bridge/retriever';
import {
	amendConfig,
	defaultConfigOptions,
	DropPathsOption,
	InferWorkingDirectory,
	setConfig
} from '../../../../src/config';

describe('source finding', () => {
	const sources = {
		'a.txt':       'N <- 9',
		'a/b.txt':     'f <- function() { function() 3 }',
		'c.txt':       'f <- function() { x <<- 3 }',
		'x/y/z/b.txt': 'x <- 3',
		'x/y/b.txt':   'x <- 3'
	};
	beforeAll(() => {
		setSourceProvider(requestProviderFromText(sources));
		amendConfig({
			solver: {
				...defaultConfigOptions.solver,
				resolveSource: {
					dropPaths:             DropPathsOption.All,
					ignoreCapitalization:  true,
					inferWorkingDirectory: InferWorkingDirectory.ActiveScript,
					searchPath:            []
				}
			}
		});
	});
	afterAll(() => {
		setSourceProvider(requestProviderFromFile());
		setConfig(defaultConfigOptions);
	});

	function assertSourceFound(path: string, shouldBe: string[], referenceChain: readonly RParseRequest[] = []) {
		test(`finds source for ${path}`, () => {
			const result = findSource(path, { referenceChain });
			assert.deepStrictEqual(result, shouldBe);
		});
	}

	assertSourceFound('a.txt', ['a.txt']);
	assertSourceFound('c.txt', ['c.txt']);
	assertSourceFound('b.txt', ['a/b.txt'], [{ request: 'file', content: 'a/x.txt' }]);
	assertSourceFound('b.txt', ['x/y/z/b.txt'], [{ request: 'file', content: 'x/y/z/g.txt' }]);
	assertSourceFound('../b.txt', ['x/y/b.txt'], [{ request: 'file', content: 'x/y/z/g.txt' }]);
});
