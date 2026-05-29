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
	describe('Pipe Command Injection', () => {
		assertLinter('pdf safe path', parser, 'pdf("output.pdf")', 'problematic-inputs', []);
		assertLinter('pdf pipe constant', parser, 'pdf("|lp -o landscape")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'pdf',
			loc:         SourceRange.from(1, 1, 1, 23),
			pipeCommand: '|lp -o landscape',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape' }]
		}]);
		assertLinter('pdf pipe with named arg', parser, 'pdf("|lp -o landscape", paper = "a4r")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'pdf',
			loc:         SourceRange.from(1, 1, 1, 38),
			pipeCommand: '|lp -o landscape',
			sources:     [
				{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape' },
				{ id: 4, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'a4r' }
			]
		}]);
		assertLinter('pdf unknown input', parser, 'pdf(x)', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'pdf',
			loc:       SourceRange.from(1, 1, 1, 6),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }]
		}]);
		assertLinter('postscript pipe constant', parser, 'postscript("|lp")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'postscript',
			loc:         SourceRange.from(1, 1, 1, 17),
			pipeCommand: '|lp',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp' }]
		}]);
	});
}));
