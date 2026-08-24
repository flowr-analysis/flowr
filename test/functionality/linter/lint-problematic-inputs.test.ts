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
		assertLinter('const system', parser, 'system("rm -rf /")', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'system',
			loc:       SourceRange.from(1, 1, 1, 18),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /' }]
		}]);
		assertLinter('unknown system', parser, 'system(x)', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'system',
			loc:       SourceRange.from(1, 1, 1, 9),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }]
		}]);
		assertLinter('disallowedValues match', parser, 'custom("rm -rf /")', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'custom',
			loc:       SourceRange.from(1, 1, 1, 18),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /' }]
		}], undefined, {
			consider: [{ pattern: /^custom$/, allowedInputTypes: [], disallowedValues: /^rm -rf/ }]
		});
		assertLinter('disallowedValues no match', parser, 'custom("rm -rf /")', 'problematic-inputs', [], undefined, {
			consider: [{ pattern: /^custom$/, allowedInputTypes: [], disallowedValues: /^cat/ }]
		});
		assertLinter('allowedValues match', parser, 'custom("rm -rf /")', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'custom',
			loc:       SourceRange.from(1, 1, 1, 18),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /' }]
		}], undefined, {
			consider: [{ pattern: /^custom$/, allowedInputTypes: [], allowedValues: /^cat/ }]
		});
		assertLinter('allowedValues no match', parser, 'custom("rm -rf /")', 'problematic-inputs', [], undefined, {
			consider: [{ pattern: /^custom$/, allowedInputTypes: [], allowedValues: /^rm -rf/  }]
		});
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
		assertLinter('pipe disallowedValues match', parser, 'custom("|rm -rf /")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'custom',
			loc:         SourceRange.from(1, 1, 1, 19),
			pipeCommand: '|rm -rf /',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|rm -rf /' }]
		}], undefined, { pipeCommandFunctions: [{ pattern: /^custom$/, argIdx: 0, argName: 'file', disallowedValues: /^\|rm/ }] });
		assertLinter('pipe disallowedValues no match', parser, 'custom("|lp -o landscape")', 'problematic-inputs', [], undefined,
			{ pipeCommandFunctions: [{ pattern: /^custom$/, argIdx: 0, argName: 'file', disallowedValues: /^\|rm/ }] });
		assertLinter('pipe allowedValues match', parser, 'custom("|rm -rf /")', 'problematic-inputs', [], undefined,
			{ pipeCommandFunctions: [{ pattern: /^custom$/, argIdx: 0, argName: 'file', allowedValues: /^\|rm/ }] });
		assertLinter('pipe allowedValues no match', parser, 'custom("|lp -o landscape")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'custom',
			loc:         SourceRange.from(1, 1, 1, 26),
			pipeCommand: '|lp -o landscape',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape' }]
		}], undefined, { pipeCommandFunctions: [{ pattern: /^custom$/, argIdx: 0, argName: 'file', allowedValues: /^\|rm/ }] });
		assertLinter('pdf pipe with named arg', parser, 'pdf("|lp -o landscape", paper = "a4r")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'pdf',
			loc:         SourceRange.from(1, 1, 1, 38),
			pipeCommand: '|lp -o landscape',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape' }]
		}]);
		assertLinter('pdf non-file arg pipe not flagged', parser, 'pdf(file = "out.pdf", title = "|untrusted")', 'problematic-inputs', []);
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
