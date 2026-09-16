import { assert, describe, test } from 'vitest';
import { FunctionSemantics } from '../../../../src/dataflow/fn/function-semantics';
import { withTreeSitter } from '../../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../../src/project/flowr-analyzer-builder';
import { RFunctionCall } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RProject } from '../../../../src/r-bridge/lang-4.x/ast/model/nodes/r-project';
import { Identifier, PkgName } from '../../../../src/dataflow/environments/identifier';
import type { ParentInformation } from '../../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';

describe('FunctionSemantics.call.match.toDefinition', withTreeSitter(parser => {
	/** the analyzer for `code`, plus the call to `name` in it */
	async function callTo(code: string, name: string) {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		const dfg = await analyzer.dataflow();
		const ast = await analyzer.normalize();
		let found: RFunctionCall<ParentInformation> | undefined;
		RProject.visitAst(ast.ast, node => {
			if(RFunctionCall.isNamed(node) && Identifier.getName(node.functionName.content) === name) {
				found ??= node;
			}
			return false;
		});
		assert.isDefined(found, `no call to ${name} in the code`);
		return { analyzer, dfg, call: found };
	}

	test('takes the formals from a definition written in the code', async() => {
		const { analyzer, dfg, call } = await callTo('f <- function(alpha, beta) alpha\nf(beta = 1, 2)', 'f');
		const bound = FunctionSemantics.call.match.toDefinition(call, dfg.graph, analyzer.inspectContext());
		assert.isDefined(bound, 'the definition is right there, so its formals have to be found');
		assert.strictEqual(bound?.get('beta')?.value?.lexeme, '1');
		assert.strictEqual(bound?.get('alpha')?.value?.lexeme, '2');
	});

	test('takes the formals from the signature database for a built-in', async() => {
		const { analyzer, dfg, call } = await callTo('load(envir = e, file = "x.rda")', 'load');
		const db = analyzer.inspectContext().deps.signatures();
		if(!db.available() || db.parametersOf(Identifier.make('load', PkgName.Base)) === undefined) {
			return; // no signature database on this machine, so there are no formals to find
		}
		const bound = FunctionSemantics.call.match.toDefinition(call, dfg.graph, analyzer.inspectContext());
		assert.isDefined(bound, 'base R is in the database, so `load` has formals');
		assert.strictEqual(bound?.get('file')?.value?.lexeme, '"x.rda"');
		assert.strictEqual(bound?.get('envir')?.value?.lexeme, 'e');
	});

	test('falls back to what flowR states about a call the database has no entry for', async() => {
		const { analyzer, dfg, call } = await callTo('shinyjs::runjs(code = "alert(1)")', 'runjs');
		const ctx = analyzer.inspectContext();
		const db = ctx.deps.signatures();
		if(db.available() && db.parametersOf(Identifier.make('runjs', PkgName.ShinyJs)) !== undefined) {
			return; // the database knows it after all, so there is nothing to fall back to
		}
		/* the configuration declares `runjs(code)`, which is where the formals come from with no entry to read */
		assert.deepStrictEqual(FunctionSemantics.call.match.formalsOf(call, dfg.graph, ctx), ['code']);
		const bound = FunctionSemantics.call.match.toDefinition(call, dfg.graph, ctx);
		assert.strictEqual(bound?.get('code')?.value?.lexeme, '"alert(1)"');
	});

	test('a pipe hands its left-hand side in as the first argument', async() => {
		for(const code of ['f <- function(a, b) a\n1 |> f(2)', 'f <- function(a, b) a\n1 |> f(b = 2)',
			'library(magrittr)\nf <- function(a, b) a\n1 %>% f(2)']) {
			const { analyzer, dfg, call } = await callTo(code, 'f');
			const bound = FunctionSemantics.call.match.toDefinition(call, dfg.graph, analyzer.inspectContext());
			assert.strictEqual(bound?.get('a')?.value?.lexeme, '1', code);
			assert.strictEqual(bound?.get('b')?.value?.lexeme, '2', code);
		}
	});

	test('a placeholder says where the piped value goes, so nothing is handed in front', async() => {
		const { analyzer, dfg, call } = await callTo('f <- function(a, b) a\n2 |> f(1, b = _)', 'f');
		const bound = FunctionSemantics.call.match.toDefinition(call, dfg.graph, analyzer.inspectContext());
		assert.strictEqual(bound?.get('a')?.value?.lexeme, '1', 'the 2 goes where the placeholder stands, not in front');
	});

	test('a package the code attaches masks the base package exporting the same name', async() => {
		const { analyzer, dfg, call } = await callTo('library(dplyr)\nfilter(df, x > 1)', 'filter');
		const ctx = analyzer.inspectContext();
		if(!ctx.deps.getDependencies().some(d => d.name === PkgName.Dplyr)) {
			return; // no signature database, so `library(dplyr)` pulls nothing in
		}
		/* `stats::filter(x, filter, ...)` is attached too, so binding `.data` is what says dplyr won */
		assert.strictEqual(FunctionSemantics.call.match.toDefinition(call, dfg.graph, ctx)?.get('.data')?.value?.lexeme, 'df');
	});

	test('gives up when nothing says what the call resolves to', async() => {
		const { analyzer, dfg, call } = await callTo('g(1)', 'g');
		assert.isUndefined(FunctionSemantics.call.match.toDefinition(call, dfg.graph, analyzer.inspectContext()));
	});
}));
