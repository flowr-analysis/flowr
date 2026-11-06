import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../_helper/shell';
import { label } from '../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../../src/r-bridge/retriever';
import { Dataflow } from '../../../../src/dataflow/graph/df-helper';
import { AmbientStateName, KeyedState } from '../../../../src/dataflow/environments/ambient-state-name';
import { RBinaryOp } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-binary-op';
import { RNode } from '../../../../src/r-bridge/lang-4.x/ast/model/model';
import type { RNodeWithParent } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { Identifier } from '../../../../src/dataflow/environments/identifier';
import { Resolve } from '../../../../src/dataflow/environments/resolve-helper';
import type { FunctionAmbientWrites } from '../../../../src/dataflow/internal/process/functions/call/built-in/transitive-side-effects';

describe('Ambient state summaries', withTreeSitter(ts => {
	type Kind = keyof FunctionAmbientWrites;

	/** what each function, named by what it is assigned to, may leave changed (sorted) */
	async function summaries(code: string, kind: Kind): Promise<Record<string, string[]>> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(code));
		const dfi = await analyzer.dataflow();
		const idMap = (await analyzer.normalize()).idMap;
		const result: Record<string, string[]> = {};
		for(const [id, writes] of Dataflow.sideEffects.ambientWrites(dfi)) {
			const parent = RNode.directParent(idMap.get(id) as RNodeWithParent, idMap);
			if(RBinaryOp.is(parent)) {
				result[Identifier.getName((parent.lhs as { content: Identifier }).content)] = [...writes[kind]].sort();
			}
		}
		return result;
	}

	function check(name: string, code: string, expected: Record<string, string[]>, kind: Kind = 'state'): void {
		test(label(name, [], ['dataflow']), async() => {
			assert.deepStrictEqual(await summaries(code, kind), Object.fromEntries(Object.entries(expected).map(([fn, w]) => [fn, [...w].sort()])));
		});
	}

	describe('options', () => {
		check('a function that sets an option', 'a01 <- function() options(digits = 3)', { a01: ['#option:digits', '#options'] });
		check('writes pass up through calls', 'a01 <- function() options(digits = 3)\na22 <- function() a01()\na33 <- function() 1', {
			a01: ['#option:digits', '#options'], a22: ['#option:digits', '#options'], a33: []
		});
		check('queries are no writes', 'a01 <- function() options("digits")', { a01: [] });
		check('options restored from a variable', 'a01 <- function(op) options(op)', { a01: ['#option:*', '#options'] });
		check('passed up through a chain', 'a <- function() options(width = 20)\nb <- function() a()\nc <- function() b()', {
			a: ['#option:width', '#options'], b: ['#option:width', '#options'], c: ['#option:width', '#options']
		});
		check('recursion terminates', 'a <- function(n) { options(digits = n); if(n > 0) a(n - 1) }', { a: ['#option:digits', '#options'] });
		check('frame-local writes are left out', 'a01 <- function() { withr::local_options(digits = 3); 1 }', { a01: [] });
	});

	describe('environment variables', () => {
		check('Sys.setenv names the variables', 'a01 <- function() Sys.setenv(LANG = "C", R_LIBS = "x")', { a01: ['#env', '#env:LANG', '#env:R_LIBS'] });
		check('Sys.unsetenv names the variables by value', 'a01 <- function() Sys.unsetenv("TZ")', { a01: ['#env', '#env:TZ'] });
		check('Sys.unsetenv with an unknown name', 'a01 <- function(v) Sys.unsetenv(v)', { a01: ['#env', '#env:*'] });
		check('resolved variable', 'a01 <- function() { v <- "HOME"; Sys.unsetenv(v) }', { a01: ['#env', '#env:HOME'] });
	});

	describe('locale and language', () => {
		check('Sys.setlocale with a category', 'a01 <- function() Sys.setlocale("LC_COLLATE", "C")', { a01: ['#locale', '#locale:LC_COLLATE'] });
		check('Sys.setlocale by name', 'a01 <- function() Sys.setlocale(locale = "C", category = "LC_TIME")', { a01: ['#locale', '#locale:LC_TIME'] });
		check('Sys.setlocale defaults to LC_ALL', 'a01 <- function() Sys.setlocale(locale = "C")', { a01: ['#locale', '#locale:LC_ALL'] });
		check('Sys.setLanguage', 'a01 <- function() Sys.setLanguage("de")', { a01: ['#env', '#env:LANGUAGE', '#locale', '#locale:LANGUAGE'] });
	});

	describe('graphics parameters', () => {
		check('par names its parameters', 'a01 <- function() par(mfrow = c(1, 2), mar = c(1, 1, 1, 1))', { a01: ['#graphics', '#par:mar', '#par:mfrow'] });
		check('par restoring a saved list', 'a01 <- function(op) par(op)', { a01: ['#graphics', '#par:*'] });
		check('par queries are no writes', 'a01 <- function() par("mar")', { a01: [] });
		check('no.readonly is a query', 'a01 <- function() par(no.readonly = TRUE)', { a01: [] });
	});

	describe('output, files, and devices', () => {
		check('sink diverts the output', 'a01 <- function() sink("out.txt")', { a01: ['#sink', '#file:out', '#files'] });
		check('sink() ends the diversion, writing no file', 'a01 <- function() sink()', { a01: ['#sink'] });
		check('Sys.umask sets the mask', 'a01 <- function() Sys.umask("022")', { a01: ['#umask'] });
		check('Sys.umask() only queries', 'a01 <- function() Sys.umask()', { a01: [] });
		check('a device is opened', 'a01 <- function() pdf("a.pdf")', { a01: ['#device', '#file:a', '#files', '#graphics'] });
		check('a device is closed', 'a01 <- function() dev.off()', { a01: ['#device', '#file:*', '#files', '#graphics'] });
	});

	describe('the search path', () => {
		check('library with a symbol and a string', 'a01 <- function() library(dplyr)\na22 <- function() library("ggplot2")', {
			a01: ['#search-path', '#search-path:dplyr'], a22: ['#search-path', '#search-path:ggplot2']
		});
		check('require', 'a01 <- function() require(dplyr)', { a01: ['#search-path', '#search-path:dplyr'] });
		check('import::from attaches the imports', 'a01 <- function() import::from(dplyr, select)\na22 <- function() import::from(dplyr, select, .into = "tools")\na03 <- function() import::from(dplyr, select, .into = "")', {
			a01: ['#search-path', '#search-path:imports'], a22: ['#search-path', '#search-path:tools'], a03: []
		});
		check('library with character.only', 'a01 <- function() { p <- "dplyr"; library(p, character.only = TRUE) }', { a01: ['#search-path', '#search-path:dplyr'] });
		check('attach is named like its argument', 'df <- data.frame(x = 1)\na01 <- function() attach(df)\na22 <- function() attach(df, name = "data")', {
			a01: ['#search-path', '#search-path:df'], a22: ['#search-path', '#search-path:data']
		});
		check('detach', 'a01 <- function() detach(package:dplyr)\na22 <- function() detach("package:ggplot2", character.only = TRUE)', {
			a01: ['#search-path', '#search-path:dplyr'], a22: ['#search-path', '#search-path:ggplot2']
		});
	});

	describe('writes only assumed of a body we cannot see', () => {
		const code = 'hof <- function(f) f()\nhof2 <- function(x, FUN) vapply(x, FUN, 1)\nseeded <- function() set.seed(1)\nboth <- function(f) { set.seed(1); f() }\nup <- function() hof(function() 1)';
		check('a hidden body is no real write', code, { hof: [], hof2: [], seeded: ['#rng'], both: ['#rng'], up: [] });
		check('but an assumed one', code, { hof: ['#rng'], hof2: ['#rng'], seeded: [], both: [], up: ['#rng'] }, 'assumed');
	});

	describe('printing to the console writes no file', () => {
		check('cat and writeLines without a target', 'a01 <- function() cat("x")\na22 <- function() writeLines("x")\na03 <- function() dput(1)\na04 <- function() write.csv(1)\na05 <- function() capture.output(print(1))', {
			a01: [], a22: [], a03: [], a04: [], a05: []
		});
		check('the console named as the target', 'a01 <- function() cat("x", file = stderr())\na22 <- function() cat("x", file = "")\na03 <- function() writeLines("x", con = stdout())\na04 <- function() capture.output(print(1), file = NULL)', {
			a01: [], a22: [], a03: [], a04: []
		});
		check('a named file is still written', 'a01 <- function() cat("x", file = "out.txt")\na22 <- function() capture.output(print(1), file = "c.txt")\na03 <- function(p) writeLines("x", p)', {
			a01: ['#file:out', '#files'], a22: ['#file:c', '#files'], a03: ['#file:*', '#files']
		});
		check('write defaults to the file data', 'a01 <- function() write("x")', { a01: ['#file:*', '#files'] });
		check('package functions printing by default', 'a01 <- function(d) data.table::fwrite(d)\na22 <- function(t) ape::write.tree(t)\na03 <- function(m) texreg::texreg(m)', {
			a01: [], a22: [], a03: []
		});
		check('reading the console reads no file', 'a01 <- function() readLines()\na22 <- function() scan(file = "")', { a01: [], a22: [] });
	});

	describe('aliases', () => {
		check('an alias keeps the names of its arguments', 'a01 <- function() { set <- Sys.setenv; set(TZ = "UTC") }\na22 <- function() { o <- options; o(digits = 4) }\na03 <- function() { o <- options; o("digits") }', {
			a01: ['#env', '#env:TZ'], a22: ['#option:digits', '#options'], a03: []
		});
		check('a parameter bound to a built-in names nothing', 'g <- function(f, ...) f(...)\na01 <- function() g(options, digits = 3)', {
			g: ['#option:*', '#options', '#warn-error'], a01: ['#option:*', '#options', '#warn-error']
		});
	});

	describe('global variables', () => {
		check('assign into the global environment and <<-', 'a01 <- function() assign("x", 1, envir = .GlobalEnv)\na22 <- function() y <<- 3\na03 <- function() a22()', {
			a01: ['x'], a22: ['y'], a03: ['y']
		}, 'variables');
		check('a closure keeps its own variable', 'a01 <- local({ n <- 0; inc <- function() n <<- 1; inc })\na22 <- function() { k <- 0; h <- function() k <<- 1; h() }\na03 <- function() { z <- 1; z }', {
			inc: [], h: [], a22: [], a03: []
		}, 'variables');
	});

	describe('names', () => {
		test(label('entries of a pseudo variable', [], ['dataflow']), () => {
			assert.deepStrictEqual(AmbientStateName.entryOf('#env:PATH'), { state: KeyedState.Env, key: 'PATH' });
			assert.deepStrictEqual(AmbientStateName.entryOf('#search-path:dplyr'), { state: KeyedState.SearchPath, key: 'dplyr' });
			assert.isUndefined(AmbientStateName.entryOf('#sink'));
			assert.strictEqual(AmbientStateName.keyed(KeyedState.SearchPath, 'package:dplyr'), '#search-path:dplyr');
		});
	});
}));

describe('Ambient state stays small', withTreeSitter(ts => {
	/* closing a device we cannot name merges the state of the active device with the others; each call may add its own definition, but no copies */
	test(label('closing unnamed devices again and again', ['name-normal', 'call-normal'], ['dataflow']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(Array.from({ length: 40 }, () => 'dev.off(dev.list()["RStudioGD"])').join('\n')));
		const { environment } = await analyzer.dataflow();
		assert.isAtMost(Resolve.byName(AmbientStateName.graphics, environment)?.length ?? 0, 41);
	});
}));
