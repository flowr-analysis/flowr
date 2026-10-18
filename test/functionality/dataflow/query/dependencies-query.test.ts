import { assertQuery } from '../../_helper/query';
import type { FlowrCapabilityId } from '../../../../src/r-bridge/data/get';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { label } from '../../_helper/label';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';
import {
	type DependenciesQuery,
	type DependenciesQueryResult,
	defaultDependencyCategories,
	type DependencyInfo,
	Attached,
	Constant,
	Unknown
} from '../../../../src/queries/catalog/dependencies-query/dependencies-query-format';
import type { NodeId } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AstIdMap } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { assert, describe, test } from 'vitest';
import { assumeLoadedPackages, skipTestBecauseConfigNotMet, withTreeSitter } from '../../_helper/shell';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { DefaultBuiltinConfig } from '../../../../src/dataflow/environments/default-builtin-config';
import { builtInNames, BuiltInIndex } from '../../../../src/dataflow/environments/query-fn-props';
import type { BuiltInFnInfo } from '../../../../src/dataflow/environments/built-in-props';
import { ArgProp, SemanticCallTag } from '../../../../src/dataflow/environments/built-in-props';
import { readFunctions } from '../../../../src/queries/catalog/dependencies-query/function-info/read-functions';
import { writeFunctions } from '../../../../src/queries/catalog/dependencies-query/function-info/write-functions';
import { OtherPathFunctions } from '../../../../src/queries/catalog/dependencies-query/function-info/other-path-functions';
import { RFunctionCall } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { FlowrAnalyzerContext } from '../../../../src/project/context/flowr-analyzer-context';
import { FlowrConfig } from '../../../../src/config';

assumeLoadedPackages('car', 'ggplot2', 'ggthemes', 'jmcm', 'magrittr', 'maps', 'plotly', 'remotes', 'rlang', 'tinyplot');

const defaultCtx = new FlowrAnalyzerContext(FlowrConfig.default());

const emptyDependencies: Omit<DependenciesQueryResult, '.meta'> = { library: [], remote: [], source: [], read: [], write: [], visualize: [], transform: [], test: [], statistics: [] };

function decodeIds(res: Partial<DependenciesQueryResult>, idMap: AstIdMap): Partial<DependenciesQueryResult> {
	const out: Partial<DependenciesQueryResult> = {
		...res
	};
	const decode = (id: NodeId) => typeof id === 'number' ? id : SlicingCriterion.parse(String(id) as SlicingCriterion, idMap);
	for(const [key, value] of Object.entries(res) as [keyof DependenciesQueryResult, DependencyInfo[]][]) {
		if(key === '.meta') {
			continue;
		}
		out[key] = value.map(({ nodeId, linkedIds, argumentId, parts, ...rest }) => ({
			nodeId:     nodeId === undefined ? undefined : decode(nodeId),
			linkedIds:  linkedIds?.map(decode),
			argumentId: argumentId === undefined ? undefined : decode(argumentId),
			parts:      parts?.map(decode),
			...rest
		}));
	}
	return out;
}

/** what a top-level call with a visible result prints on its own */
function printed(nodeId: NodeId | string, functionName: DependencyInfo['functionName']): DependencyInfo {
	return { nodeId, functionName, value: 'stdout', implicit: true };
}

describe('Dependencies Query', withTreeSitter(parser => {
	/** handles slicing criteria for the node ids */
	function testQuery(
		name: string,
		code: string,
		expected: Partial<DependenciesQueryResult>,
		query: Partial<DependenciesQuery> = {},
		caps: readonly FlowrCapabilityId[] = [],
		assumeLoaded?: readonly string[]
	): void {
		assertQuery(label(name, caps), parser, code, [{ type: 'dependencies', ...query }], ({ normalize }) => ({
			dependencies: {
				...emptyDependencies,
				...decodeIds(expected, normalize.idMap)
			}
		}), false, assumeLoaded);
	}

	/**
	 * The 'Custom' block every category runs: register `fnName` via `functions`, check it resolves both by
	 * index and by name, then check `ignoreDefaultFunctions`/`enabledCategories` toggle the built-in default
	 * (`defaultCode`/`defaultExpected`) as expected. `extra` runs additional category-specific cases in the block.
	 */
	function testCustomFunctions(
		category: 'library' | 'source' | 'read' | 'write',
		functions: Partial<DependenciesQuery>,
		fnName: string,
		defaultCode: string,
		defaultExpected: Partial<DependenciesQueryResult>,
		disabledOthers: (keyof DependenciesQueryResult)[],
		disabledExpected: Partial<DependenciesQueryResult> = {},
		extra?: () => void
	): void {
		describe('Custom', () => {
			/* nothing states that a custom function returns invisibly, so a top-level call to it prints its result */
			const expected: Partial<DependenciesQueryResult> = { [category]: [{ nodeId: `1@${fnName}`, functionName: fnName, value: 'my-custom-file' }],
				...category === 'write' ? {} : { write: [printed(`1@${fnName}`, fnName)] } };
			testQuery('Custom (by index)', `${fnName}(1, "my-custom-file", 2)`, expected, functions);
			testQuery('Custom (by name)', `${fnName}(num1 = 1, num2 = 2, file = "my-custom-file")`, expected, functions);
			testQuery('Ignore default', defaultCode, {}, { ignoreDefaultFunctions: true });
			testQuery('Disabled', defaultCode, disabledExpected, { enabledCategories: disabledOthers });
			testQuery('Enabled', defaultCode, defaultExpected, { enabledCategories: [category] });
			extra?.();
		});
	}

	describe('Simple', () => {
		/* `x + 1` at the top level is echoed, so it is an output even though nothing else happens */
		testQuery('No dependencies', 'x + 1', { write: [{ nodeId: 2, functionName: '+', value: 'stdout', implicit: true }] });
	});

	describe('Through the dataflow', () => {
		testQuery('a handle reads what it was opened on', 'con <- file("a.txt", "r")\nl <- readLines(con)', {
			read: [{ nodeId: '1@file', functionName: 'file', value: 'a.txt', assignedTo: 'con' }, { nodeId: '2@readLines', functionName: 'readLines', value: 'a.txt', assignedTo: 'l' }]
		});
		testQuery('a handle writes what it was opened on', 'con <- file("o.txt", "w")\nwriteLines("a", con)', {
			write: [{ nodeId: '1@file', functionName: 'file', value: 'o.txt' }, { nodeId: '2@writeLines', functionName: 'writeLines', value: 'o.txt' }]
		});
		testQuery('a default parameter names the file', 'ld <- function(p = "def.csv") read.csv(p)\nld()', {
			read:  [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'def.csv' }],
			write: [{ nodeId: '2@ld', functionName: 'ld', value: 'stdout', implicit: true }]
		});
		testQuery('a function ending in an invisible call echoes nothing', 'save_it <- function(p) write.csv(d, p)\nsave_it("r.csv")', {
			write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'r.csv', inputVariables: ['d'] }]
		});
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
			/* only `loadNamespace` hands back what it loaded visibly */
			testQuery(`${loadFn} (${str ? 'string' : 'symbol'})`, `${loadFn}(${str ? '"a"' : 'a'})`, { library: [{ nodeId: '1@' + loadFn, functionName: loadFn, value: 'a' }],
				...loadFn === 'loadNamespace' ? { write: [printed('1@loadNamespace', loadFn)] } : {} });
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

		/* without character.only the symbol is the package name, whatever the variable of that name holds */
		testQuery('Library of a symbol that names a variable', 'p <- "dplyr"\nlibrary(p)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'p' }
		] });

		testQuery('Library of a variable with character only', 'p <- "dplyr"\nlibrary(p, character.only=TRUE)', { library: [
			{ nodeId: '2@library', functionName: 'library', value: 'dplyr' }
		] });

		/* with character.only the symbol is read as a variable, and there is none of that name */
		testQuery('Library of a package name with character only', 'library(dplyr, character.only=TRUE)', { library: [
			{ nodeId: '1@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'dplyr', argumentId: '1:9' }
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

		testQuery('rlang on_package_load', 'on_load({ x <- read.csv("a.csv") })\non_package_load("dplyr", message("hi"))', { library: [{ nodeId: '2@on_package_load', functionName: 'on_package_load', value: 'dplyr' }], read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'a.csv', assignedTo: 'x' }], write: [{ nodeId: '2@message', functionName: 'message', value: 'stdout' }] });

		testQuery('Load implicitly', 'foo::x\nbar:::y()', {
			write: [
				{ nodeId: 0, functionName: 'foo::x', value: 'stdout', implicit: true },
				{ nodeId: 2, functionName: Identifier.make('y' as never, 'bar' as never, true), value: 'stdout', implicit: true }
			],
			library: [
				{ nodeId: '1@x', functionName: '::', value: 'foo' },
				{ nodeId: '2@y', functionName: ':::', value: 'bar' }
			] }, {}, ['accessing-exported-names', 'accessing-internal-names']);

		testQuery('an exported name accessed with ::: resolves the same, unflagged', 'stats:::median(1:3)', {
			write:   [{ nodeId: 5, functionName: Identifier.make('median' as never, 'stats' as never, true), value: 'stdout', implicit: true }],
			library: [{ nodeId: '1@median', functionName: ':::', value: 'stats' }]
		}, {}, ['namespace-exports']);

		testQuery('a foreign call is recognized as one', '.Call("my_c_fn", 1)\n.Fortran("my_f_sub", x = 1)', {
			write: [
				{ nodeId: '1@.Call', functionName: '.Call', value: 'stdout', implicit: true },
				{ nodeId: '2@.Fortran', functionName: '.Fortran', value: 'stdout', implicit: true }
			] }, {}, ['foreign-function-interface']);

		testQuery('Using a vector without character.only', 'lapply(c("a", "b", "c"), library)', { write:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '1@library', functionName: 'library', value: '"a"' },
			{ nodeId: '1@library', functionName: 'library', value: '"b"' },
			{ nodeId: '1@library', functionName: 'library', value: '"c"' }
		] });

		testQuery('Using a vector to load (missing elements)', 'lapply(c("x", u), library, character.only = TRUE)', { write:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '1@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'c("x", u)', argumentId: '1:8' },
		] });

		testQuery('Using an aliased vector to load (missing elements)', 'x <- c("x", u)\nlapply(x, library, character.only = TRUE)', { write:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			// We currently don't support resolving that "x" and some unknown library is loaded
			{ nodeId: '2@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'x', argumentId: '2:8' },
		] });

		testQuery('Using a vector to load', 'lapply(c("foo", "bar", "baz"), library, character.only = TRUE)', { write:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '1@library', functionName: 'library', value: 'foo' },
			{ nodeId: '1@library', functionName: 'library', value: 'bar' },
			{ nodeId: '1@library', functionName: 'library', value: 'baz' }
		] });

		testQuery('Using a vector to load by variable', 'v <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', { write:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Intermix another library call', 'library(foo)\nv <- c("a", "b", "c")\nlapply(v, library, character.only = TRUE)', {
			write:   [{ nodeId: '3@lapply', functionName: 'lapply', value: 'stdout', implicit: true }],
			library: [
				{ nodeId: '1@library', functionName: 'library', value: 'foo' },
				{ nodeId: '3@library', functionName: 'library', value: 'a' },
				{ nodeId: '3@library', functionName: 'library', value: 'b' },
				{ nodeId: '3@library', functionName: 'library', value: 'c' }
			]
		});

		testQuery('Using a nested vector to load', 'lapply(c(c("a", "b"), "c"), library, character.only = TRUE)', { write:   [{ nodeId: '1@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '1@library', functionName: 'library', value: 'a' },
			{ nodeId: '1@library', functionName: 'library', value: 'b' },
			{ nodeId: '1@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a nested vector by variable', 'v <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { write:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '2@library', functionName: 'library', value: 'a' },
			{ nodeId: '2@library', functionName: 'library', value: 'b' },
			{ nodeId: '2@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a vector by variable (with distractor)', 'if(u) {v <- 42}\nv <- c(c("a", "b"), "c")\nc <- 4\nlapply(v, library, character.only = TRUE)', { write:   [{ nodeId: '4@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '4@library', functionName: 'library', value: 'a' },
			{ nodeId: '4@library', functionName: 'library', value: 'b' },
			{ nodeId: '4@library', functionName: 'library', value: 'c' }
		] });

		testQuery('Using a vector (but c is redefined)', 'c <- print\nv <- c(c("a", "b"), "c")\nlapply(v, library, character.only = TRUE)', { write:   [{ nodeId: '3@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '3@library', functionName: 'library', value: 'unknown', lexemeOfArgument: 'v', argumentId: '3:8' },
		] });

		testQuery('Using a vector by variable (real world)', 'packages <- c("ggplot2", "dplyr", "tidyr")\nlapply(packages, library, character.only = TRUE)', { write:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
			{ nodeId: '2@library', functionName: 'library', value: 'ggplot2' },
			{ nodeId: '2@library', functionName: 'library', value: 'dplyr'  },
			{ nodeId: '2@library', functionName: 'library', value: 'tidyr' }
		] });

		testQuery('Using a deeply nested vector by variable', 'v <- c(c(c("a", c("b")), "c"), "d", c("e", c("f", "g")))\nlapply(v, library, character.only = TRUE)', { write:   [{ nodeId: '2@lapply', functionName: 'lapply', value: 'stdout', implicit: true }], library: [
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

		testCustomFunctions('library', { libraryFunctions: [{ package: 'custom', name: 'custom.library', argIdx: 1, argName: 'file' }] }, 'custom.library',
			'library(testLibrary)', { library: [{ nodeId: '1@library', functionName: 'library', value: 'testLibrary' }] },
			['source', 'read', 'write'], {}, () => {
				testQuery('Disabled', 'a::dep', {}, { enabledCategories: [] });
				testQuery('Empty enabled', 'library(testLibrary)', { library: [{ nodeId: '1@library', functionName: 'library', value: 'testLibrary' }] }, { enabledCategories: undefined });
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
		testQuery('the bare name once the library is loaded', 'library(remotes)\ninstall_github("user/repo")', { library: [{ nodeId: '1@library', functionName: 'library', value: 'remotes' }], remote: [{ nodeId: '2@install_github', functionName: 'install_github', value: 'user/repo', packageName: 'repo' }] });
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

		testCustomFunctions('source', { sourceFunctions: [{ name: 'source.custom.file', argIdx: 1, argName: 'file' }] }, 'source.custom.file',
			'source("test/file.R")', { source: [{ nodeId: '1@source', functionName: 'source', value: 'test/file.R' }] },
			['read', 'write', 'library']);
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
			testQuery(`${readFn}`, `${readFn}("a")`, { read: [{ nodeId: `1@${readFn}`, functionName: readFn, value: 'a' }], write: [printed(`1@${readFn}`, readFn)] });
		}

		for(const readFn of [
			'dbReadTable',
			'dbReadTableArrow'
		] as const) {
			testQuery(`${readFn}`, `${readFn}(obj, "a")`, { read: [{ nodeId: `1@${readFn}`, functionName: readFn, value: 'a' }], write: [printed(`1@${readFn}`, readFn)] });
		}

		testQuery('read.table', "read.table('test.csv')", { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }], write: [printed('1@read.table', 'read.table')] });
		testQuery('read_csv', "read_csv('test.csv')", { read: [{ nodeId: '1@read_csv', functionName: 'read_csv', value: 'test.csv' }], write: [printed('1@read_csv', 'read_csv')] });
		testQuery('gzfile', 'gzfile("test.gz", "rb")', { read: [{ nodeId: '1@gzfile', functionName: 'gzfile', value: 'test.gz' }], write: [printed('1@gzfile', 'gzfile')] });
		testQuery('With Argument', 'gzfile(open="rb",description="test.gz")', { read: [{ nodeId: '1@gzfile', functionName: 'gzfile', value: 'test.gz' }], write: [printed('1@gzfile', 'gzfile')] });
		testQuery('write mode only', 'gzfile("test.gz", "wb")', { read: [], write: [printed('1@gzfile', 'gzfile')] });

		testQuery('unknown read', 'read.table(x)', { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'unknown', lexemeOfArgument: 'x', argumentId: '1:12' }], write: [printed('1@read.table', 'read.table')] });

		describe('Bundled datasets', () => {
			testQuery('by symbol', 'data(mtcars)', { read: [{ nodeId: '1@data', functionName: 'data', value: 'mtcars' }] });
			testQuery('by string', 'data("iris")', { read: [{ nodeId: '1@data', functionName: 'data', value: 'iris' }] });
			testQuery('listing them all reads nothing', 'data()', {});
		});

		/* only a value we failed to resolve may be missing, fetched or rebound, so inline data must not look like one */
		describe('Inline data is no unresolved path', () => {
			testQuery('constructed from constants', 'matrix(0, 2, 2)',
				{ read: [{ nodeId: '1@matrix', functionName: 'matrix', value: Constant, lexemeOfArgument: '0', argumentId: '1:8' }], write: [printed('1@matrix', 'matrix')] });
			testQuery('constructed from a vector of constants', 'matrix(c(1, 2), 1, 2)',
				{ read: [{ nodeId: '1@matrix', functionName: 'matrix', value: Constant, lexemeOfArgument: 'c(1, 2)', argumentId: '1:8' }], write: [printed('1@matrix', 'matrix')] });
			testQuery('constructed from a constant local', 'x <- 0\nmatrix(x, 2, 2)',
				{ read: [{ nodeId: '2@matrix', functionName: 'matrix', value: Constant, lexemeOfArgument: 'x', argumentId: '2:8' }], write: [printed('2@matrix', 'matrix')] });
			testQuery('data that does not resolve stays unknown', 'matrix(f(), 2, 2)',
				{ read: [{ nodeId: '1@matrix', functionName: 'matrix', value: Unknown, lexemeOfArgument: 'f()', argumentId: '1:8' }], write: [printed('1@matrix', 'matrix')] });
		});

		testQuery('single read (variable)', 'x <- "test.csv"; read.table(x)', { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }], write: [printed('1@read.table', 'read.table')] });
		testQuery('read (path built in a local)', 'p <- file.path("data", "x.csv")\nread.csv(p)',
			{ read: [{ nodeId: '2@read.csv', functionName: 'read.csv', value: 'data/x.csv' }], write: [printed('2@read.csv', 'read.csv')] });
		testQuery('write (path built in a local)', 'p <- file.path("out", "r.csv")\nwrite.csv(x, p)',
			{ write: [{ nodeId: '2@write.csv', functionName: 'write.csv', value: 'out/r.csv', inputVariables: ['x'] }] });

		describe('Only if file parameter', () => {
			testQuery('parse', 'parse(file="test.R")', { read: [{ nodeId: '1@parse', functionName: 'parse', value: 'test.R' }], write: [printed('1@parse', 'parse')] });
			testQuery('parse text', 'parse(text="test.R")', { write: [printed('1@parse', 'parse')] });
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

		/* the read category is off, but `read.table` still prints the frame it read, and outputs are on */
		testCustomFunctions('read', { readFunctions: [{ name: 'read.custom.file', argIdx: 1, argName: 'file' }] }, 'read.custom.file',
			"read.table('test.csv')", { read: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'test.csv' }] },
			['library', 'write', 'source'], { write: [{ nodeId: '1@read.table', functionName: 'read.table', value: 'stdout', implicit: true }] });
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
		testQuery('ggsave after library', 'library(ggplot2)\nggsave("a")', { library: [{ nodeId: '1@library', functionName: 'library', value: 'ggplot2' }], write: [{ nodeId: '2@ggsave', functionName: 'ggsave', value: 'a' }] });
		testQuery('write_dta after library', 'library(haven)\nwrite_dta(d, "a")', { library: [{ nodeId: '1@library', functionName: 'library', value: 'haven' }], write: [{ nodeId: '2@write_dta', functionName: 'write_dta', value: 'a', inputVariables: ['d'] }] });

		testQuery('visSave', 'visSave(obj, "a")', { write: [{ nodeId: '1@visSave', functionName: 'visSave', value: 'a', inputVariables: ['obj'] }] });
		testQuery('save_graph', 'save_graph(obj, "a")', { write: [{ nodeId: '1@save_graph', functionName: 'save_graph', value: 'a', inputVariables: ['obj'] }] });
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
		testQuery('cat many args', 'cat(a, b, c, d, e, file)', { write: [{ nodeId: '1@cat', functionName: 'cat', value: 'stdout', inputVariables: ['a', 'b', 'd', 'e'] }] });

		testQuery('Unknown write', 'write.csv(dat, file=u)', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'unknown', lexemeOfArgument: 'u', inputVariables: ['dat'], argumentId: '1:21' }] });
		testQuery('File save', 'save(foo,file="a.Rda")', { write: [{ nodeId: '1@save', functionName: 'save', value: 'a.Rda', inputVariables: ['foo'] }] });

		testQuery('single write (variable)', 'u <- "test.csv"; write.csv(dat, file=u)', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'test.csv', inputVariables: ['dat'] }] });

		describe('try with outfile', () => {
			testQuery('unconfigured', 'try(u)', { write: [{ nodeId: '1@try', functionName: 'try', value: 'stderr', inputVariables: ['u'] }] });
			testQuery('with outfile', 'try(u, outFile="myfile.txt")', { write: [{ nodeId: '1@try', functionName: 'try', value: 'myfile.txt', inputVariables: ['u'] }] });
			testQuery('unconfigured, with silent', 'try(u, silent=TRUE)', { write: [] });
			testQuery('unconfigured, with implicit silent', 'try(u, TRUE)', { write: [] });
			testQuery('with outfile and silent', 'try(u, outFile="myfile.txt", silent=TRUE)', { write: [] });
			testQuery('with outfile and silent b', 'try(u, silent=TRUE, outFile="myfile.txt")', { write: [] });
		});

		testCustomFunctions('write', { writeFunctions: [{ name: 'write.custom.file', argIdx: 1, argName: 'file' }] }, 'write.custom.file',
			'dump("My text", "MyTextFile.txt")', { write: [{ nodeId: '1@dump', functionName: 'dump', value: 'MyTextFile.txt' }] },
			['library', 'read', 'source']);
	});

	describe('Visualize', () => {
		/* a plot lands in whatever device is open, so the file is what the opener named */
		describe('Devices', () => {
			testQuery('the plots between an opener and its close land in its file',
				'pdf("a.pdf")\nplot(x)\nlines(y)\ndev.off()\nplot(onScreen)', {
					write:     [{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' }, { nodeId: '4@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }],
					visualize: [
						/* `parts` says what it takes to produce the file: the addons, and the device around them */
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['3@lines', '1@pdf', '4@dev.off'] },
						{ nodeId: '5@plot', functionName: 'plot', inputVariables: ['onScreen'] },
						{ nodeId: '3@lines', functionName: 'lines', inputVariables: ['y'], value: 'a.pdf', savedTo: 'a.pdf', linkedIds: ['2@plot'], parts: ['1@pdf', '4@dev.off'] }
					]
				});
			testQuery('each device takes the plots of its own block',
				'pdf("a.pdf")\nplot(x)\ndev.off()\npng("b.png")\nhist(z)\ndev.off()', {
					write: [
						{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' },
						{ nodeId: '4@png', functionName: 'png', value: 'b.png' },
						{ nodeId: '3@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true },
						{ nodeId: '6@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }
					],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['1@pdf', '3@dev.off'] },
						{ nodeId: '5@hist', functionName: 'hist', inputVariables: ['z'], value: 'b.png', savedTo: 'b.png', parts: ['4@png', '6@dev.off'] }
					]
				});
			// closing the device ends the plot, so what is drawn after it builds whatever is open then
			testQuery('an addon after the close does not build the closed file',
				'pdf("a.pdf")\nplot(x)\ndev.off()\nlines(y)', {
					write:     [{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' }, { nodeId: '3@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['1@pdf', '3@dev.off'] },
						{ nodeId: '4@lines', functionName: 'lines', inputVariables: ['y'], linkedIds: ['2@plot'] }
					]
				});
			testQuery('an addon of the next device does not build the previous file',
				'pdf("a.pdf")\nplot(x)\ndev.off()\npng("b.png")\nlines(y)\ndev.off()', {
					write: [
						{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' },
						{ nodeId: '4@png', functionName: 'png', value: 'b.png' },
						{ nodeId: '3@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true },
						{ nodeId: '6@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }
					],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['1@pdf', '3@dev.off'] },
						{ nodeId: '5@lines', functionName: 'lines', inputVariables: ['y'], value: 'b.png', savedTo: 'b.png', linkedIds: ['2@plot'], parts: ['4@png', '6@dev.off'] }
					]
				});
			/*
			 * Closing the inner device hands drawing back to the outer one, which still shows its own plot, so
			 * `lines(back)` builds `plot(x)` and its file -- checked against R, where it draws without error.
			 */
			testQuery('an addon after a nested close builds the plot the restored device shows',
				'pdf("a.pdf")\nplot(x)\npng("in.png")\nplot(y)\nlines(inner)\ndev.off()\nlines(back)\ndev.off()', {
					write: [
						{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' },
						{ nodeId: '3@png', functionName: 'png', value: 'in.png' },
						{ nodeId: '6@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true },
						{ nodeId: '8@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }
					],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['7@lines', '1@pdf', '8@dev.off'] },
						{ nodeId: '4@plot', functionName: 'plot', inputVariables: ['y'], value: 'in.png', savedTo: 'in.png', parts: ['5@lines', '3@png', '6@dev.off'] },
						{ nodeId: '5@lines', functionName: 'lines', inputVariables: ['inner'], value: 'in.png', savedTo: 'in.png', linkedIds: ['4@plot'], parts: ['3@png', '6@dev.off'] },
						/* the dataflow links it into the inner device, the restored device is what it really draws on */
						{ nodeId: '7@lines', functionName: 'lines', inputVariables: ['back'], value: 'a.pdf', savedTo: 'a.pdf', linkedIds: ['4@plot'], parts: ['1@pdf', '8@dev.off'] }
					]
				});
			testQuery('a device nested in another keeps its own plots and parts',
				'pdf("a.pdf")\nplot(x)\npng("in.png")\nplot(y)\nlines(inner)\ndev.off()\ndev.off()', {
					write: [
						{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' },
						{ nodeId: '3@png', functionName: 'png', value: 'in.png' },
						{ nodeId: '6@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true },
						{ nodeId: '7@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }
					],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['1@pdf', '7@dev.off'] },
						{ nodeId: '4@plot', functionName: 'plot', inputVariables: ['y'], value: 'in.png', savedTo: 'in.png', parts: ['5@lines', '3@png', '6@dev.off'] },
						{ nodeId: '5@lines', functionName: 'lines', inputVariables: ['inner'], value: 'in.png', savedTo: 'in.png', linkedIds: ['4@plot'], parts: ['3@png', '6@dev.off'] }
					]
				});
			testQuery('each creation of a device takes its own addons',
				'pdf("a.pdf")\nplot(x)\nlines(y)\nplot(w)\ntext(tx)\ndev.off()', {
					write:     [{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' }, { nodeId: '6@dev.off', functionName: 'dev.off', value: 'stdout', implicit: true }],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['3@lines', '1@pdf', '6@dev.off'] },
						{ nodeId: '4@plot', functionName: 'plot', inputVariables: ['w'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['5@text', '1@pdf', '6@dev.off'] },
						{ nodeId: '3@lines', functionName: 'lines', inputVariables: ['y'], value: 'a.pdf', savedTo: 'a.pdf', linkedIds: ['2@plot'], parts: ['1@pdf', '6@dev.off'] },
						{ nodeId: '5@text', functionName: 'text', inputVariables: ['tx'], value: 'a.pdf', savedTo: 'a.pdf', linkedIds: ['4@plot'], parts: ['1@pdf', '6@dev.off'] }
					]
				});
			// a device left open still names its file, there is just no closer to report
			testQuery('an unclosed device still names the file it collects',
				'pdf("a.pdf")\nplot(x)\nlines(y)', {
					write:     [{ nodeId: '1@pdf', functionName: 'pdf', value: 'a.pdf' }],
					visualize: [
						{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.pdf', savedTo: 'a.pdf', parts: ['3@lines', '1@pdf'] },
						{ nodeId: '3@lines', functionName: 'lines', inputVariables: ['y'], value: 'a.pdf', savedTo: 'a.pdf', linkedIds: ['2@plot'], parts: ['1@pdf'] }
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
				write:     [{ nodeId: '1@purrr::map', functionName: Identifier.make('map', 'purrr'), value: 'stdout', implicit: true }],
				visualize: []
			});
			testQuery('dplyr::map is not a visualization', 'dplyr::map(x, f)', {
				library:   [{ nodeId: '1@map', functionName: '::', value: 'dplyr' }],
				write:     [{ nodeId: '1@dplyr::map', functionName: Identifier.make('map', 'dplyr'), value: 'stdout', implicit: true }],
				visualize: []
			});
			// regression: the ggplot-style calls other packages export were all attributed to ggplot2, so a
			// qualified call to the package that really exports them was dropped by the namespace check
			testQuery('a theme keeps its own package', 'plot()\nggthemes::theme_wsj()', {
				library:   [{ nodeId: '2@theme_wsj', functionName: '::', value: 'ggthemes' }],
				visualize: [
					{ nodeId: '1@plot', functionName: 'plot', parts: ['2@ggthemes::theme_wsj'] },
					{ nodeId: '2@ggthemes::theme_wsj', functionName: Identifier.make('theme_wsj', 'ggthemes'), linkedIds: [1] }
				],
				write: [{ nodeId: '2@ggthemes::theme_wsj', functionName: Identifier.make('theme_wsj', 'ggthemes'), value: 'stdout', implicit: true }]
			});
			testQuery('a plot creator keeps its own package', 'plotly::ggplotly(p)', { library: [{ nodeId: '1@ggplotly', functionName: '::', value: 'plotly' }], visualize: [{ nodeId: '1@plotly::ggplotly', functionName: Identifier.make('ggplotly', 'plotly'), inputVariables: ['p'] }] });
			testQuery('maps::map stays a visualization', 'maps::map(x)', { library: [{ nodeId: '1@map', functionName: '::', value: 'maps' }], visualize: [{ nodeId: '1@maps::map', functionName: Identifier.make('map', 'maps'), inputVariables: ['x'] }] });
		});
		describe('Modification', () => {
			for(const f of ['coord_trans', 'scale_colour_hue', 'tinyplot_add']) {
				/* the creation reports what is drawn onto it, even without a device to write it to */
				testQuery(f, `plot()\n${f}(x, y, z)`, { visualize: [
					{ nodeId: '1@plot', functionName: 'plot', parts: [`2@${f}`] },
					{ nodeId: `2@${f}`, functionName: f, linkedIds: [1], inputVariables: ['x', 'y', 'z'] }
				], ...(f === 'tinyplot_add' ? {} : { write: [{ nodeId: `2@${f}`, functionName: f, value: 'stdout', implicit: true }] }) });
			}
			testQuery('complex', 'plot()\nx <- 2\ncat(x)\ncoord_trans(x, y, z)', { visualize: [
				{ nodeId: '1@plot', functionName: 'plot', parts: ['4@coord_trans'] },
				{ nodeId: '4@coord_trans', functionName: 'coord_trans', linkedIds: [1], inputVariables: ['x', 'y', 'z'] }
			] }, { enabledCategories: ['visualize'] });
			testQuery('multiple', 'plot()\nx <- 2\ncat(x)\ncoord_trans(x, y, z)\nplot()\ntinyplot_add(x, y, z)', { visualize: [
				{ nodeId: '1@plot', functionName: 'plot', parts: ['4@coord_trans'] },
				{ nodeId: '5@plot', functionName: 'plot', parts: ['6@tinyplot_add'] },
				{ nodeId: '4@coord_trans', functionName: 'coord_trans', linkedIds: [1], inputVariables: ['x', 'y', 'z'] },
				{ nodeId: '6@tinyplot_add', functionName: 'tinyplot_add', linkedIds: [18], inputVariables: ['x', 'y', 'z'] }
			] }, { enabledCategories: ['visualize'] });
		});
	});

	describe('Transform', () => {
		const dplyr = { library: [{ nodeId: '1@library', functionName: 'library', value: 'dplyr' }] };
		const testDplyr = (name: string, code: string, expected: Partial<DependenciesQueryResult>, query: Partial<DependenciesQuery> = {}) => testQuery(name, code, expected, query, [], ['dplyr', 'magrittr']);
		describe('Package attribution', () => {
			testQuery('dplyr attached by the code', 'library(dplyr)\nfilter(df, x > 1)', { ...dplyr, transform: [{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'] }], write: [printed('2@filter', 'filter')] });
			testQuery('stats before dplyr is attached', 'filter(x, rep(1, 3))\nlibrary(dplyr)', { library: [{ nodeId: '2@library', functionName: 'library', value: 'dplyr' }], write: [printed('1@filter', 'filter')] });
			testDplyr('dplyr after library', 'library(dplyr)\nfilter(df, x > 1)', { ...dplyr, transform: [{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'] }], write: [printed(11, 'filter')] });
			testDplyr('dplyr when namespaced', 'dplyr::filter(df, x > 1)', { library: [{ nodeId: '1@filter', functionName: '::', value: 'dplyr' }], transform: [{ nodeId: '1@dplyr::filter', functionName: Identifier.make('filter', 'dplyr'), inputVariables: ['df'] }], write: [printed(7, Identifier.make('filter', 'dplyr'))] });
			testQuery('the time-series filter of stats is none', 'stats::filter(x, rep(1, 3))', { library: [{ nodeId: '1@filter', functionName: '::', value: 'stats' }], write: [printed(10, Identifier.make('filter', 'stats'))] });
			testQuery('a bare filter is the one of stats', 'filter(x, rep(1, 3))', { write: [printed(10, 'filter')] });
			testQuery('a user-defined filter is none', 'filter <- function(x) x\ny <- filter(df)', {});
			testQuery('base functions', 'm <- merge(a, b)\ns <- subset(a, x > 1)', { transform: [
				{ nodeId: '1@merge', functionName: 'merge', inputVariables: ['a', 'b'], assignedTo: 'm' },
				{ nodeId: '2@subset', functionName: 'subset', inputVariables: ['a'], assignedTo: 's' }
			] });
			testQuery('stats functions', 'a <- aggregate(x ~ g, data = d, FUN = sum)', { transform: [{ nodeId: '1@aggregate', functionName: 'aggregate', inputVariables: ['d'], assignedTo: 'a' }] });
			testQuery('tidyr', 'library(tidyr)\nw <- pivot_wider(long, names_from = k)', { library: [{ nodeId: '1@library', functionName: 'library', value: 'tidyr' }], transform: [{ nodeId: '2@pivot_wider', functionName: 'pivot_wider', inputVariables: ['long'], assignedTo: 'w' }] }, {}, [], ['tidyr']);
			testQuery('data.table', 'library(data.table)\nsetDT(dt)', { library: [{ nodeId: '1@library', functionName: 'library', value: 'data.table' }], transform: [{ nodeId: '2@setDT', functionName: 'setDT', inputVariables: ['dt'] }], write: [printed(7, 'setDT')] }, {}, [], ['data.table']);
			testDplyr('disabled', 'library(dplyr)\nfilter(df, x)', dplyr, { enabledCategories: ['library'] });
			testDplyr('ignoring the defaults', 'dplyr::mutate(df, x)', {}, { ignoreDefaultFunctions: true, enabledCategories: ['transform'] });
			testQuery('custom function', 'my_verb(df)', { transform: [{ nodeId: '1@my_verb', functionName: 'my_verb', inputVariables: ['df'] }], write: [printed(3, 'my_verb')] }, { transformFunctions: [{ name: 'my_verb' }] });
			test('every entry names its package', () => {
				const functions = defaultDependencyCategories(defaultCtx).transform.functions;
				assert.isNotEmpty(functions);
				for(const f of functions) {
					assert.isDefined(f.package, `${f.name} has no package`);
				}
			});
		});
		describe('Input variables', () => {
			testDplyr('native pipe', 'library(dplyr)\nsmall <- df |> filter(x > 1) |> select(a)', { ...dplyr, transform: [
				{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'] },
				{ nodeId: '2@select', functionName: 'select', inputVariables: ['df'], assignedTo: 'small' }
			] });
			testDplyr('magrittr pipe', 'library(dplyr)\nsmall <- df %>% filter(x > 1) %>% select(a)', { ...dplyr, transform: [
				{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'] },
				{ nodeId: '2@select', functionName: 'select', inputVariables: ['df'], assignedTo: 'small' }
			] });
			testDplyr('nested call', 'library(dplyr)\nsmall <- select(filter(df, x > 1), a)', { ...dplyr, transform: [
				{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'] },
				{ nodeId: '2@select', functionName: 'select', inputVariables: ['df'], assignedTo: 'small' }
			] });
			testDplyr('data argument', 'library(dplyr)\nmutate(z = 1, .data = df)', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'] }], write: [printed('2@mutate', 'mutate')] });
			testDplyr('access', 'library(dplyr)\nmutate(df$sub, z = 1)', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'] }], write: [printed('2@mutate', 'mutate')] });
			testDplyr('parentheses', 'library(dplyr)\nmutate((df), z = 1)', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'] }], write: [printed(13, 'mutate')] });
			testDplyr('constants are no variables', 'library(dplyr)\nmutate(mtcars[1:3, ], z = 1)', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['mtcars'] }], write: [printed(15, 'mutate')] });
			testDplyr('joins take both sides', 'library(dplyr)\nj <- a |> left_join(b, by = "k")', { ...dplyr, transform: [{ nodeId: '2@left_join', functionName: 'left_join', inputVariables: ['a', 'b'], assignedTo: 'j' }] });
			testDplyr('binds take all', 'library(dplyr)\nbind_rows(a, b, d)', { ...dplyr, transform: [{ nodeId: '2@bind_rows', functionName: 'bind_rows', inputVariables: ['a', 'b', 'd'] }], write: [printed('2@bind_rows', 'bind_rows')] });
			testDplyr('a by variable is an input too', 'library(dplyr)\ninner_join(a, b, by = key)', { ...dplyr, transform: [{ nodeId: '2@inner_join', functionName: 'inner_join', inputVariables: ['a', 'b', 'key'] }], write: [printed('2@inner_join', 'inner_join')] });
			testQuery('a read has no input', 'raw <- read.csv("data.csv")', { read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'data.csv', assignedTo: 'raw' }] });
			testQuery('a write takes its data', 'write.csv(small, "out.csv")', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'out.csv', inputVariables: ['small'] }] });
		});
		describe('Assigned to', () => {
			testDplyr('arrow', 'library(dplyr)\nmutate(df, z = 1) -> out', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'], assignedTo: 'out' }] });
			testDplyr('magrittr pipe into an arrow', 'library(dplyr)\ndf %>% filter(x) -> out', { ...dplyr, transform: [{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'], assignedTo: 'out' }] });
			testDplyr('equals', 'library(dplyr)\nout = df |> filter(x)', { ...dplyr, transform: [{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'], assignedTo: 'out' }] });
			testDplyr('super assignment', 'library(dplyr)\nout <<- df |> filter(x)', { ...dplyr, transform: [{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'], assignedTo: 'out' }] });
			testDplyr('chained assignment', 'library(dplyr)\na <- b <- filter(df, x)', { ...dplyr, transform: [{ nodeId: '2@filter', functionName: 'filter', inputVariables: ['df'], assignedTo: 'b' }] });
			testDplyr('reassignment', 'library(dplyr)\ndf <- df |> mutate(z = 1)', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'], assignedTo: 'df' }] });
			testDplyr('no assignment', 'library(dplyr)\nmutate(df, z = 1)', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'] }], write: [printed(10, 'mutate')] });
			testDplyr('the argument of another call is assigned to nothing', 'library(dplyr)\nr <- nrow(mutate(df, z = 1))', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'] }] });
			testDplyr('only the chain ends in the assignment', 'library(dplyr)\nr <- length(df |> mutate(z = 1))', { ...dplyr, transform: [{ nodeId: '2@mutate', functionName: 'mutate', inputVariables: ['df'] }] });
		});
	});

	describe('Plot descriptions', () => {
		const gg = { library: [{ nodeId: '1@library', functionName: 'library', value: 'ggplot2' }] };
		describe('Data flow', () => {
			testQuery('a plot chain', 'library(ggplot2)\np <- ggplot(df, aes(x)) + geom_point()', { ...gg, visualize: [
				{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', parts: ['2@geom_point'] },
				{ nodeId: '2@geom_point', functionName: 'geom_point', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
			] });
			testQuery('an addon names its own data', 'library(ggplot2)\np <- ggplot(df) + geom_point(data = other)', { ...gg, visualize: [
				{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', parts: ['2@geom_point'] },
				{ nodeId: '2@geom_point', functionName: 'geom_point', inputVariables: ['other'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
			] });
			testQuery('a piped plot', 'library(ggplot2)\np <- df |> ggplot(aes(x))', { ...gg, visualize: [{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p' }] });
		});
		describe('Title', () => {
			testQuery('ggtitle', 'library(ggplot2)\np <- ggplot(df) + ggtitle("Hist")', { ...gg, visualize: [
				{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', title: 'Hist', parts: ['2@ggtitle'] },
				{ nodeId: '2@ggtitle', functionName: 'ggtitle', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
			] });
			testQuery('labs', 'library(ggplot2)\np <- ggplot(df) + labs(title = "T", x = "X")', { ...gg, visualize: [
				{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', title: 'T', parts: ['2@labs'] },
				{ nodeId: '2@labs', functionName: 'labs', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
			] });
			testQuery('labs without a title', 'library(ggplot2)\np <- ggplot(df) + labs(x = "X")', { ...gg, visualize: [
				{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', parts: ['2@labs'] },
				{ nodeId: '2@labs', functionName: 'labs', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
			] });
			testQuery('main', 'plot(x, main = "Scatter")', { visualize: [{ nodeId: '1@plot', functionName: 'plot', inputVariables: ['x'], title: 'Scatter' }] });
			testQuery('the last title wins', 'library(ggplot2)\np <- ggplot(df) + ggtitle("A") + labs(title = "B")', { ...gg, visualize: [
				{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', title: 'B', parts: ['2@ggtitle', '2@labs'] },
				{ nodeId: '2@ggtitle', functionName: 'ggtitle', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] },
				{ nodeId: '2@labs', functionName: 'labs', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
			] });
		});
		describe('Saved to', () => {
			testQuery('ggsave of a plot variable', 'library(ggplot2)\np <- ggplot(df)\nq <- ggplot(other)\nggsave("p.png", plot = p)', { ...gg,
				write:     [{ nodeId: '4@ggsave', functionName: 'ggsave', value: 'p.png', inputVariables: ['p'], linkedIds: ['3@ggplot'] }],
				visualize: [
					{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', savedTo: 'p.png' },
					{ nodeId: '3@ggplot', functionName: 'ggplot', inputVariables: ['other'], assignedTo: 'q' }
				] });
			testQuery('ggsave of a positional plot', 'library(ggplot2)\np <- ggplot(df)\nq <- ggplot(other)\nggsave("q.png", q)', { ...gg,
				write:     [{ nodeId: '4@ggsave', functionName: 'ggsave', value: 'q.png', inputVariables: ['q'], linkedIds: ['3@ggplot'] }],
				visualize: [
					{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p' },
					{ nodeId: '3@ggplot', functionName: 'ggplot', inputVariables: ['other'], assignedTo: 'q', savedTo: 'q.png' }
				] });
			testQuery('ggsave of the last plot', 'library(ggplot2)\np <- ggplot(a)\nq <- ggplot(b)\nggsave("last.png")\nr <- ggplot(d)', { ...gg,
				write:     [{ nodeId: '4@ggsave', functionName: 'ggsave', value: 'last.png', linkedIds: ['3@ggplot'] }],
				visualize: [
					{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['a'], assignedTo: 'p' },
					{ nodeId: '3@ggplot', functionName: 'ggplot', inputVariables: ['b'], assignedTo: 'q', savedTo: 'last.png' },
					{ nodeId: '5@ggplot', functionName: 'ggplot', inputVariables: ['d'], assignedTo: 'r' }
				] });
			testQuery('ggsave follows a reassignment', 'library(ggplot2)\np <- ggplot(df)\np <- p + theme_bw()\nggsave("p.png", p)', { ...gg,
				write:     [{ nodeId: '4@ggsave', functionName: 'ggsave', value: 'p.png', inputVariables: ['p'], linkedIds: ['3@theme_bw'] }],
				visualize: [
					{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', savedTo: 'p.png', parts: ['3@theme_bw'] },
					/* an addon draws the data of the plot it builds */
					{ nodeId: '3@theme_bw', functionName: 'theme_bw', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['2@ggplot'] }
				] });
			testQuery('ggsave of a plot that is not a known one saves none', 'library(ggplot2)\np <- ggplot(df)\nggsave("x.png", plot = make_plot())', { ...gg,
				write:     [{ nodeId: '3@ggsave', functionName: 'ggsave', value: 'x.png', linkedIds: ['2@ggplot'] }],
				visualize: [{ nodeId: '2@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p' }] });
			testQuery('a device', 'png("a.png")\nplot(x)\ndev.off()', {
				write:     [{ nodeId: '1@png', functionName: 'png', value: 'a.png' }, printed('3@dev.off', 'dev.off')],
				visualize: [{ nodeId: '2@plot', functionName: 'plot', inputVariables: ['x'], value: 'a.png', savedTo: 'a.png', parts: ['1@png', '3@dev.off'] }]
			});
		});
	});

	describe('With file connections', () => {
		for(const ro of ['r', 'rb', 'rt'] as const) {
			testQuery('read only file connection', `file("test.txt", "${ro}")`, { read: [{ nodeId: '1@file', functionName: 'file', value: 'test.txt' }] });
		}
		for(const wo of ['w', 'wb', 'wt', 'a', 'ab', 'at'] as const) {
			testQuery('write only file connection', `file("test.txt", "${wo}")`, { write: [{ nodeId: '1@file', functionName: 'file', value: 'test.txt' }] });
		}
	});

	describe('Overwritten Function', () => {
		testQuery('read.csv (overwritten by user)', "read.csv <- function(a) print(a); read.csv('test.csv')", {
			read:  [],
			write: [
				{ value: 'stdout', functionName: 'print', nodeId: '1@print', inputVariables: ['a'] }
			]
		});
	});

	describe('Shared function names', () => {
		/* regression: a name several packages export used to keep only the entry declared last, so a call to any
		   other package's function of that name went unreported, or was read with the wrong argument */
		testQuery('a readr write is a write', 'readr::write_csv(d, "o.csv")', { library: [{ nodeId: '1@write_csv', functionName: '::', value: 'readr' }], write: [{ nodeId: '1@readr::write_csv', functionName: Identifier.make('write_csv', 'readr'), value: 'o.csv', inputVariables: ['d'] }] });
		testQuery('a readr read is a read', 'readr::read_lines("a.txt")', { library: [{ nodeId: '1@read_lines', functionName: '::', value: 'readr' }], read: [{ nodeId: '1@readr::read_lines', functionName: Identifier.make('read_lines', 'readr'), value: 'a.txt' }], write: [printed('1@readr::read_lines', Identifier.make('read_lines', 'readr'))] });
		/* arrow takes the sink as its second argument, the other package declaring the name takes a file as its first */
		testQuery('the sink of an arrow write is its own argument', 'arrow::write_parquet(d, "o.pq")', { library: [{ nodeId: '1@write_parquet', functionName: '::', value: 'arrow' }], write: [{ nodeId: '1@arrow::write_parquet', functionName: Identifier.make('write_parquet', 'arrow'), value: 'o.pq', inputVariables: ['d'] }] });
		testQuery('a testthat test is a test dependency', 'testthat::test_package("p")', { library: [{ nodeId: '1@test_package', functionName: '::', value: 'testthat' }], test: [{ nodeId: '1@testthat::test_package', functionName: Identifier.make('test_package', 'testthat') }] });
		/* nothing pins the call down, so the first entry able to apply answers (and reads the file it declares) */
		testQuery('an unqualified call still reports', 'write_csv(d, "o.csv")', { write: [{ nodeId: '1@write_csv', functionName: 'write_csv', value: 'o.csv', inputVariables: ['d'] }] });
		/* a call qualified to a package that declares none of the entries is none of them */
		testQuery('a write_csv of another package is no write', 'mypkg::write_csv(d, "o.csv")', { library: [{ nodeId: '1@write_csv', functionName: '::', value: 'mypkg' }] });
	});

	describe('Where a call resolves', () => {
		/* a library call that cannot have run attaches nothing, so no dependency on it is reported */
		testQuery('a library call that never runs is no library dependency', 'if (FALSE) library(readr)\nread_csv("a.csv")', { read: [{ nodeId: '2@read_csv', functionName: 'read_csv', value: 'a.csv' }], write: [printed('2@read_csv', 'read_csv')] });
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
							if(RFunctionCall.is(n) && n.lexeme === 'cat' && n.arguments.length > 0) {
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
			],
			write: [printed('1@read.csv', 'read.csv'), printed('2@my_read', 'my_read')]
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
		testQuery('read.csv text parameter', 'a <- read.csv(text="hello, world")', { read: [], write: [] });
		testQuery('read.csv file (positional) arg has priority', 'a <- read.csv("test.csv", text="hello, world")', { read: [{ functionName: 'read.csv', nodeId: 7, value: 'test.csv', assignedTo: 'a' }], write: [] });
		testQuery('read.csv file arg (named) has priority', 'a <- read.csv(file="test.csv", text="hello, world")', { read: [{ functionName: 'read.csv', nodeId: 8, value: 'test.csv', assignedTo: 'a' }], write: [] });
	});

	describe('Statistical Tests', () => {
		/* what a test is asked for is the statistic it prints, so a top-level one is an output as well */
		testQuery('t.test', 'x <- 1\nt.test(x)', { statistics: [{ nodeId: '2@t.test', functionName: 't.test' }], write: [{ nodeId: '2@t.test', functionName: 't.test', value: 'stdout', implicit: true }] });
		testQuery('anova', 'anova(m)', { statistics: [{ nodeId: '1@anova', functionName: 'anova' }], write: [{ nodeId: '1@anova', functionName: 'anova', value: 'stdout', implicit: true }] });
		testQuery('a namespaced test keeps its package', 'stats::wilcox.test(x, y)', { library: [{ nodeId: '1@wilcox.test', functionName: '::', value: 'stats' }], statistics: [{ nodeId: '1@stats::wilcox.test', functionName: Identifier.make('wilcox.test', 'stats') }], write: [{ nodeId: '1@stats::wilcox.test', functionName: Identifier.make('wilcox.test', 'stats'), value: 'stdout', implicit: true }] });
		testQuery('a test of another package is not attributed to stats', 'car::leveneTest(y ~ g)', { library: [{ nodeId: '1@leveneTest', functionName: '::', value: 'car' }], statistics: [{ nodeId: '1@car::leveneTest', functionName: Identifier.make('leveneTest', 'car') }], write: [{ nodeId: '1@car::leveneTest', functionName: Identifier.make('leveneTest', 'car'), value: 'stdout', implicit: true }] });
		/* the call is not the test it looks like, but it still prints what it returns */
		testQuery('a wrong namespace drops the call', 'utils::t.test(x)', { library: [{ nodeId: '1@t.test', functionName: '::', value: 'utils' }], write: [{ nodeId: '1@utils::t.test', functionName: Identifier.make('t.test', 'utils'), value: 'stdout', implicit: true }] });
		testQuery('a nested test is still a test', 'f <- function() t.test(x)', { statistics: [{ nodeId: '1@t.test', functionName: 't.test' }] });
		test('the category is what the built-ins state, with a package for every entry', () => {
			const stated = BuiltInIndex.default().with(SemanticCallTag.Statistics);
			assert.isNotEmpty(stated);
			assert.deepStrictEqual(
				defaultDependencyCategories(defaultCtx).statistics.functions.map(f => `${f.package as string}::${f.name}`).sort(),
				stated.map(Identifier.toString).sort()
			);
			for(const f of defaultDependencyCategories(defaultCtx).statistics.functions) {
				assert.isDefined(f.package, `${f.name} has no package`);
			}
		});
	});

	describe('Implicit echo', () => {
		describe('Visible results are auto-printed', () => {
			testQuery('a plain call', 'summary(x)', { write: [{ nodeId: '1@summary', functionName: 'summary', value: 'stdout', implicit: true }] });
			testQuery('every top-level call', 'summary(x)\nmean(x)', {
				write: [
					{ nodeId: '1@summary', functionName: 'summary', value: 'stdout', implicit: true },
					{ nodeId: '2@mean', functionName: 'mean', value: 'stdout', implicit: true }
				]
			});
		});
		describe('Invisible results are not', () => {
			for(const code of ['invisible(x)', 'assign("x", 1)', 'rm(x)', 'library(a)', 'stopifnot(x)', 'set.seed(42)']) {
				testQuery(code, code, code.startsWith('library') ? { library: [{ nodeId: '1@library', functionName: 'library', value: 'a' }] } : {});
			}
			testQuery('an assignment', 'x <- summary(y)', {});
			testQuery('a call below the top level', 'f <- function() summary(x)', {});
			testQuery('a call as an argument', 'print(summary(x))', { write: [{ nodeId: '1@print', functionName: 'print', value: 'stdout', inputVariables: ['x'] }] });
		});
		describe('A graphics call prints what it returns visibly', () => {
			/* closing or switching a device hands back the device now active, `split.screen` the screens it made */
			for(const f of ['dev.off', 'dev.set', 'split.screen']) {
				testQuery(f, `${f}()`, { write: [{ nodeId: `1@${f}`, functionName: f, value: 'stdout', implicit: true }] });
			}
			/* devices, addons, and parameter setters return invisibly */
			for(const f of ['dev.new', 'graphics.off', 'layout', 'par']) {
				testQuery(f, `${f}(x)`, {});
			}
			testQuery('an addon', 'plot(x)\nlines(y)', { visualize: [
				{ nodeId: '1@plot', functionName: 'plot', inputVariables: ['x'], parts: ['2@lines'] },
				{ nodeId: '2@lines', functionName: 'lines', inputVariables: ['y'], linkedIds: ['1@plot'] }
			] });
		});
		describe('A setter prints nothing, a query the state it reads', () => {
			for(const code of ['options()', 'options("digits")', 'par()', 'par("mar")', 'palette()']) {
				const fn = code.slice(0, code.indexOf('('));
				testQuery(code, code, { write: [printed(`1@${fn}`, fn)] });
			}
			for(const code of ['options(digits = 3)', 'options(op)', 'par(mar = c(1, 1, 1, 1))', 'palette("R3")']) {
				testQuery(code, code, {});
			}
		});
		describe('A dependency stated to return invisibly prints nothing, loaded or not', () => {
			testQuery('pacman', 'p_load(a)', { library: [{ nodeId: '1@p_load', functionName: 'p_load', value: 'a' }] });
			testQuery('devtools', 'source_url("a")', { source: [{ nodeId: '1@source_url', functionName: 'source_url', value: 'a' }] });
			testQuery('a visible read prints its data', 'read.csv("a.csv")', { read: [{ nodeId: '1@read.csv', functionName: 'read.csv', value: 'a.csv' }], write: [printed('1@read.csv', 'read.csv')] });
		});
		describe('Calls another category already accounts for are not repeated', () => {
			testQuery('a plot', 'plot(x)', { visualize: [{ nodeId: '1@plot', functionName: 'plot', inputVariables: ['x'] }] });
			testQuery('a printed ggplot chain', 'ggplot(df) + geom_point() + lims(x = c(0, 1))', { visualize: [
				{ nodeId: '1@ggplot', functionName: 'ggplot', inputVariables: ['df'], parts: ['1@geom_point', '1@lims'] },
				{ nodeId: '1@geom_point', functionName: 'geom_point', inputVariables: ['df'], linkedIds: ['1@ggplot'] },
				{ nodeId: '1@lims', functionName: 'lims', inputVariables: ['df'], linkedIds: ['1@ggplot'] }
			] });
			testQuery('a ggplot chain on a stored plot', 'p + geom_point()', { visualize: [{ nodeId: '1@geom_point', functionName: 'geom_point' }] });
			testQuery('a grouped ggplot chain', '(ggplot(df) + geom_point())', { visualize: [
				{ nodeId: '1@ggplot', functionName: 'ggplot', inputVariables: ['df'], parts: ['1@geom_point'] },
				{ nodeId: '1@geom_point', functionName: 'geom_point', inputVariables: ['df'], linkedIds: ['1@ggplot'] }
			] });
			testQuery('a stored plot', 'p <- ggplot(df) + geom_point()\np', { visualize: [
				{ nodeId: '1@ggplot', functionName: 'ggplot', inputVariables: ['df'], assignedTo: 'p', parts: ['1@geom_point'] },
				{ nodeId: '1@geom_point', functionName: 'geom_point', inputVariables: ['df'], assignedTo: 'p', linkedIds: ['1@ggplot'] }
			] });
			testQuery('a stored value that is no plot', 'p <- summary(x)\np', { write: [{ nodeId: '2@p', functionName: 'p', value: 'stdout', implicit: true }] });
			testQuery('a stored lattice plot', 'library(lattice)\np <- xyplot(y ~ x)\np', {
				library:   [{ nodeId: '1@library', functionName: 'library', value: 'lattice' }],
				/* the formula is quoted, its variables are looked up when the plot is drawn */
				visualize: [{ nodeId: '2@xyplot', functionName: 'xyplot', assignedTo: 'p' }]
			});
			/* base graphics draw at once and hand back data, which printing writes */
			testQuery('a stored base plot', 'h <- hist(x)\nh', { visualize: [{ nodeId: '1@hist', functionName: 'hist', inputVariables: ['x'], assignedTo: 'h' }], write: [{ nodeId: '2@h', functionName: 'h', value: 'stdout', implicit: true }] });
			testQuery('a stored ggplot component', 'l <- geom_point()\nl', { visualize: [{ nodeId: '1@geom_point', functionName: 'geom_point', assignedTo: 'l' }], write: [{ nodeId: '2@l', functionName: 'l', value: 'stdout', implicit: true }] });
			testQuery('a lone ggplot component', 'geom_point()', { visualize: [{ nodeId: '1@geom_point', functionName: 'geom_point' }], write: [{ nodeId: '1@geom_point', functionName: 'geom_point', value: 'stdout', implicit: true }] });
			testQuery('a stem-and-leaf display is text', 'stem(x)', { write: [{ nodeId: '1@stem', functionName: 'stem', value: 'stdout', inputVariables: ['x'] }] });
			testQuery('a density estimate draws nothing', 'density(x)', { write: [{ nodeId: '1@density', functionName: 'density', value: 'stdout', implicit: true }] });
			testQuery('a write', 'write.csv(x, "out.csv")', { write: [{ nodeId: '1@write.csv', functionName: 'write.csv', value: 'out.csv', inputVariables: ['x'] }] });
			testQuery('an assertion', 'expect_equal(1 + 1, 2)', {});
		});
		describe('A statement that is not a call', () => {
			testQuery('a symbol', 'x', { write: [{ nodeId: '1@x', functionName: 'x', value: 'stdout', implicit: true }] });
			testQuery('a constant', '42', { write: [{ nodeId: 0, functionName: '42', value: 'stdout', implicit: true }] });
			testQuery('an operator', 'x + 1', { write: [{ nodeId: 2, functionName: '+', value: 'stdout', implicit: true }] });
			testQuery('an access', 'df$col', { write: [{ nodeId: 3, functionName: '$', value: 'stdout', implicit: true }] });
			testQuery('a function definition', 'function(x) x', { write: [{ nodeId: 4, functionName: 'function', value: 'stdout', implicit: true }] });
			testQuery('a pipe reports the call it feeds', 'x |> summary()', { write: [{ nodeId: '1@summary', functionName: 'summary', value: 'stdout', implicit: true }] });
			testQuery('a pipe into an invisible call prints nothing', 'x |> invisible()', {});
			/* magrittr's pipe is a call of its own, and what it prints is what the call it feeds does */
			testQuery('a magrittr pipe reports the call it feeds', 'x %>% summary()', { write: [{ nodeId: '1@summary', functionName: 'summary', value: 'stdout', implicit: true }] });
			testQuery('a magrittr pipe into an invisible call prints nothing', 'x %>% invisible()', {});
			testQuery('a magrittr assignment pipe prints nothing', 'x %<>% summary()', {});
		});
		describe('A group is visible, whatever it holds', () => {
			/* `(` hands its argument back visibly, which is the idiom for assigning and seeing the value */
			testQuery('a parenthesized assignment', '(x <- 1)', { write: [{ nodeId: 4, functionName: '<-', value: 'stdout', implicit: true }] });
			testQuery('a parenthesized invisible call', '(invisible(1))', { write: [{ nodeId: '1@invisible', functionName: 'invisible', value: 'stdout', implicit: true }] });
		});
		describe('A statement returning invisibly', () => {
			/* every loop hands back an invisible NULL, however often its body runs */
			testQuery('a for loop', 'for(i in 1:10) i', {});
			testQuery('a while loop', 'while(x) y', {});
			testQuery('a repeat loop', 'repeat break', {});
			testQuery('an assignment', 'x <- 1', {});
			testQuery('an equals assignment', 'x = 1', {});
			testQuery('a right assignment', '1 -> x', {});
			testQuery('a super assignment', 'x <<- 1', {});
			testQuery('a replacement', 'names(x) <- "a"', {});
			/* the body still runs, so what it prints on its own is still an output */
			testQuery('a loop printing in its body', 'for(i in 1:10) print(i)', { write: [{ nodeId: '1@print', functionName: 'print', value: 'stdout', inputVariables: ['i'] }] });
		});
		describe('A block hands on the value of its last statement', () => {
			testQuery('a visible last statement', '{ invisible(1); 2 }', { write: [{ nodeId: 6, functionName: '2', value: 'stdout', implicit: true }] });
			testQuery('an invisible last statement', '{ 1; invisible(2) }', {});
			testQuery('an empty block', '{}', { write: [{ nodeId: 2, functionName: '{', value: 'stdout', implicit: true }] });
		});
		describe('An if hands on the value of the branch that runs', () => {
			testQuery('a visible branch', 'if(c) 42', { write: [{ nodeId: 1, functionName: '42', value: 'stdout', implicit: true }] });
			testQuery('an invisible branch', 'if(c) invisible(1)', {});
			testQuery('only the else branch is visible', 'if(c) invisible(1) else 42', { write: [{ nodeId: 6, functionName: '42', value: 'stdout', implicit: true }] });
			testQuery('both branches are invisible', 'if(c) invisible(1) else invisible(2)', {});
		});
		/**
		 * R itself settles what the top level echoes, so every rule above is checked against what `Rscript`
		 * actually writes to stdout for the same code.
		 */
		describe.skipIf(skipTestBecauseConfigNotMet({ minRVersion: '4.0.0' }))('What R prints', () => {
			/**
			 * whether R writes anything to stdout when running `code` at the top level;
			 * the code goes through a file because a newline within a `-e` argument does not survive
			 * the command line on Windows
			 */
			function rPrints(code: string): boolean {
				const dir = mkdtempSync(join(tmpdir(), 'flowr-echo-'));
				const file = join(dir, 'code.R');
				try {
					writeFileSync(file, code, { encoding: 'utf8' });
					return execFileSync('Rscript', ['--vanilla', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().length > 0;
				} finally {
					rmSync(dir, { recursive: true, force: true });
				}
			}
			async function flowrPrints(code: string): Promise<boolean> {
				const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
				analyzer.addRequest(code);
				const results = await analyzer.query([{ type: 'dependencies' }]);
				return (results.dependencies.write ?? []).some(d => d.implicit === true);
			}
			test.each([
				/* echoed */
				'x <- 1\nx',
				'x <- 1\nx + 1',
				'df <- data.frame(col = 1)\ndf$col',
				'function(x) x',
				'{ invisible(1); 2 }',
				'{}',
				'(x <- 1)',
				'(invisible(1))',
				'if(TRUE) 42',
				'summary(1:10)',
				'suppressWarnings(1)',
				/* not echoed */
				'invisible(1)',
				'for(i in 1:3) i',
				'while(FALSE) 1',
				'repeat break',
				'x <- 1',
				'x = 1',
				'1 -> x',
				'x <<- 1',
				'x <- 1\nnames(x) <- "a"',
				'{ 1; invisible(2) }',
				'if(TRUE) invisible(1)',
				'library(stats)'
			])('%s', async(code) => {
				assert.strictEqual(await flowrPrints(code), rPrints(code), `flowR and R disagree about ${JSON.stringify(code)}`);
			});
			test('a branch that is not taken is over-approximated', async() => {
				/* the condition is generally unknown statically, so flowR reports what the branch would print */
				assert.isFalse(rPrints('if(FALSE) 42'));
				assert.isTrue(await flowrPrints('if(FALSE) 42'));
			});
		});

		test('nothing is auto-printed without implicit echo', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser)
				.amendConfig(c => {
					c.project.assumeImplicitEcho = false;
				})
				.build();
			analyzer.addRequest('summary(x)');
			const results = await analyzer.query([{ type: 'dependencies' }]);
			assert.deepStrictEqual(results.dependencies.write.filter(d => d.implicit), []);
		});
	});

	describe('The categories agree with the built-in configuration', () => {
		const resources = new Map<string, { idx: number, name: string }[]>();
		for(const d of DefaultBuiltinConfig) {
			const info = d.type !== 'constant' ? (d as { config?: BuiltInFnInfo }).config : undefined;
			const declared = (info?.sig ?? []).flatMap(([name, p], idx) => (p & ArgProp.Resource) !== 0 ? [{ idx, name }] : []);
			if(declared.length > 0) {
				for(const n of builtInNames(d)) {
					/* keyed by the package that declares it: `readr::read_lines` and `sourcetools::read_lines` are two entries */
					resources.set(Identifier.toString(n), declared);
				}
			}
		}
		test.each([['read', readFunctions(defaultCtx)], ['write', writeFunctions(defaultCtx)], ['other paths', OtherPathFunctions]] as const)(
			'%s', (_name, list) => {
				for(const f of list) {
					const declared = resources.get(f.package === undefined ? f.name : Identifier.toString(Identifier.make(f.name, f.package)));
					if(declared === undefined) {
						continue;
					}
					if(f.argIdx !== undefined && f.argIdx !== 'unnamed') {
						assert.include(declared.map(r => r.idx), f.argIdx, `${f.package}::${f.name} takes its resource from another position than the built-in states`);
					}
					if(f.argName !== undefined) {
						assert.include(declared.map(r => r.name), f.argName, `${f.package}::${f.name} names its resource differently than the built-in states`);
					}
				}
			});
	});
	describe('Assumed base packages', () => {
		testQuery('off by default', 'x <- median(1:10)', {});

		testQuery('reports an assumed base package used without library()', 'x <- median(1:10)', {
			library: [
				{ nodeId: undefined, functionName: Attached, value: 'base', implicit: true, alwaysAttached: true, linkedIds: [4, 7] },
				{ nodeId: undefined, functionName: Attached, value: 'stats', implicit: true, linkedIds: ['1@median'] }
			]
		}, { assumedPackages: true });

		testQuery('does not duplicate an explicitly loaded package', 'library(stats)\nx <- median(1:10)', {
			library: [
				{ nodeId: '1@library', functionName: 'library', value: 'stats' },
				{ nodeId: undefined, functionName: Attached, value: 'base', implicit: true, alwaysAttached: true, linkedIds: [3, 8, 11] }
			]
		}, { assumedPackages: true });

		testQuery('several assumed packages come back in search-path order', 'x <- sd(1:10)\ny <- head(1:10)', {
			library: [
				{ nodeId: undefined, functionName: Attached, value: 'base', implicit: true, alwaysAttached: true, linkedIds: [4, 7, 12, 15] },
				{ nodeId: undefined, functionName: Attached, value: 'stats', implicit: true, linkedIds: ['1@sd'] },
				{ nodeId: undefined, functionName: Attached, value: 'utils', implicit: true, linkedIds: ['2@head'] }
			]
		}, { assumedPackages: true });

		testQuery('does nothing when the library category is disabled', 'x <- median(1:10)', {}, { assumedPackages: true, enabledCategories: ['read'] });
	});

	describe('Package attribution', () => {
		/* the database records these as an S4 generic or an S3 method, so their name is not in the export list */
		const recordedElsewhere = new Set(['rast', 'vect', 'writeRaster', 'writeVector', 'writeCDF', 'readMat', 'writeMat', 'open.nc', 'create.nc']);

		test('every entry names a package that exports it', async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest('1');
			const sources = analyzer.inspectContext().deps.signatureSources();
			const exportsOf = (pkg: string): string[] => sources.filter(s => s.packageNames().includes(pkg))
				.flatMap(s => [...s.lookup(pkg)?.exported ?? [], ...(s.functions(pkg) ?? []).map(f => f.name)]);
			for(const [category, { functions }] of Object.entries(defaultDependencyCategories(defaultCtx))) {
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
