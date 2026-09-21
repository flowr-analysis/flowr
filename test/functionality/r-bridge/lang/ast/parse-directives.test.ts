import { assertAst, withShell } from '../../../_helper/shell';
import { exprList } from '../../../_helper/ast-builder';
import { decorateLabelContext, label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { afterAll, assert, describe, test } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';
import { createNormalizePipeline } from '../../../../../src/core/steps/pipeline/default-pipelines';
import { contextFromInput } from '../../../../../src/project/context/flowr-analyzer-context';
import { TreeSitterExecutor } from '../../../../../src/r-bridge/lang-4.x/tree-sitter/tree-sitter-executor';

describe('Parse the line directive', { concurrent: false }, withShell(shell => {
	assertAst(label('Simple line', ['line-directive']),
		shell, '#line 42 "foo.R"',
		exprList({
			type:     RType.LineDirective,
			info:     {},
			lexeme:   '#line 42 "foo.R"',
			location: SourceRange.from(1, 1, 1, 16),
			line:     42,
			file:     'foo.R'
		}),
		{
			// https://github.com/r-lib/tree-sitter-r/issues/160
			skipTreeSitter: true
		}
	);
})
);

describe('Reserved words as assignment targets', { concurrent: false }, withShell(shell => {
	const ts = new TreeSitterExecutor();
	afterAll(() => ts.close());

	test(decorateLabelContext(label('r-shell rejects `if <- 5`, matching R', ['reserved-words']), ['parse']), async() => {
		let threw = false;
		try {
			await createNormalizePipeline(shell, { context: contextFromInput('if <- 5') }).allRemainingSteps();
		} catch(e) {
			threw = true;
			assert.match(String(e), /unable to parse/);
		}
		assert.isTrue(threw, 'the r-shell engine should reject `if <- 5` just like R does');
	});

	test(decorateLabelContext(label('tree-sitter silently drops `if <- 5`, unlike r-shell', ['reserved-words']), ['parse']), async() => {
		const result = await createNormalizePipeline(ts, { context: contextFromInput('if <- 5') }).allRemainingSteps();
		assert.deepStrictEqual(result.normalize.ast.files[0]?.root.children, [], 'tree-sitter should silently drop `if <- 5` rather than keep any node for it');
	});
}));
