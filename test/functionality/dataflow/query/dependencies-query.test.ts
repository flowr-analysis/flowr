import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import type { SingleSlicingCriterion } from '../../../../src/slicing/criterion/parse';
import { slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import type {
	DependenciesQuery,
	DependenciesQueryResult,
	DependencyInfo
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import {
	DependenciesFunctions
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';

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

describe('Dependencies Query', withTreeSitter(parser => {
	/** handles slicing criteria for the node ids */
	function testQuery(
		name: string,
		code: string,
		expected: Partial<DependenciesQueryResult>,
		query: Partial<DependenciesQuery> = {}
	): void {
		assertQuery(label(name), parser, code, [{ type: 'dependencies', ...query }], ({ normalize }) => ({
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
			['attachNamespace', true],
			['load_all', true]
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

		testQuery('Given Require with character only', 'require(c, character.only=TRUE)', { libraries: [
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

		testQuery('Using a vector without character.only', 'lapply(c("a", "b", "c"), library)', { libraries: [
			{ nodeId: '1@library', functionName: 'library', libraryName: '"a"' },
			{ nodeId: '1@library', functionName: 'library', libraryName: '"b"' },
			{ nodeId: '1@library', functionName: 'library', libraryName: '"c"' }
		] });

		testQuery('Using a vector to load (missing elements)', 'lapply(c("x", u), library, character.only = TRUE)', { libraries: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '1@library', functionName: 'library', libraryName: 'unknown', lexemeOfArgument: 'c("x", u)' },
		] });

		testQuery('Using an aliased vector to load (missing elements)', 'x <- c("x", u)\nlapply(x, library, character.only = TRUE)', { libraries: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '2@library', functionName: 'library', libraryName: 'unknown', lexemeOfArgument: 'x' },
		] });

		testQuery('Using a vector to load', 'lapply(c("foo", "bar", "baz"), library, character.only = TRUE)', { libraries: [
			{ nodeId: '1@library', functionName: 'library', libraryName: 'foo' },
			{ nodeId: '1@library', functionName: 'library', libraryName: 'bar' },
			{ nodeId: '1@library', functionName: 'library', libraryName: 'baz' }
		] });

		testQuery('Using a vector to load by variable', 'v <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', { libraries: [
			{ nodeId: '2@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'c' }
		] });
		
		testQuery('Intermix another library call', 'library(foo)\nv <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', {
			libraries: [
				{ nodeId: '1@library', functionName: 'library', libraryName: 'foo' },
				{ nodeId: '3@library', functionName: 'library', libraryName: 'a' },
				{ nodeId: '3@library', functionName: 'library', libraryName: 'b' },
				{ nodeId: '3@library', functionName: 'library', libraryName: 'c' }
			]
		});

		testQuery('Using a nested vector to load', 'lapply(c(c("a", "b"), "c"), library, character.only = TRUE)', { libraries: [
			{ nodeId: '1@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '1@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '1@library', functionName: 'library', libraryName: 'c' }
		] });

		testQuery('Using a nested vector by variable', 'v <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { libraries: [
			{ nodeId: '2@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'c' }
		] });

		testQuery('Using a vector by variable (with distractor)', 'if(u) {v <- 42}\nv <- c(c("a", "b"), "c")\nc <- 4\nlapply(v, library, character.only = TRUE)', { libraries: [
			{ nodeId: '4@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '4@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '4@library', functionName: 'library', libraryName: 'c' }
		] });

		testQuery('Using a vector (but c is redefined)', 'c <- print\nv <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { libraries: [
			{ nodeId: '3@library', functionName: 'library', libraryName: 'unknown', lexemeOfArgument: 'v' },
		] });

		testQuery('Using a vector by variable (real world)', 'packages <- c("ggplot2", "dplyr", "tidyr")\nlapply(packages, library, character.only = TRUE)', { libraries: [
			{ nodeId: '2@library', functionName: 'library', libraryName: 'ggplot2' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'dplyr' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'tidyr' }
		] });

		testQuery('Using a deeply nested vector by variable', 'v <- c(c(c("a", c("b")), "c"), "d", c("e", c("f", "g")))\nlapply(v, library, character.only = TRUE)', { libraries: [
			{ nodeId: '2@library', functionName: 'library', libraryName: 'a' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'b' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'c' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'd' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'e' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'f' },
			{ nodeId: '2@library', functionName: 'library', libraryName: 'g' }
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
			testQuery('Disabled', 'library(testLibrary)', {}, { enabledFunctions: [DependenciesFunctions.Source, DependenciesFunctions.Read, DependenciesFunctions.Write] });
			testQuery('Enabled', 'library(testLibrary)', {
				libraries: [{ nodeId: '1@library', functionName: 'library', libraryName: 'testLibrary' }]
			}, { enabledFunctions: [DependenciesFunctions.Library] });
			testQuery('Empty enabled', 'library(testLibrary)', {
				libraries: [{ nodeId: '1@library', functionName: 'library', libraryName: 'testLibrary' }]
			}, { enabledFunctions: [] });
		});
	});

	describe('Sourced files', () => {
		for(const sourceFn of [
			'source_url',
			'source_gist'
		] as const) {
			testQuery(`${sourceFn}`, `${sourceFn}("a")` , { sourcedFiles: [{ nodeId: `1@${sourceFn}`, functionName: sourceFn, file: 'a' }] });
		}

		testQuery('Single source', 'source("test/file.R")', { sourcedFiles: [{ nodeId: '1@source', functionName: 'source', file: 'test/file.R' }] });

		testQuery('Single source variable', 'a <- "test/file.R"; source("test/file.R")', { sourcedFiles: [{ nodeId: '1@source', functionName: 'source', file: 'test/file.R' }] });

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
			testQuery('Disabled', 'source("test/file.R")', {}, { enabledFunctions: [DependenciesFunctions.Read, DependenciesFunctions.Write, DependenciesFunctions.Library] });
			testQuery('Enabled', 'source("test/file.R")', {
				sourcedFiles: [{ nodeId: '1@source', functionName: 'source', file: 'test/file.R' }]
			}, { enabledFunctions: [DependenciesFunctions.Source] });
		});
	});

	describe('Read Files', () => {
		for(const readFn of [
			'import_graph',
			'open_graph',
			'download_map_data',
			'read_html',
			'read_html_live',
			'read.ftable',
		] as const) {
			testQuery(`${readFn}`, `${readFn}("a")` , { readData: [{ nodeId: `1@${readFn}`, functionName: readFn, source: 'a' }] });
		}

		for(const readFn of [
			'dbReadTable',
			'dbReadTableArrow'
		] as const) {
			testQuery(`${readFn}`, `${readFn}(obj, "a")` , { readData: [{ nodeId: `1@${readFn}`, functionName: readFn, source: 'a' }] });
		}
		
		testQuery('read.table', "read.table('test.csv')", { readData: [{ nodeId: '1@read.table', functionName: 'read.table', source: 'test.csv' }] });
		testQuery('gzfile', 'gzfile("this is my gzip file :)", "test.gz")', { readData: [{ nodeId: '1@gzfile', functionName: 'gzfile', source: 'test.gz' }] });
		testQuery('With Argument', 'gzfile(open="test.gz",description="this is my gzip file :)")', { readData: [{ nodeId: '1@gzfile', functionName: 'gzfile', source: 'test.gz' }] });

		testQuery('unknown read', 'read.table(x)', { readData: [{ nodeId: '1@read.table', functionName: 'read.table', source: 'unknown', lexemeOfArgument: 'x' }] });

		testQuery('single read (variable)', 'x <- "test.csv"; read.table(x)', { readData: [{ nodeId: '1@read.table', functionName: 'read.table', source: 'test.csv' }] });

		describe('Only if file parameter', () => {
			testQuery('parse', 'parse(file="test.R")', { readData: [{ nodeId: '1@parse', functionName: 'parse', source: 'test.R' }] });
			testQuery('parse text', 'parse(text="test.R")', { });
		});

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
			testQuery('Disabled', "read.table('test.csv')", {}, { enabledFunctions: [DependenciesFunctions.Library, DependenciesFunctions.Write, DependenciesFunctions.Source] });
			testQuery('Enabled', "read.table('test.csv')", {
				readData: [{ nodeId: '1@read.table', functionName: 'read.table', source: 'test.csv' }]
			}, { enabledFunctions: [DependenciesFunctions.Read] });
		});
	});

	describe('Write Files', () => {
		for(const writeFn of [
			'ggsave',
			'raster_pdf',
			'agg_pdf',
			'Export',
			'windows'
		]) {
			testQuery(`${writeFn}`, `${writeFn}("a")` , { writtenData: [{ nodeId: `1@${writeFn}`, functionName: writeFn, destination: 'a' }] });
		}

		testQuery('visSave', 'visSave(obj, "a")' , { writtenData: [{ nodeId: '1@visSave', functionName: 'visSave', destination: 'a' }] });
		testQuery('save_graph', 'save_graph(obj, "a")' , { writtenData: [{ nodeId: '1@save_graph', functionName: 'save_graph', destination: 'a' }] });
		testQuery('export_graph', 'export_graph(file_name = "a")' , { writtenData: [{ nodeId: '1@export_graph', functionName: 'export_graph', destination: 'a' }] });
	
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

		testQuery('single write (variable)', 'u <- "test.csv"; write.csv(data, file=u)', { writtenData: [{ nodeId: '1@write.csv', functionName: 'write.csv', destination: 'test.csv' }] });

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
			testQuery('Disabled', 'dump("My text", "MyTextFile.txt")', {}, { enabledFunctions: [DependenciesFunctions.Library, DependenciesFunctions.Read, DependenciesFunctions.Source] });
			testQuery('Disabled', 'dump("My text", "MyTextFile.txt")', {
				writtenData: [{ nodeId: '1@dump', functionName: 'dump', destination: 'MyTextFile.txt' }]
			}, { enabledFunctions: [DependenciesFunctions.Write] });
		});
	});

	describe('With file connections', () => {
		for(const ro of ['r', 'rb', 'rt'] as const) {
			testQuery('read only file connection', `file("test.txt", "${ro}")`, {
				readData: [{ nodeId: '1@file', functionName: 'file', source: 'test.txt' }]
			});
		}
		for(const wo of ['w', 'wb', 'wt', 'a', 'ab', 'at',] as const) {
			testQuery('write only file connection', `file("test.txt", "${wo}")`, {
				writtenData: [{ nodeId: '1@file', functionName: 'file', destination: 'test.txt' }]
			});
		}
	});



	describe('Overwritten Function', () => {
		testQuery('read.csv (overwritten by user)', "read.csv <- function(a) print(a); read.csv('test.csv')", { 
			readData:    [],
			writtenData: [{
				destination:  'stdout',
				functionName: 'print',
				nodeId:       '1@print'
			}]
		});
	});
}));
