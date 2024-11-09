import { withShell } from '../../_helper/shell';
import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type {
	DependenciesQuery,
	DependenciesQueryResult, DependencyInfo
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';

import { describe } from 'vitest';

const emptyDependencies: Omit<DependenciesQueryResult, '.meta'> = { libraries: [], sourcedFiles: [], readData: [], writtenData: [] };

function decodeIds(res: Partial<DependenciesQueryResult>, idMap: AstIdMap): Partial<DependenciesQueryResult> {
	const out: Partial<DependenciesQueryResult> = {
		...res
	};
	for(const [key, value] of Object.entries(res) as [keyof DependenciesQueryResult, DependencyInfo[]][]) {
		if(key === '.meta') {
			continue;
		}
		// @ts-expect-error -- we do not need key-dependent typing due to the spread
		out[key] = value.map(({ nodeId, ...rest }) => ({ nodeId: typeof nodeId === 'number' ? nodeId : slicingCriterionToId(String(nodeId) as SingleSlicingCriterion, idMap), ...rest }));
	}
	return out;
}

describe.sequential('Dependencies Query', withShell(shell => {
	/** handles slicing criteria for the node ids */
	function testQuery(
		name: string,
		code: string,
		expected: Partial<DependenciesQueryResult>,
		query: Partial<DependenciesQuery> = {}
	): void {
		assertQuery(label(name), shell, code, [{ type: 'dependencies', ...query }], ({ normalize }) => ({
			dependencies: {
				...emptyDependencies,
				...decodeIds(expected, normalize.idMap)
			}
		}));
	}

	describe('Simple', () => {
		testQuery('No dependencies', 'x + 1', {});
	});

	describe('Libraries', () => {
		for(const [loadFn, str] of [
			['library', false],
			['library', true],
			['require', true],
			['loadNamespace', true],
			['attachNamespace', true]
			/* support attach, support with, support pacman::p_load and the like? */
		] as const) {
			testQuery(`${loadFn} (${str ? 'string' : 'symbol'})`, `${loadFn}(${str ? '"a"' : 'a'})`, {
				libraries: [{ nodeId: '1@' + loadFn, functionName: loadFn, libraryName: 'a' }]
			});
		}

		testQuery('Multiple Libraries', 'library(a)\nlibrary(b)\nrequire(c)', { libraries: [
			{ nodeId: '1@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '3@require', functionName: 'require', libraryName: 'c' }
		] });

		testQuery('pacman', 'p_load(a, b, c)', { libraries: [
			{ nodeId: '1@p_load', functionName: 'p_load', libraryName: 'a' },
			{ nodeId: '1@p_load', functionName: 'p_load', libraryName: 'b' },
			{ nodeId: '1@p_load', functionName: 'p_load', libraryName: 'c' }
		] });

		testQuery('Load implicitly', 'foo::x\nbar:::y()', { libraries: [
			{ nodeId: '1@x', functionName: '::', libraryName: 'foo' },
			{ nodeId: '2@y', functionName: ':::', libraryName: 'bar' }
		] });


		/* currently not supported */
		testQuery('Using a vector to load', 'lapply(c("a", "b", "c"), library, character.only = TRUE)', { libraries: [
			/* { nodeId: '1@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '1@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '1@library', functionName: 'library', libraryName: 'c' } */
			{ nodeId: '1@library', functionName: 'library', libraryName: 'unknown' }
		] });

		describe('Custom', () => {
			const readCustomFile: Partial<DependenciesQuery> = {
				libraryFunctions: [{ name: 'custom.library', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				libraries: [{ nodeId: '1@custom.library', functionName: 'custom.library', libraryName: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'custom.library(1, "my-custom-file", 2)', expected, readCustomFile);
			testQuery('Custom (by name)', 'custom.library(num1 = 1, num2 = 2, file = "my-custom-file")', expected, readCustomFile);
			testQuery('Ignore default', 'library(testLibrary)', {}, { ignoreDefaultFunctions: true });
		});
	});

	describe('Sourced files', () => {
		testQuery('Single source', 'source("test/file.R")', { sourcedFiles: [{ nodeId: '1@source', functionName: 'source', file: 'test/file.R' }] });

		describe('Custom', () => {
			const sourceCustomFile: Partial<DependenciesQuery> = {
				sourceFunctions: [{ name: 'source.custom.file', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				sourcedFiles: [{ nodeId: '1@source.custom.file', functionName: 'source.custom.file', file: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'source.custom.file(1, "my-custom-file", 2)', expected, sourceCustomFile);
			testQuery('Custom (by name)', 'source.custom.file(num1 = 1, num2 = 2, file = "my-custom-file")', expected, sourceCustomFile);
			testQuery('Ignore default', 'source("test/file.R")', {}, { ignoreDefaultFunctions: true });
		});
	});

	describe('Read Files', () => {
		testQuery('read.table', "read.table('test.csv')", { readData: [{ nodeId: '1@read.table', functionName: 'read.table', source: 'test.csv' }] });
		testQuery('gzfile', 'gzfile("this is my gzip file :)", "test.gz")', { readData: [{ nodeId: '1@gzfile', functionName: 'gzfile', source: 'test.gz' }] });
		testQuery('With Argument', 'gzfile(open="test.gz",description="this is my gzip file :)")', { readData: [{ nodeId: '1@gzfile', functionName: 'gzfile', source: 'test.gz' }] });

		describe('Custom', () => {
			const readCustomFile: Partial<DependenciesQuery> = {
				readFunctions: [{ name: 'read.custom.file', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				readData: [{ nodeId: '1@read.custom.file', functionName: 'read.custom.file', source: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'read.custom.file(1, "my-custom-file", 2)', expected, readCustomFile);
			testQuery('Custom (by name)', 'read.custom.file(num1 = 1, num2 = 2, file = "my-custom-file")', expected, readCustomFile);
			testQuery('Ignore default', "read.table('test.csv')", {}, { ignoreDefaultFunctions: true });
		});
	});

	describe('Write Files', () => {
		testQuery('dump', 'dump("My text", "MyTextFile.txt")', { writtenData: [{ nodeId: '1@dump', functionName: 'dump', destination: 'MyTextFile.txt' }] });
		testQuery('dump (argument)', 'dump(file="foo.txt", "foo")', { writtenData: [{ nodeId: '1@dump', functionName: 'dump', destination: 'foo.txt' }] });
		testQuery('cat', 'cat("Hello!")', { writtenData: [{ nodeId: '1@cat', functionName: 'cat', destination: 'stdout' }] });
		testQuery('cat with sink', 'sink("foo")\ncat("Hello!")', { writtenData: [{ nodeId: '2@cat', functionName: 'cat', destination: 'unknown', linkedIds: [3] }] });

		describe('Custom', () => {
			const writeCustomFile: Partial<DependenciesQuery> = {
				writeFunctions: [{ name: 'write.custom.file', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				writtenData: [{ nodeId: '1@write.custom.file', functionName: 'write.custom.file', destination: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'write.custom.file(1, "my-custom-file", 2)', expected, writeCustomFile);
			testQuery('Custom (by name)', 'write.custom.file(num1 = 1, num2 = 2, file = "my-custom-file")', expected, writeCustomFile);
			testQuery('Ignore default', 'dump("My text", "MyTextFile.txt")', {}, { ignoreDefaultFunctions: true });
		});
	});
}));
