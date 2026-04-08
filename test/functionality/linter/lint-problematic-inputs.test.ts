import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { SourceRange } from '../../../src/util/range';
import { InputTraceType, InputType } from '../../../src/queries/catalog/input-sources-query/simple-input-classifier';

describe('flowR linter', withTreeSitter(parser => {
	describe('Problematic Eval', () => {
		assertLinter('const-eval', parser, 'eval(parse(text="x"))', 'problematic-inputs', []);
		assertLinter('unknown eval', parser, 'eval(parse(text=x))', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'eval',
			loc:       SourceRange.from(1, 1, 1, 19),
			sources:   [{ id: 5, trace: InputTraceType.Known, types: [InputType.Unknown, InputType.DerivedConstant] }]
		}]);
	});
}));
