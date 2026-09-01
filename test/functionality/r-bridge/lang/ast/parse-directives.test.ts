import { assertAst, withShell } from '../../../_helper/shell';
import { exprList } from '../../../_helper/ast-builder';
import { label } from '../../../_helper/label';
import { RType } from '../../../../../src/r-bridge/lang-4.x/ast/model/type';
import { describe } from 'vitest';
import { SourceRange } from '../../../../../src/util/range';

describe('Parse the line directive', { concurrent: false }, withShell(shell => {
	assertAst(label('Simple line', ['comments']),
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
