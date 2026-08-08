import { assertQuery } from '../../_helper/query';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { label } from '../../_helper/label';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import {
	type DependenciesQuery,
	type DependenciesQueryResult,
	DefaultDependencyCategories,
	type DependencyInfo,
	Constant,
	Unknown
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { RType } from '../../../../src/r-bridge/lang-4.x/ast/model/type';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { DefaultBuiltinConfig } from '../../../../src/dataflow/environments/default-builtin-config';
import { builtInNames } from '../../../../src/dataflow/environments/query-fn-props';
import type { BuiltInFnInfo, FnSig } from '../../../../src/dataflow/environments/built-in-props';
import { ArgProp } from '../../../../src/dataflow/environments/built-in-props';
import { ReadFunctions } from '../../../../src/queries/catalog/dependencies-query/function-info/read-functions';
import { WriteFunctions } from '../../../../src/queries/catalog/dependencies-query/function-info/write-functions';
import { OtherPathFunctions } from '../../../../src/queries/catalog/dependencies-query/function-info/other-path-functions';

const emptyDependencies: Omit<DependenciesQueryResult, '.meta'> = { library: [], remote: [], source: [], read: [], write: [], visualize: [], test: [], print: [] };

function decodeIds(res: Partial<DependenciesQueryResult>, idMap: AstIdMap): Partial<DependenciesQueryResult> {
	const out: Partial<DependenciesQueryResult> = {
		...res
	};
	const decode = (id: NodeId) => typeof id === 'number' ? id : SlicingCriterion.parse(String(id) as SlicingCriterion, idMap);
	for(const [key, value] of Object.entries(res) as [keyof DependenciesQueryResult, DependencyInfo[]][]) {
		if(key === '.meta') {
			continue;
		}
		out[key] = value.map(({ nodeId, linkedIds, argumentId, ...rest }) => ({
			nodeId:     decode(nodeId),
			linkedIds:  linkedIds?.map(decode),
			argumentId: argumentId === undefined ? undefined : decode(argumentId),
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
			{ nodeId: '1@require', functionName: 'require', value: 'unknown', lexemeOfArgument: 'c', argumentId: '1:9' }
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

		testQuery('rlang on_package_load', 'on_load({ x <- read.csv("a.csv") })\non_package_load("dplyr", message("hi"))', {
			library: [{ nodeId: '2@on_package_load', functionName: 'on_package_load', value: 'dplyr' }],
			read:    [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'a.csv' }],
			write:   [{ nodeId: '2@message', functionName: 'message', value: 'stdout' }]
		});

		testQuery('Load implicitly', 'foo::x\nbar:::y()', {
			print:   [{ nodeId: 2, functionName: Identifier.make('y' as never, 'bar' as never, true), value: 'stdout' }],
			library: [
				{ nodeId: '1@x', functionName: '::', value: 'foo' },
				{ nodeId: '2@y', functionName: ':::', value: 'bar' }
			] });

		testQuery('Using a vector without character.only', 'lapply(c("a", "b", "c"), library)', { print:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '1@library', functionName: 'library', value: '"a"' },
			{ nodeId: '1@library', functionName: 'library', value: '"b"' },
			{ nodeId: '1@library', functionName: 'library', value: '"c"' }
		] });

		testQuery('Using a vector to load (missing elements)', 'lapply(c("x", u), library, character.only = TRUE)', { print:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '1@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'c("x", u)', argumentId: '1:8' },
		] });

		testQuery('Using an aliased vector to load (missing elements)', 'x <- c("x", u)\nlapply(x, library, character.only = TRUE)', { print:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '2@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'x', argumentId: '2:8' },
		] });

		testQuery('Using a vector to load', 'lapply(c("foo", "bar", "baz"), library, character.only = TRUE)', { print:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '1@library', functionName: 'library', value: 'foo' },
			{ nodeId: '1@library', functionName: 'library', value: 'bar' },
			{ nodeId: '1@library', functionName: 'library', value: 'baz' }
		] });

		testQuery('Using a vector to load by variable', 'v <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', { print:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Intermix another library call', 'library(foo)\nv <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', {
			print:   [{ nodeId: '3@lapply', functionName: 'lapply', value: 'stdout' }],
			library: [
				{ nodeId: '1@library', functionName: 'library', value: 'foo' },
				{ nodeId: '3@library', functionName: 'library', value: 'a' },
				{ nodeId: '3@library', functionName: 'library', value: 'b' },
				{ nodeId: '3@library', functionName: 'library', value: 'c' }
			]
		});

		testQuery('Using a nested vector to load', 'lapply(c(c("a", "b"), "c"), library, character.only = TRUE)', { print:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '1@library', functionName: 'library', value: 'a' },
			{ nodeId: '1@library', functionName: 'library', value: 'b' },
			{ nodeId: '1@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a nested vector by variable', 'v <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { print:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a vector by variable (with distractor)', 'if(u) {v <- 42}\nv <- c(c("a", "b"), "c")\nc <- 4\nlapply(v, library, character.only = TRUE)', { print:   [{ nodeId: '4@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '4@library', functionName: 'library', value: 'a' },
			{ nodeId: '4@library', functionName: 'library', value: 'b' },
			{ nodeId: '4@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a vector (but c is redefined)', 'c <- print\nv <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { print:   [{ nodeId: '3@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '3@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'v', argumentId: '3:8' },
		] });

		testQuery('Using a vector by variable (real world)', 'packages <- c("ggplot2", "dplyr", "tidyr")\nlapply(packages, library, character.only = TRUE)', { print:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout' }], library: [
			{ nodeId: '2@library', functionName: 'library', value: 'ggplot2' },
			{ nodeId: '2@library', functionName: 'library', value: 'dplyr'  },
			{ nodeId: '2@library', functionName: 'library', value: 'tidyr' }
		] });

		testQuery('Using a deeply nested vector by variable', 'v <- c(c(c("a", c("b")), "c"), "d", c("e", c("f", "g")))\nlapply(v, library, character.only = TRUE)', { print:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout' }], library: [
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

	describe('Remote installs', () => {
		/* every call here is namespaced, so the `::` the library category reports comes with it; `1:1` is the call */
		function testInstall(name: string, code: string, fn: string, value: string, target: Partial<DependencyInfo>, pkg = 'remotes') {
			testQuery(name, code, {
				library: [{ nodeId: `1@${fn}`, functionName: '::', value: pkg }],
				remote:  [{ nodeId: '1:1', functionName: Identifier.make(fn, pkg), value, ...target }]
			});
		}

		testInstall('namespaced', 'remotes::install_github("user/repo")', 'install_github', 'user/repo', { packageName: 'repo' });
		testInstall('devtools re-exports the same call', 'devtools::install_github(repo = "user/repo")', 'install_github', 'user/repo', { packageName: 'repo' }, 'devtools');
		testInstall('a pinned revision', 'remotes::install_github("user/repo@v1.2")', 'install_github', 'user/repo@v1.2', { packageName: 'repo', revision: 'v1.2' });
		testInstall('a package in a subdirectory', 'remotes::install_github("user/repo/pkg")', 'install_github', 'user/repo/pkg', { packageName: 'pkg' });
		testInstall('an archive url', 'remotes::install_url("https://x.org/src/pkg_1.0.tar.gz")', 'install_url', 'https://x.org/src/pkg_1.0.tar.gz', { packageName: 'pkg' });
		testInstall('a clone url', 'remotes::install_git("https://gitlab.com/user/repo.git")', 'install_git', 'https://gitlab.com/user/repo.git', { packageName: 'repo' });
		testInstall('pak with its source prefix', 'pak::pkg_install("github::user/repo")', 'pkg_install', 'github::user/repo', { packageName: 'repo' }, 'pak');
		testInstall('a reference we cannot resolve names nothing', 'remotes::install_github(x)', 'install_github', Unknown, { lexemeOfArgument: 'x', argumentId: '1:25' });

		/* nothing states the package of a bare call, the loaded library is what makes it resolve at all */
		testQuery('the bare name once the library is loaded', 'library(remotes)\ninstall_github("user/repo")', {
			library: [{ nodeId: '1@library', functionName: 'library', value: 'remotes' }],
			remote:  [{ nodeId: '2@install_github', functionName: 'install_github', value: 'user/repo', packageName: 'repo' }]
		});
		/* a CRAN install is no remote one, whatever it installs comes from a configured repository */
		testQuery('install.packages is no remote install', 'install.packages("dplyr")', {});
	});

	describe('Sourced files', () => {
		for(const sourceFn of [
			'source_url',
			'source_gist'
		] as const) {
			testQuery(`${sourceFn}`, `${sourceFn}("a")`, { source: [{ nodeId: `1@${sourceFn}`, functionName: sourceFn, value: 'a' }] });
		}

		testQuery('Single source', 'source("test/file.R")', { source: [{ nodeId: '1@source', functionName: 'source', value: 'test/file.R' }] });

		testQuery('Single source variable', 'a <- "test/file.R"; source("test/file.R")', { source: [{ nodeId: '1@source', functionName: 'source', value: 'test/file.R' }] });

		testQuery('source with empty string', 'source("")', { source: [{ nodeId: '1@source', functionName: 'source', value: 'stdin', lexemeOfArgument: '""', argumentId: '1:8' }] });

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
			testQuery(`${readFn}`, `${readFn}("a")`, { read: [{ nodeId: `1@${readFn}`, functionName: readFn, value: 'a' }] });
		}

		for(const readFn of [
			'dbReadTable',
			'dbReadTableArrow'
		] as const) {
			testQuery(`${readFn}`, `${readFn}(obj, "a")`, { read: [{ nodeId: `1@${readFn}`, functionName: readFn, value: 'a' }] });
		}

		testQuery('read.table', "read.table('test.csv')", { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }] });
		testQuery('read_csv', "read_csv('test.csv')", { read: [{ nodeId: '1@read_csv', functionName: 'read_csv', value: 'test.csv' }] });
		testQuery('gzfile', 'gzfile("test.gz", "rb")', { read: [{ nodeId: '1@gzfile', functionName: 'gzfile', value: 'test.gz' }] });
		testQuery('With Argument', 'gzfile(open="rb",description="test.gz")', { read: [{ nodeId: '1@gzfile', functionName: 'gzfile', value: 'test.gz' }] });
		testQuery('write mode only', 'gzfile("test.gz", "wb")', { read: [] });

		testQuery('unknown read', 'read.table(x)', { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'unknown', lexemeOfArgument: 'x', argumentId: '1:12' }] });

		describe('Bundled datasets', () => {
			testQuery('by symbol', 'data(mtcars)', { read: [{ nodeId: '1@data', functionName: 'data', value: 'mtcars' }] });
			testQuery('by string', 'data("iris")', { read: [{ nodeId: '1@data', functionName: 'data', value: 'iris' }] });
			testQuery('listing them all reads nothing', 'data()', {});
		});

		/* only a value we failed to resolve may be missing, fetched or rebound, so inline data must not look like one */
		describe('Inline data is no unresolved path', () => {
			testQuery('constructed from constants', 'matrix(0, 2, 2)',
				{ read: [{ nodeId: '1@matrix', functionName: 'matrix', value: Constant, lexemeOfArgument: '0', argumentId: '1:8' }] });
			testQuery('constructed from a vector of constants', 'matrix(c(1, 2), 1, 2)',
				{ read: [{ nodeId: '1@matrix', functionName: 'matrix', value: Constant, lexemeOfArgument: 'c(1, 2)', argumentId: '1:8' }] });
			testQuery('constructed from a constant local', 'x <- 0\nmatrix(x, 2, 2)',
				{ read: [{ nodeId: '2@matrix', functionName: 'matrix', value: Constant, lexemeOfArgument: 'x', argumentId: '2:8' }] });
			testQuery('data that does not resolve stays unknown', 'matrix(f(), 2, 2)',
				{ read: [{ nodeId: '1@matrix', functionName: 'matrix', value: Unknown, lexemeOfArgument: 'f()', argumentId: '1:8' }] });
		});

		testQuery('single read (variable)', 'x <- "test.csv"; read.table(x)', { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }] });
		testQuery('read (path built in a local)', 'p <- file.path("data", "x.csv")\nread.csv(p)',
			{ read: [{ nodeId: '2@read.csv', functionName: 'read.csv', value: 'data/x.csv' }] });
		testQuery('write (path built in a local)', 'p <- file.path("out", "r.csv")\nwrite.csv(x, p)',
			{ write: [{ nodeId: '2@write.csv', functionName: 'write.csv', value: 'out/r.csv' }] });

		describe('Only if file parameter', () => {
			testQuery('parse', 'parse(file="test.R")', { read: [{ nodeId: '1@parse', functionName: 'parse', value: 'test.R' }] });
			testQuery('parse text', 'parse(text="test.R")', {});
		});

		/* a loop marks its body as nse, but unlike a quotation the body really is evaluated */
		describe('Braceless loop body', () => {
			/* the variable runs over the sequence, so each of its elements is read */
			testQuery('for', 'for(f in c("a.csv","b.csv")) read.csv(f)',
				{ read: [
					{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'a.csv' },
					{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'b.csv' }
				] });
			testQuery('for (constant)', 'for(f in c("a.csv")) read.csv("test.csv")',
				{ read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'test.csv' }] });
			testQuery('while', 'while(TRUE) read.csv("test.csv")',
				{ read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'test.csv' }] });
			testQuery('repeat', 'repeat read.csv("test.csv")',
				{ read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'test.csv' }] });
			testQuery('nested', 'for(i in 1:2) while(TRUE) read.csv("test.csv")',
				{ read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'test.csv' }] });
			testQuery('braced stays the same', 'for(f in c("a.csv","b.csv")) { read.csv(f) }',
				{ read: [
					{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'a.csv' },
					{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'b.csv' }
				] });
			/* a real quotation within the body must still be suppressed */
			testQuery('quoted body', 'for(i in 1:2) quote(read.csv("test.csv"))', {});
			testQuery('substituted body', 'while(TRUE) substitute(read.csv("test.csv"))', {});
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
			'agg_png',
			'agg_webp',
			'Export',
			'windows'
		]) {
			testQuery(`${writeFn}`, `${writeFn}("a")`, { write: [{ nodeId: `1@${writeFn}`, functionName: writeFn, value: 'a' }] });
		}

		// regression: once the owning library is loaded the call resolves to that origin namespace, so a wrong
		// `package` attribution makes the namespace check drop the call (e.g. ggsave was attributed to `ggplot`)
		testQuery('ggsave after library', 'library(ggplot2)\nggsave("a")', {
			library: [{ nodeId: '1@library', functionName: 'library', value: 'ggplot2' }],
			write:   [{ nodeId: '2@ggsave', functionName: 'ggsave', value: 'a' }]
		});
		testQuery('write_dta after library', 'library(haven)\nwrite_dta(d, "a")', {
			library: [{ nodeId: '1@library', functionName: 'library', value: 'haven' }],
			write:   [{ nodeId: '2@write_dta', functionName: 'write_dta', value: 'a' }]
		});

		testQuery('visSave', 'visSave(obj, "a")', { write: [{ nodeId: '1@visSave', functionName: 'visSave', value: 'a' }] });
		testQuery('save_graph', 'save_graph(obj, "a")', { write: [{ nodeId: '1@save_graph', functionName: 'save_graph', value: 'a' }] });
		testQuery('export_graph', 'export_graph(file_name = "a")', { write: [{ nodeId: '1@export_graph', functionName: 'export_graph', value: 'a' }] });

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

		testQuery('Unknown write', 'write.csv(data, file=u)', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'unknown', lexemeOfArgument: 'u', argumentId: '1:22' }] });
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
		/* a plot lands in whatever device is open, so the file is what the opener named */
		describe('Devices', () => {
			testQuery('the plots between an opener and its close land in its file',
				'pdf("a.pdf")\nplot(x)\nlines(y)\ndev.off()\nplot(onScreen)', {
					write:     [{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' }],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', value: 'a.pdf' },
						{ nodeId: '5@plot', functionName: 'plot' },
						{ nodeId: '3@lines', functionName: 'lines', value: 'a.pdf', linkedIds: ['2@plot'] }
					]
				});
			testQuery('each device takes the plots of its own block',
				'pdf("a.pdf")\nplot(x)\ndev.off()\npng("b.png")\nhist(z)\ndev.off()', {
					write: [
						{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' },
						{ nodeId: '4@png', functionName: 'png', value: 'b.png' }
					],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', value: 'a.pdf' },
						{ nodeId: '5@hist', functionName: 'hist', value: 'b.png' }
					]
				});
		});
		describe('Creation', () => {
			for(const f of ['ggplot', 'tinyplot', 'plot', 'bootcurve']) {
				testQuery(f, `${f}()`, { visualize: [{ nodeId: `1@${f}`, functionName: f }] });
			}
		});
		describe('Namespace disambiguation', () => {
			// regression: an unqualified `map` plot entry used to swallow purrr::map / dplyr::map
			testQuery('purrr::map is not a visualization', 'purrr::map(x, f)', {
				library:   [{ nodeId: '1@map', functionName: '::', value: 'purrr' }],
				visualize: []
			});
			testQuery('dplyr::map is not a visualization', 'dplyr::map(x, f)', {
				library:   [{ nodeId: '1@map', functionName: '::', value: 'dplyr' }],
				visualize: []
			});
			// regression: the ggplot-style calls other packages export were all attributed to ggplot2, so a
			// qualified call to the package that really exports them was dropped by the namespace check
			testQuery('a theme keeps its own package', 'plot()\nggthemes::theme_wsj()', {
				library:   [{ nodeId: '2@theme_wsj', functionName: '::', value: 'ggthemes' }],
				visualize: [
					{ nodeId: '1@plot', functionName: 'plot' },
					{ nodeId: '2@ggthemes::theme_wsj', functionName: Identifier.make('theme_wsj', 'ggthemes'), linkedIds: [1] }
				]
			});
			testQuery('a plot creator keeps its own package', 'plotly::ggplotly(p)', {
				library:   [{ nodeId: '1@ggplotly', functionName: '::', value: 'plotly' }],
				visualize: [{ nodeId: '1@plotly::ggplotly', functionName: Identifier.make('ggplotly', 'plotly') }]
			});
			testQuery('maps::map stays a visualization', 'maps::map(x)', {
				library:   [{ nodeId: '1@map', functionName: '::', value: 'maps' }],
				visualize: [{ nodeId: '1@maps::map', functionName: Identifier.make('map', 'maps') }]
			});
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
		for(const wo of ['w', 'wb', 'wt', 'a', 'ab', 'at'] as const) {
			testQuery('write only file connection', `file("test.txt", "${wo}")`, {
				write: [{ nodeId: '1@file', functionName: 'file', value: 'test.txt' }]
			});
		}
	});

	describe('Overwritten Function', () => {
		testQuery('read.csv (overwritten by user)', "read.csv <- function(a) print(a); read.csv('test.csv')", {
			read:  [],
			print: [{ value: 'stdout', functionName: 'read.csv', nodeId: '1@[2]read.csv' }],
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
		testQuery('extends a built-in category', 'read.csv("a.csv")\nmy_read("b.dat")', {
			read: [
				{ value: 'a.csv', functionName: 'read.csv', nodeId: '1@read.csv' },
				{ value: 'b.dat', functionName: 'my_read', nodeId: '2@my_read' }
			]
		}, {
			additionalCategories: {
				read: { functions: [{ name: 'my_read', argIdx: 0, resolveValue: true }] }
			}
		});
		testQuery('addon', 'cat("a")\nx <- 2', {
			write:      [{ value: 'stdout', functionName: 'cat', nodeId: '1@cat' }],
			assignment: [{ lexemeOfArgument: '2', functionName: '<-', nodeId: '2@<-', value: Constant, argumentId: '2:6' }]
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
				{ nodeId: '1@test_that', functionName: 'test_that', value: 'trigonometric functions match identities', linkedIds: [47, 36, 20] }
			]
		});

		testQuery('standalone expect_equal is not detected', 'expect_equal(1 + 1, 2)', {});

		testQuery('expect_equal nested links to test_that via linkedIds', `test_that("basic", {
  expect_equal(1, 1)
})`, {
			test: [
				{ nodeId: '1@test_that', functionName: 'test_that', value: 'basic', linkedIds: ['2@expect_equal'] }
			]
		});

		testQuery('checkmate assertion nested links to test_that via linkedIds', `test_that("checks", {
  assert_true(1 == 1)
})`, {
			test: [
				{ nodeId: '1@test_that', functionName: 'test_that', value: 'checks', linkedIds: ['2@assert_true'] }
			]
		});

		testQuery('standalone checkmate assert_true is not detected', 'assert_true(x > 0)', {});
	});

	describe('Read from string', () => {
		testQuery('read.csv text parameter', 'a <- read.csv(text="hello, world")', {
			read:  [],
			write: []
		});

		testQuery('read.csv file (positional) arg has priority', 'a <- read.csv("test.csv", text="hello, world")', {
			read: [
				{
					functionName: 'read.csv',
					nodeId:       7,
					value:        'test.csv',
				},
			],
			write: []
		});

		testQuery('read.csv file arg (named) has priority', 'a <- read.csv(file="test.csv", text="hello, world")', {
			read: [
				{
					functionName: 'read.csv',
					nodeId:       8,
					value:        'test.csv',
				},
			],
			write: []
		});
	});


	describe('The categories agree with the built-in configuration', () => {
		const resources = new Map<string, { idx: number, name: string }>();
		for(const d of DefaultBuiltinConfig) {
			const info = d.type !== 'constant' ? (d as { config?: BuiltInFnInfo }).config : undefined;
			const idx = info?.sig?.findIndex(([, p]) => (p & ArgProp.Resource) !== 0) ?? -1;
			if(idx >= 0) {
				for(const n of builtInNames(d)) {
					resources.set(Identifier.getName(n), { idx, name: (info?.sig as FnSig)[idx][0] });
				}
			}
		}
		test.each([['read', ReadFunctions], ['write', WriteFunctions], ['other paths', OtherPathFunctions]] as const)(
			'%s', (_name, list) => {
				for(const f of list) {
					const declared = resources.get(f.name);
					if(declared === undefined) {
						continue;
					}
					if(f.argIdx !== undefined && f.argIdx !== 'unnamed') {
						assert.strictEqual(f.argIdx, declared.idx, `${f.package}::${f.name} takes its resource from another position than the built-in states`);
					}
					if(f.argName !== undefined) {
						assert.strictEqual(f.argName, declared.name, `${f.package}::${f.name} names its resource differently than the built-in states`);
					}
				}
			});
	});
	/**
	 * The signature database knows what a package exports, so it settles whether an entry names the right one.
	 * A wrong package is invisible in a bare snippet and only drops the call once the owning library is loaded.
	 */
	describe('Package attribution', () => {
		/* the database records these as an S4 generic or an S3 method, so their name is not in the export list */
		const recordedElsewhere = new Set(['rast', 'vect', 'writeRaster', 'writeVector', 'writeCDF', 'readMat', 'writeMat', 'open.nc', 'create.nc']);

		test('every entry names a package that exports it', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest('1');
			const sources = analyzer.inspectContext().deps.signatureSources();
			const exportsOf = (pkg: string): string[] => sources.filter(s => s.packageNames().includes(pkg))
				.flatMap(s => [...s.lookup(pkg)?.exported ?? [], ...(s.functions(pkg) ?? []).map(f => f.name)]);
			for(const [category, { functions }] of Object.entries(DefaultDependencyCategories)) {
				for(const f of functions) {
					const known = f.package === undefined ? [] : exportsOf(f.package);
					if(known.length === 0 || recordedElsewhere.has(f.name)) {
						continue;
					}
					assert.include(known, f.name, `${category}: ${f.package} does not export ${f.name}`);
				}
			}
		});
	});
}));
