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

describe('Ambient state summaries', withTreeSitter(ts => {
	/** the state each function, named by what it is assigned to, may leave changed (sorted) */
	async function summaries(code: string): Promise<Record<string, string[]>> {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(ts).build();
		analyzer.addRequest(requestFromInput(code));
		const dfi = await analyzer.dataflow();
		const idMap = (await analyzer.normalize()).idMap;
		const result: Record<string, string[]> = {};
		for(const [id, writes] of Dataflow.sideEffects.ambientWrites(dfi)) {
			const parent = RNode.directParent(idMap.get(id) as RNodeWithParent, idMap);
			if(RBinaryOp.is(parent)) {
				result[Identifier.getName((parent.lhs as { content: Identifier }).content)] = [...writes].sort();
			}
		}
		return result;
	}

	function check(name: string, code: string, expected: Record<string, string[]>): void {
		test(label(name, [], ['dataflow']), async() => {
			assert.deepStrictEqual(await summaries(code), Object.fromEntries(Object.entries(expected).map(([fn, w]) => [fn, [...w].sort()])));
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
		check('sink() ends the diversion', 'a01 <- function() sink()', { a01: ['#sink', '#file:*', '#files'] });
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
		check('library with character.only', 'a01 <- function() { p <- "dplyr"; library(p, character.only = TRUE) }', { a01: ['#search-path', '#search-path:dplyr'] });
		check('attach is named like its argument', 'df <- data.frame(x = 1)\na01 <- function() attach(df)\na22 <- function() attach(df, name = "data")', {
			a01: ['#search-path', '#search-path:df'], a22: ['#search-path', '#search-path:data']
		});
		check('detach', 'a01 <- function() detach(package:dplyr)\na22 <- function() detach("package:ggplot2", character.only = TRUE)', {
			a01: ['#search-path', '#search-path:dplyr'], a22: ['#search-path', '#search-path:ggplot2']
		});
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
