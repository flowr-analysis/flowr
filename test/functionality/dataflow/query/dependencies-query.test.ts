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

		testQuery('Given Require', 'require("c")', { libraries: [
			{ nodeId: '1@require', functionName: 'require', libraryName: 'c' }
		] });

		testQuery('Given Require with Character Only', 'require(c, character.only=TRUE)', { libraries: [
			{ nodeId: '1@require', functionName: 'require', libraryName: 'unknown', lexemeOfArgument: 'c' }
		] });


		testQuery('Library with variable', 'a <- "ggplot2"\nb <- TRUE\nlibrary(a,character.only=b)', { libraries: [
			{ nodeId: '3@library', functionName: 'library', libraryName: 'ggplot2' }
		] });

		// for now, we want a better or (https://github.com/flowr-analysis/flowr/issues/1342)
		testQuery('Library with possibilities', 'if(u) { a <- "a" } else { a <- "b" }\nlibrary(a,character.only=TRUE)', { libraries: [
			{ nodeId: '2@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'a' }
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
				libraryFunctions: [{ package: 'custom', name: 'custom.library', argIdx: 1, argName: 'file' }]
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
				sourceFunctions: [{ package: 'custom', name: 'source.custom.file', argIdx: 1, argName: 'file' }]
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

		testQuery('unknown read', 'read.table(x)', { readData: [{ nodeId: '1@read.table', functionName: 'read.table', source: 'unknown', lexemeOfArgument: 'x' }] });

		describe('Only if file parameter', () => {
			testQuery('parse', 'parse(file="test.R")', { readData: [{ nodeId: '1@parse', functionName: 'parse', source: 'test.R' }] });
			testQuery('parse text', 'parse(text="test.R")', { });
		});

		describe('Custom', () => {
			const readCustomFile: Partial<DependenciesQuery> = {
				readFunctions: [{ package: 'custom', name: 'read.custom.file', argIdx: 1, argName: 'file' }]
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
		testQuery('cat with sink', 'sink("foo")\ncat("Hello!")', { writtenData: [{ nodeId: '2@cat', functionName: 'cat', destination: 'foo', linkedIds: [3] }] });
		testQuery('multiple sinks', 'sink("x")\nk <- "k.txt"\nsink(k)\nprint("hey")', { writtenData: [
			{ nodeId: '4@print', functionName: 'print', destination: 'k.txt', linkedIds: [10] }
		] });
		testQuery('cat with empty sink', 'sink()\ncat("Hello!")', { writtenData: [{ nodeId: '2@cat', functionName: 'cat', destination: 'stdout', linkedIds: [1] }] });
		testQuery('cat 2 args', 'cat("Hello", "World")', { writtenData: [{ nodeId: '1@cat', functionName: 'cat', destination: 'stdout' }] });
		testQuery('cat 2 args with file', 'cat("Hello", "World", file="foo.txt")', { writtenData: [{ nodeId: '1@cat', functionName: 'cat', destination: 'foo.txt' }] });
		testQuery('cat many args', 'cat(a, b, c, d, e, file)', { writtenData: [{ nodeId: '1@cat', functionName: 'cat', destination: 'stdout' }] });

		testQuery('Unknown write', 'write.csv(data, file=u)', { writtenData: [{ nodeId: '1@write.csv', functionName: 'write.csv', destination: 'unknown', lexemeOfArgument: 'u' }] });
		testQuery('File save', 'save(foo,file="a.Rda")', { writtenData: [{ nodeId: '1@save', functionName: 'save', destination: 'a.Rda' }] });

		describe('Custom', () => {
			const writeCustomFile: Partial<DependenciesQuery> = {
				writeFunctions: [{ package: 'custom', name: 'write.custom.file', argIdx: 1, argName: 'file' }]
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
