import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { SourceRange } from '../../../src/util/range';
import { InputTraceType, InputType } from '../../../src/queries/catalog/input-sources-query/simple-input-classifier';
import { UnescapedArgumentCategory } from '../../../src/linter/rules/unescaped-arguments';

/** A shiny server function template with `input` from the user */
function shinyServer(body: string): string {
	return `library(shiny)\nserver <- function(input, output) {\n\t${body}\n}`;
}

describe('flowR linter', withTreeSitter(parser => {
	describe('System Calls', () => {
		assertLinter('constant command', parser, 'system("ls")', 'unescaped-arguments', []);
		assertLinter('escaped command', parser, 'system(shQuote(x))', 'unescaped-arguments', []);
		assertLinter('unknown command', parser, 'system(x)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(1, 8, 1, 8),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 8, 1, 8),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(x)'
			}]
		}]);
		assertLinter('pasted parameter', parser, 'f <- function(dir) system(paste0("ls ", dir))', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(1, 27, 1, 44),
			sources:   [{ id: 7, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 41, 1, 43),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(dir)'
			}]
		}]);
		assertLinter('pasted escaped parameter', parser, 'f <- function(dir) system(paste0("ls ", shQuote(dir)))', 'unescaped-arguments', []);
		assertLinter('partly escaped command', parser, 'f <- function(a, b) system(paste0("cp ", shQuote(a), " ", b))', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(1, 28, 1, 60),
			sources:   [{ id: 16, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 59, 1, 59),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(b)'
			}]
		}]);
		assertLinter('user input as command', parser, shinyServer('system(input$cmd)'), 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Certain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(3, 9, 3, 17),
			sources:   [{ id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'cmd' }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(3, 9, 3, 17),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(input$cmd)'
			}]
		}]);
		assertLinter('unknown arguments', parser, 'system2("ls", args = x)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system2',
			loc:       SourceRange.from(1, 22, 1, 22),
			sources:   [{ id: 4, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'args' }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 22, 1, 22),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(x)'
			}]
		}]);
		assertLinter('redefined function', parser, 'system <- function(command) invisible(command)\nsystem(x)', 'unescaped-arguments', []);
	});

	describe('Evaluation', () => {
		assertLinter('constant evaluation', parser, 'eval(parse(text = "1+1"))', 'unescaped-arguments', []);
		assertLinter('bounded evaluation', parser, 'eval(parse(text = match.arg(x, c("a", "b"))))', 'unescaped-arguments', []);
		assertLinter('unknown evaluation', parser, 'eval(parse(text = x))', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.Eval,
			function:  'eval',
			loc:       SourceRange.from(1, 6, 1, 20),
			sources:   [{ id: 3, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'text' }]
		}]);
	});

	describe('Database Queries', () => {
		assertLinter('constant statement', parser, 'dbGetQuery(con, "SELECT * FROM t")', 'unescaped-arguments', []);
		assertLinter('interpolated statement', parser,
			shinyServer('dbGetQuery(con, sqlInterpolate(con, "SELECT * FROM t WHERE x = ?x", x = input$x))'), 'unescaped-arguments', []);
		assertLinter('pasted user input', parser,
			shinyServer('dbGetQuery(con, paste0("SELECT * FROM t WHERE x = \'", input$x, "\'"))'), 'unescaped-arguments', [{
				certainty: LintingResultCertainty.Certain,
				category:  UnescapedArgumentCategory.Database,
				function:  'dbGetQuery',
				loc:       SourceRange.from(3, 18, 3, 68),
				sources:   [{ id: 20, trace: InputTraceType.Unknown, types: [InputType.User], name: 'x' }],
				quickFix:  [{
					type:        'replace',
					loc:         SourceRange.from(3, 56, 3, 62),
					description: 'Escape the value with `DBI::dbQuoteLiteral`',
					replacement: 'DBI::dbQuoteLiteral(con, input$x)'
				}]
			}]);
		assertLinter('statement built elsewhere', parser,
			'q <- paste0("SELECT * FROM t WHERE x = ", user)\ndbGetQuery(con, q)', 'unescaped-arguments', [{
				certainty: LintingResultCertainty.Uncertain,
				category:  UnescapedArgumentCategory.Database,
				function:  'dbGetQuery',
				loc:       SourceRange.from(2, 17, 2, 17),
				sources:   [{ id: 11, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Unknown, InputType.DerivedConstant] }]
			}]);
	});

	describe('HTML and JavaScript', () => {
		assertLinter('constant value', parser, shinyServer('HTML("<b>hi</b>")'), 'unescaped-arguments', []);
		assertLinter('escaped user input', parser, shinyServer('HTML(htmltools::htmlEscape(input$name))'), 'unescaped-arguments', []);
		assertLinter('pasted user input', parser, shinyServer('HTML(paste0("<b>", input$name, "</b>"))'), 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Certain,
			category:  UnescapedArgumentCategory.Html,
			function:  'HTML',
			loc:       SourceRange.from(3, 7, 3, 39),
			sources:   [{ id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name' }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(3, 21, 3, 30),
				description: 'Escape the value with `htmltools::htmlEscape`',
				replacement: 'htmltools::htmlEscape(input$name)'
			}]
		}]);
	});

	describe('Configuration', () => {
		assertLinter('disabled category', parser, 'system(x)', 'unescaped-arguments', [],
			undefined, { disabledCategories: [UnescapedArgumentCategory.System] });
		assertLinter('custom critical call', parser, 'my_exec(x)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'my_exec',
			loc:       SourceRange.from(1, 9, 1, 9),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 9, 1, 9),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(x)'
			}]
		}], undefined, { criticalCalls: { [UnescapedArgumentCategory.System]: [{ name: 'my_exec' }] } });
	});
}));
