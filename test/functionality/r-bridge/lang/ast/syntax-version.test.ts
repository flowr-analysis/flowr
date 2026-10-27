import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../../../_helper/shell';
import { label } from '../../../_helper/label';
import { FlowrAnalyzerBuilder } from '../../../../../src/project/flowr-analyzer-builder';
import { minRVersionOf } from '../../../../../src/r-bridge/lang-4.x/ast/model/syntax-version';

describe('the R version a program\'s syntax needs', withTreeSitter(parser => {
	const needs = (code: string, version: string | undefined) => test(label(`${JSON.stringify(code)} needs ${version ?? 'any R'}`, ['pipe-and-pipe-bind'], ['other']), async() => {
		const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
		analyzer.addRequest(code);
		assert.strictEqual(minRVersionOf((await analyzer.normalize()).ast.files.map(f => f.root))?.version, version);
	});
	needs('x <- function(y) y\nprint(x(1))', undefined);
	needs('x |> f()', '4.1.0');
	needs('f <- \\(x) x', '4.1.0');
	needs('r"(a\\b)"', '4.1.0');
	needs('x |> f(y = _)', '4.2.0');
	needs('x |> _$a', '4.3.0');
	needs('f <- \\(x) x\nx |> f(y = _)', '4.2.0');
	needs('`_` <- 1\nprint(`_`)', undefined);
}));
