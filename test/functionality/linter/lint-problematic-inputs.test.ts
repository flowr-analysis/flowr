import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { SourceRange } from '../../../src/util/range';
import { InputTraceType, InputType } from '../../../src/queries/catalog/input-sources-query/simple-input-classifier';

describe('flowR linter', withTreeSitter(parser => {
	describe('Problematic Eval', () => {
		assertLinter('const-eval', parser, 'eval(parse(text="x"))', 'problematic-inputs', []);
		assertLinter('network eval', parser, 'x <- read.csv("https://example.com/data.csv"); eval(parse(text=x))', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'eval',
			loc:       SourceRange.from(1, 48, 1, 66),
			sources:   [{ id: 11, trace: InputTraceType.Known, types: [InputType.File, InputType.Network, InputType.DerivedConstant] }]
		}]);
		assertLinter('read eval', parser, 'x <- read.csv("data.csv"); eval(parse(text=x))', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'eval',
			loc:       SourceRange.from(1, 28, 1, 46),
			sources:   [{ id: 11, trace: InputTraceType.Known, types: [InputType.File, InputType.DerivedConstant] }]
		}]);
		assertLinter('unseeded randomness eval', parser, 'eval(parse(text=runif(1)))', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'eval',
			loc:       SourceRange.from(1, 1, 1, 26),
			sources:   [{ id: 8, trace: InputTraceType.Known, types: [InputType.Random, InputType.DerivedConstant] }]
		}]);
		assertLinter('unknown eval', parser, 'eval(parse(text=x))', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'eval',
			loc:       SourceRange.from(1, 1, 1, 19),
			sources:   [{ id: 5, trace: InputTraceType.Known, types: [InputType.Unknown, InputType.DerivedConstant] }]
		}]);
		assertLinter('unknown system', parser, 'system(x)', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'system',
			loc:       SourceRange.from(1, 1, 1, 9),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }]
		}]);
	});
}));
