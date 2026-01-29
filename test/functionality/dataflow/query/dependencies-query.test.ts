import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { type SingleSlicingCriterion, slicingCriterionToId } from '../../../../src/slicing/criterion/parse';
import {
	type DependenciesQuery,
	type DependenciesQueryResult,
	type DependencyInfo,
	Unknown
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { describe } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';

const emptyDependencies: Omit<DependenciesQueryResult, '.meta'> = { library: [], source: [], read: [], write: [], visualize: [], test: [] };

function decodeIds(res: Partial<DependenciesQueryResult>, idMap: AstIdMap): Partial<DependenciesQueryResult> {
	const out: Partial<DependenciesQueryResult> = {
		...res
	};
	for(const [key, value] of Object.entries(res) as [keyof DependenciesQueryResult, DependencyInfo[]][]) {
		if(key === '.meta') {
			continue;
		}
		out[key] = value.map(({ nodeId, ...rest }) => ({
			nodeId:    typeof nodeId === 'number' ? nodeId : slicingCriterionToId(String(nodeId) as SingleSlicingCriterion, idMap),
			linkedIds: rest.linkedIds?.map(lid => typeof lid === 'number' ? lid : slicingCriterionToId(String(lid) as SingleSlicingCriterion, idMap)),
			...rest
		}));
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
				library: [{ nodeId: '1@' + loadFn, functionName: loadFn, value: 'a' }]
			});
		}

		testQuery('Multiple Libraries', 'library(a)\nlibrary(b)\nrequire(c)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '3@require', functionName: 'require', value: 'c' }
		] });

		testQuery('Given Require', 'require("c")', { library: [
			{ nodeId: '1@require', functionName: 'require', value: 'c' }
		] });

		testQuery('Given Require with character only', 'require(c, character.only=TRUE)', { library: [
			{ nodeId: '1@require', functionName: 'require', value: 'unknown', lexemeOfArgument: 'c' }
		] });


		testQuery('Library with variable', 'a <- "ggplot2"\nb <- TRUE\nlibrary(a,character.only=b)', { library: [
			{ nodeId: '3@library', functionName: 'library', value: 'ggplot2'  }
		] });

		// for now, we want a better or (https://github.com/flowr-analysis/flowr/issues/1342)
		testQuery('Library with possibilities', 'if(u) { a <- "a" } else { a <- "b" }\nlibrary(a,character.only=TRUE)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'a' }
		] });


		testQuery('pacman', 'p_load(a, b, c)', { library: [
			{ nodeId: '1@p_load', functionName: 'p_load', value: 'a' },
			{ nodeId: '1@p_load', functionName: 'p_load', value: 'b' },
			{ nodeId: '1@p_load', functionName: 'p_load', value: 'c' }
		] });

		testQuery('Load implicitly', 'foo::x\nbar:::y()', { library: [
			{ nodeId: '1@x', functionName: '::', value: 'foo' },
			{ nodeId: '2@y', functionName: ':::', value: 'bar' }
		] });

		testQuery('Using a vector without character.only', 'lapply(c("a", "b", "c"), library)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: '"a"' },
			{ nodeId: '1@library', functionName: 'library', value: '"b"' },
			{ nodeId: '1@library', functionName: 'library', value: '"c"' }
		] });

		testQuery('Using a vector to load (missing elements)', 'lapply(c("x", u), library, character.only = TRUE)', { library: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '1@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'c("x", u)' },
		] });

		testQuery('Using an aliased vector to load (missing elements)', 'x <- c("x", u)\nlapply(x, library, character.only = TRUE)', { library: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '2@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'x' },
		] });

		testQuery('Using a vector to load', 'lapply(c("foo", "bar", "baz"), library, character.only = TRUE)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'foo' },
			{ nodeId: '1@library', functionName: 'library', value: 'bar' },
			{ nodeId: '1@library', functionName: 'library', value: 'baz' }
		] });

		testQuery('Using a vector to load by variable', 'v <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Intermix another library call', 'library(foo)\nv <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', {
			library: [
				{ nodeId: '1@library', functionName: 'library', value: 'foo' },
				{ nodeId: '3@library', functionName: 'library', value: 'a' },
				{ nodeId: '3@library', functionName: 'library', value: 'b' },
				{ nodeId: '3@library', functionName: 'library', value: 'c' }
			]
		});

		testQuery('Using a nested vector to load', 'lapply(c(c("a", "b"), "c"), library, character.only = TRUE)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'a' },
			{ nodeId: '1@library', functionName: 'library', value: 'b' },
			{ nodeId: '1@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a nested vector by variable', 'v <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a vector by variable (with distractor)', 'if(u) {v <- 42}\nv <- c(c("a", "b"), "c")\nc <- 4\nlapply(v, library, character.only = TRUE)', { library: [
			{ nodeId: '4@library', functionName: 'library', value: 'a' },
			{ nodeId: '4@library', functionName: 'library', value: 'b' },
			{ nodeId: '4@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a vector (but c is redefined)', 'c <- print\nv <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { library: [
			{ nodeId: '3@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'v' },
		] });

		testQuery('Using a vector by variable (real world)', 'packages <- c("ggplot2", "dplyr", "tidyr")\nlapply(packages, library, character.only = TRUE)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'ggplot2' },
			{ nodeId: '2@library', functionName: 'library', value: 'dplyr'  },
			{ nodeId: '2@library', functionName: 'library', value: 'tidyr' }
		] });

		testQuery('Using a deeply nested vector by variable', 'v <- c(c(c("a", c("b")), "c"), "d", c("e", c("f", "g")))\nlapply(v, library, character.only = TRUE)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' },
			{ nodeId: '2@library', functionName: 'library', value: 'd' },
			{ nodeId: '2@library', functionName: 'library', value: 'e' },
			{ nodeId: '2@library', functionName: 'library', value: 'f' },
			{ nodeId: '2@library', functionName: 'library', value: 'g' }
		] });

		testQuery('Library with version', 'library(ggplot2)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'ggplot2'  }
		] });

		testQuery('Libraries with versions', 'library(ggplot2)\nlibrary(dplyr)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'ggplot2' },
			{ nodeId: '2@library', functionName: 'library', value: 'dplyr' },
		] });

		testQuery('Libraries with and without versions', 'library(ggplot2)\nlibrary(dplyr)\nlibrary(tidyr)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'ggplot2' },
			{ nodeId: '2@library', functionName: 'library', value: 'dplyr' },
			{ nodeId: '3@library', functionName: 'library', value: 'tidyr' },
		] });

		describe('Custom', () => {
			const readCustomFile: Partial<DependenciesQuery> = {
				libraryFunctions: [{ package: 'custom', name: 'custom.library', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				library: [{ nodeId: '1@custom.library', functionName: 'custom.library', value: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'custom.library(1, "my-custom-file", 2)', expected, readCustomFile);
			testQuery('Custom (by name)', 'custom.library(num1 = 1, num2 = 2, file = "my-custom-file")', expected, readCustomFile);
			testQuery('Ignore default', 'library(testLibrary)', {}, { ignoreDefaultFunctions: true });
			testQuery('Disabled', 'library(testLibrary)', {}, { enabledCategories: ['source', 'read', 'write'] });
			testQuery('Disabled', 'a::dep', {}, { enabledCategories: [] });
			testQuery('Enabled', 'library(testLibrary)', {
				library: [{ nodeId: '1@library', functionName: 'library', value: 'testLibrary' }]
			}, { enabledCategories: ['library'] });
			testQuery('Empty enabled', 'library(testLibrary)', {
				library: [{ nodeId: '1@library', functionName: 'library', value: 'testLibrary' }]
			}, { enabledCategories: undefined });
		});
	});

	describe('Sourced files', () => {
		for(const sourceFn of [
			'source_url',
			'source_gist'
		] as const) {
			testQuery(`${sourceFn}`, `${sourceFn}("a")` , { source: [{ nodeId: `1@${sourceFn}`, functionName: sourceFn, value: 'a' }] });
		}

		testQuery('Single source', 'source("test/file.R")', { source: [{ nodeId: '1@source', functionName: 'source', value: 'test/file.R' }] });

		testQuery('Single source variable', 'a <- "test/file.R"; source("test/file.R")', { source: [{ nodeId: '1@source', functionName: 'source', value: 'test/file.R' }] });

		describe('Custom', () => {
			const sourceCustomFile: Partial<DependenciesQuery> = {
				sourceFunctions: [{ name: 'source.custom.file', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				source: [{ nodeId: '1@source.custom.file', functionName: 'source.custom.file', value: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'source.custom.file(1, "my-custom-file", 2)', expected, sourceCustomFile);
			testQuery('Custom (by name)', 'source.custom.file(num1 = 1, num2 = 2, file = "my-custom-file")', expected, sourceCustomFile);
			testQuery('Ignore default', 'source("test/file.R")', {}, { ignoreDefaultFunctions: true });
			testQuery('Disabled', 'source("test/file.R")', {}, { enabledCategories: ['read', 'write', 'library'] });
			testQuery('Enabled', 'source("test/file.R")', {
				source: [{ nodeId: '1@source', functionName: 'source', value: 'test/file.R' }]
			}, { enabledCategories: ['source'] });
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
			testQuery(`${readFn}`, `${readFn}("a")` , { read: [{ nodeId: `1@${readFn}`, functionName: readFn, value: 'a' }] });
		}

		for(const readFn of [
			'dbReadTable',
			'dbReadTableArrow'
		] as const) {
			testQuery(`${readFn}`, `${readFn}(obj, "a")` , { read: [{ nodeId: `1@${readFn}`, functionName: readFn, value: 'a' }] });
		}

		testQuery('read.table', "read.table('test.csv')", { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }] });
		testQuery('read_csv', "read_csv('test.csv')", { read: [{ nodeId: '1@read_csv', functionName: 'read_csv', value: 'test.csv' }] });
		testQuery('gzfile', 'gzfile("this is my gzip file :)", "test.gz")', { read: [{ nodeId: '1@gzfile', functionName: 'gzfile', value: 'test.gz' }] });
		testQuery('With Argument', 'gzfile(open="test.gz",description="this is my gzip file :)")', { read: [{ nodeId: '1@gzfile', functionName: 'gzfile', value: 'test.gz' }] });

		testQuery('unknown read', 'read.table(x)', { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'unknown', lexemeOfArgument: 'x' }] });

		testQuery('single read (variable)', 'x <- "test.csv"; read.table(x)', { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }] });

		describe('Only if file parameter', () => {
			testQuery('parse', 'parse(file="test.R")', { read: [{ nodeId: '1@parse', functionName: 'parse', value: 'test.R' }] });
			testQuery('parse text', 'parse(text="test.R")', { });
		});

		describe('Custom', () => {
			const readCustomFile: Partial<DependenciesQuery> = {
				readFunctions: [{ name: 'read.custom.file', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				read: [{ nodeId: '1@read.custom.file', functionName: 'read.custom.file', value: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'read.custom.file(1, "my-custom-file", 2)', expected, readCustomFile);
			testQuery('Custom (by name)', 'read.custom.file(num1 = 1, num2 = 2, file = "my-custom-file")', expected, readCustomFile);
			testQuery('Ignore default', "read.table('test.csv')", {}, { ignoreDefaultFunctions: true });
			testQuery('Disabled', "read.table('test.csv')", {}, { enabledCategories: ['library', 'write', 'source'] });
			testQuery('Enabled', "read.table('test.csv')", {
				read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }]
			}, { enabledCategories: ['read'] });
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
			testQuery(`${writeFn}`, `${writeFn}("a")` , { write: [{ nodeId: `1@${writeFn}`, functionName: writeFn, value: 'a' }] });
		}

		testQuery('visSave', 'visSave(obj, "a")' , { write: [{ nodeId: '1@visSave', functionName: 'visSave', value: 'a' }] });
		testQuery('save_graph', 'save_graph(obj, "a")' , { write: [{ nodeId: '1@save_graph', functionName: 'save_graph', value: 'a' }] });
		testQuery('export_graph', 'export_graph(file_name = "a")' , { write: [{ nodeId: '1@export_graph', functionName: 'export_graph', value: 'a' }] });

		testQuery('dump', 'dump("My text", "MyTextFile.txt")', { write: [{ nodeId: '1@dump', functionName: 'dump', value: 'MyTextFile.txt' }] });
		testQuery('dump (argument)', 'dump(file="foo.txt", "foo")', { write: [{ nodeId: '1@dump', functionName: 'dump', value: 'foo.txt' }] });
		testQuery('cat', 'cat("Hello!")', { write: [{ nodeId: '1@cat', functionName: 'cat', value: 'stdout' }] });
		testQuery('cat with sink', 'sink("foo")\ncat("Hello!")', { write: [{ nodeId: '2@cat', functionName: 'cat', value: 'foo', linkedIds: [3] }] });
		testQuery('multiple sinks', 'sink("x")\nk <- "k.txt"\nsink(k)\nprint("hey")', { write: [
			{ nodeId: '4@print', functionName: 'print', value: 'k.txt', linkedIds: [10] }
		] });
		testQuery('cat with empty sink', 'sink()\ncat("Hello!")', { write: [{ nodeId: '2@cat', functionName: 'cat', value: 'stdout', linkedIds: [1] }] });
		testQuery('cat 2 args', 'cat("Hello", "World")', { write: [{ nodeId: '1@cat', functionName: 'cat', value: 'stdout' }] });
		testQuery('cat 2 args with file', 'cat("Hello", "World", file="foo.txt")', { write: [{ nodeId: '1@cat', functionName: 'cat', value: 'foo.txt' }] });
		testQuery('cat many args', 'cat(a, b, c, d, e, file)', { write: [{ nodeId: '1@cat', functionName: 'cat', value: 'stdout' }] });

		testQuery('Unknown write', 'write.csv(data, file=u)', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'unknown', lexemeOfArgument: 'u' }] });
		testQuery('File save', 'save(foo,file="a.Rda")', { write: [{ nodeId: '1@save', functionName: 'save', value: 'a.Rda' }] });

		testQuery('single write (variable)', 'u <- "test.csv"; write.csv(data, file=u)', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'test.csv' }] });

		describe('try with outfile', () => {
			testQuery('unconfigured', 'try(u)', { write: [{ nodeId: '1@try', functionName: 'try', value: 'stderr' }] });
			testQuery('with outfile', 'try(u, outFile="myfile.txt")', { write: [{ nodeId: '1@try', functionName: 'try', value: 'myfile.txt' }] });
			testQuery('unconfigured, with silent', 'try(u, silent=TRUE)', { write: [] });
			testQuery('unconfigured, with implicit silent', 'try(u, TRUE)', { write: [] });
			testQuery('with outfile and silent', 'try(u, outFile="myfile.txt", silent=TRUE)', { write: [] });
			testQuery('with outfile and silent b', 'try(u, silent=TRUE, outFile="myfile.txt")', { write: [] });
		});

		describe('Custom', () => {
			const writeCustomFile: Partial<DependenciesQuery> = {
				writeFunctions: [{ name: 'write.custom.file', argIdx: 1, argName: 'file' }]
			};
			const expected: Partial<DependenciesQueryResult> = {
				write: [{ nodeId: '1@write.custom.file', functionName: 'write.custom.file', value: 'my-custom-file' }]
			};
			testQuery('Custom (by index)', 'write.custom.file(1, "my-custom-file", 2)', expected, writeCustomFile);
			testQuery('Custom (by name)', 'write.custom.file(num1 = 1, num2 = 2, file = "my-custom-file")', expected, writeCustomFile);
			testQuery('Ignore default', 'dump("My text", "MyTextFile.txt")', {}, { ignoreDefaultFunctions: true });
			testQuery('Disabled', 'dump("My text", "MyTextFile.txt")', {}, { enabledCategories: ['library', 'read', 'source'] });
			testQuery('Disabled', 'dump("My text", "MyTextFile.txt")', {
				write: [{ nodeId: '1@dump', functionName: 'dump', value: 'MyTextFile.txt' }]
			}, { enabledCategories: ['write'] });
		});
	});

	describe('Visualize', () => {
		describe('Creation', () => {
			for(const f of ['ggplot', 'tinyplot', 'plot', 'bootcurve']) {
				testQuery(f, `${f}()` , { visualize: [{ nodeId: `1@${f}`, functionName: f }] });
			}
		});
		describe('Modification', () => {
			for(const f of ['coord_trans', 'scale_colour_hue', 'tinyplot_add']) {
				testQuery(f, `plot()\n${f}(x, y, z)`, { visualize: [
					{ nodeId: '1@plot', functionName: 'plot' },
					{ nodeId: `2@${f}`, functionName: f, linkedIds: [1] }
				] });
			}
			testQuery('complex', 'plot()\nx <- 2\ncat(x)\ncoord_trans(x, y, z)', { visualize: [
				{ nodeId: '1@plot', functionName: 'plot' },
				{ nodeId: '4@coord_trans', functionName: 'coord_trans', linkedIds: [1] }
			] }, { enabledCategories: ['visualize'] } );
			testQuery('multiple', 'plot()\nx <- 2\ncat(x)\ncoord_trans(x, y, z)\nplot()\ntinyplot_add(x, y, z)', { visualize: [
				{ nodeId: '1@plot', functionName: 'plot' },
				{ nodeId: '5@plot', functionName: 'plot' },
				{ nodeId: '4@coord_trans', functionName: 'coord_trans', linkedIds: [1] },
				{ nodeId: '6@tinyplot_add', functionName: 'tinyplot_add', linkedIds: [18] }
			] }, { enabledCategories: ['visualize'] } );
		});
	});

	describe('With file connections', () => {
		for(const ro of ['r', 'rb', 'rt'] as const) {
			testQuery('read only file connection', `file("test.txt", "${ro}")`, {
				read: [{ nodeId: '1@file', functionName: 'file', value: 'test.txt' }]
			});
		}
		for(const wo of ['w', 'wb', 'wt', 'a', 'ab', 'at',] as const) {
			testQuery('write only file connection', `file("test.txt", "${wo}")`, {
				write: [{ nodeId: '1@file', functionName: 'file', value: 'test.txt' }]
			});
		}
	});

	describe('Overwritten Function', () => {
		testQuery('read.csv (overwritten by user)', "read.csv <- function(a) print(a); read.csv('test.csv')", {
			read:  [],
			write: [{
				value:        'stdout',
				functionName: 'print',
				nodeId:       '1@print'
			}]
		});
	});

	describe('Custom categories', () => {
		testQuery('simple', 'cat("a")', {
			test: [{ value: 'a', functionName: 'cat', nodeId: '1@cat' }]
		}, {
			ignoreDefaultFunctions: true,
			additionalCategories:   {
				'test': {
					queryDisplayName: 'Testing',
					functions:        [{ name: 'cat', argIdx: 0 }]
				}
			}
		});
		testQuery('simple additional', 'cat("a")', {
			test: [{ value: 'cat', functionName: 'cat', nodeId: '1@cat' }]
		}, {
			ignoreDefaultFunctions: true,
			additionalCategories:   {
				'test': {
					queryDisplayName:   'Testing',
					functions:          [],
					additionalAnalysis: async(data, _id, _f, _qr, results) => {
						const ns = (await data.analyzer.normalize()).idMap;
						for(const n of ns.values()) {
							if(n.type === RType.FunctionCall && n.lexeme === 'cat' && n.arguments.length > 0) {
								results.push({
									nodeId:       n.info.id,
									functionName: 'cat',
									value:        n.lexeme
								});
								break;
							}
						}
					}
				}
			}
		});
		testQuery('addon', 'cat("a")\nx <- 2', {
			write:      [{ value: 'stdout', functionName: 'cat', nodeId: '1@cat' }],
			assignment: [{ lexemeOfArgument: '2', functionName: '<-', nodeId: '2@<-', value: Unknown }]
		}, {
			additionalCategories: {
				assignment: {
					functions: [{ name: '<-', argIdx: 1 }]
				}
			}
		});
	});
	describe('Test Functions', () => {
		testQuery('Nesting example', `test_that("trigonometric functions match identities", {
  expect_equal(sin(pi / 4), 1 / sqrt(2))
  expect_equal(cos(pi / 4), 1 / sqrt(2))
  expect_equal(tan(pi / 4), 1)
})`, {
			test: [
				/* { nodeId: '2@expect_equal', functionName: 'expect_equal' },
				{ nodeId: '3@expect_equal', functionName: 'expect_equal' },
				{ nodeId: '4@expect_equal', functionName: 'expect_equal' }, */
				{ nodeId: '1@test_that', functionName: 'test_that', value: 'trigonometric functions match identities', linkedIds: [47,36,20] }
			]
		});
	});
}));
