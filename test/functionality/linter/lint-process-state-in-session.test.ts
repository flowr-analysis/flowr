import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinterLines } from '../_helper/linter';
import { ProcessStateChange } from '../../../src/linter/rules/process-state-in-session';

const server = (body: string, prelude = '') => `${prelude}server <- function(input, output, session) {\n${body}\n}`;

describe('flowR linter', withTreeSitter(parser => {
	describe('process state in session', () => {
		const lint = (name: string, code: string, expected: Record<string, unknown>[], config?: object) =>
			assertLinterLines(name, parser, code, 'process-state-in-session', expected, config);

		describe('global variables', () => {
			lint('a superassignment to a global', server('user <<- input$name'), [{ line: 2, change: ProcessStateChange.GlobalSuperAssignment, name: 'user' }]);
			lint('a right superassignment to a global', server('input$name ->> user'), [{ line: 2, change: ProcessStateChange.GlobalSuperAssignment, name: 'user' }]);
			lint('a superassignment to a variable of the server', server('n <- 0\nf <- function() n <<- n + 1'), []);
			lint('a superassignment within an observer', server('observeEvent(input$go, {\n  last <<- input$go\n})'), [{ line: 3, change: ProcessStateChange.GlobalSuperAssignment }]);
			lint('assign into the global environment', server('assign("shared", 1, envir = globalenv())'), [{ line: 2, change: ProcessStateChange.GlobalAssign, name: 'shared' }]);
			lint('assign into the server', server('assign("mine", 1)'), []);
			lint('a patched namespace', server('assignInNamespace("f", identity, "pkg")'), [{ line: 2, change: ProcessStateChange.NamespacePatch }]);
		});

		describe('process settings', () => {
			lint('options', server('options(digits = input$digits)'), [{ line: 2, change: ProcessStateChange.ProcessSetting, name: 'options' }]);
			lint('reading options', server('o <- options()'), []);
			lint('options restored on exit', server('op <- options(scipen = 100)\non.exit(options(op))'), []);
			lint('options restored in another function', server('op <- options(scipen = 100)\nf <- function() on.exit(options(op))'), [{ line: 2, name: 'options' }]);
			lint('environment variables, working directory, locale, seed', server('Sys.setenv(TZ = input$tz)\nsetwd(tempdir())\nSys.setlocale("LC_ALL", "C")\nset.seed(1)'),
				[{ line: 2, name: 'Sys.setenv' }, { line: 3, name: 'setwd' }, { line: 4, name: 'Sys.setlocale' }, { line: 5, name: 'set.seed' }]);
			lint('settings at the top level run once', 'options(digits = 3)\nSys.setenv(TZ = "UTC")', []);
			lint('settings in a function that is no server', 'f <- function(x) options(digits = x)', []);
			lint('a configured session signature', 'mod <- function(id, data) options(digits = 2)', [{ line: 1, name: 'options' }], { sessionSignatures: [['id', 'data']] });
			lint('a module server', 'mod <- function(id) moduleServer(id, function(input, output, session) setwd("/tmp"))', [{ line: 1, name: 'setwd' }]);
		});

		describe('shared state', () => {
			lint('a top-level reactive value written per session', server('counter(counter() + 1)', 'counter <- reactiveVal(0)\n'), [{ line: 3, change: ProcessStateChange.SharedState, name: 'counter' }]);
			lint('a top-level reactive value only read', server('output$n <- renderText(counter())', 'counter <- reactiveVal(0)\n'), []);
			lint('top-level reactive values written per session', server('rv$n <- input$n', 'rv <- reactiveValues(n = 0)\n'), [{ line: 3, name: 'rv' }]);
			lint('reactive values of the session', server('rv <- reactiveValues(n = 0)\nrv$n <- input$n'), []);
		});

		describe('caches all sessions share', () => {
			const CacheKey = ProcessStateChange.CacheKey;
			const cache = 'cache <- cachem::cache_mem()\n';
			lint('a value of the session cached by a constant key', server('cache$set("k", input$x)', cache), [{ line: 3, change: CacheKey, name: 'cache' }]);
			lint('a value of the session cached by itself', server('cache$set(input$x, toupper(input$x))', cache), []);
			lint('a value cached by part of what it depends on', server('cache$set(input$x, paste(input$x, input$y))', cache), [{ line: 3, suggestion: 'a key that includes input$y, or a cache per session' }]);
			lint('a value that does not depend on the session', server('cache$set("iris", summary(iris))', cache), []);
			lint('a cache of the session', server('cache <- cachem::cache_mem()\ncache$set("k", input$x)'), []);
			lint('the user followed through local variables', server('u <- session$user\nd <- query(u)\ncache$set("data", d)', cache), [{ line: 5, suggestion: 'a key that includes session$user, or a cache per session' }]);
			lint('the user in the key', server('u <- session$user\ncache$set(u, query(session$user))', cache), []);

			lint('bindCache without the user', server('output$p <- renderPlot(plot(db(session$user, input$n))) |> bindCache(input$n)'), [{ line: 2, change: CacheKey, name: 'bindCache' }]);
			lint('bindCache with the user', server('output$p <- renderPlot(plot(db(session$user, input$n))) |> bindCache(input$n, session$user)'), []);
			lint('bindCache keyed by what the expression reads', server('d <- reactive(read(input$file))\noutput$t <- renderTable(head(d())) |> bindCache(d())'), []);
			lint('bindCache keyed by the input a reactive reads', server('d <- reactive(read(input$file))\noutput$t <- renderTable(head(d())) |> bindCache(input$file)'), []);
			lint('bindCache missing an input', server('r <- reactive(input$a + input$b) |> bindCache(input$a)'), [{ line: 2, suggestion: 'bindCache keys that include input$b, or cache = "session"' }]);
			lint('bindCache without a pipe', server('r <- bindCache(reactive(input$a), "all")'), [{ line: 2 }]);
			lint('bindCache with magrittr', server('r <- reactive(input$a) %>% bindCache("all")'), [{ line: 2 }]);
			lint('bindCache per session', server('r <- reactive(input$a) |> bindCache("all", cache = "session")'), []);
			lint('bindCache over reactives depending on each other', server('a <- reactive(b())\nb <- reactive(a() + input$x)\nr <- reactive(a()) |> bindCache(1)'), [{ line: 4, suggestion: 'bindCache keys that include input$x, or cache = "session"' }]);
			lint('bindCache on reactive values of the session', server('rv <- reactiveValues(n = 0)\nr <- reactive(rv$n * 2) |> bindCache(1)'), [{ line: 3, suggestion: 'bindCache keys that include rv$n, or cache = "session"' }]);

			lint('a memoized function reading a global the session writes', server('current <<- session$user\nx <- get_data(input$id)', 'get_data <- memoise::memoise(function(id) fetch(id, current))\n'),
				[{ line: 3, change: ProcessStateChange.GlobalSuperAssignment, name: 'current' }, { line: 4, change: CacheKey, name: 'get_data' }]);
			lint('a memoized function depending only on its arguments', server('x <- get_data(input$id)', 'get_data <- memoise::memoise(function(id) fetch(id))\n'), []);
			lint('a function memoized under its own name', server('x <- f(input$id)', 'f <- function(id) fetch(id)\nf <- memoise(f)\n'), []);
			lint('a memoized closure over the session with a shared cache', server('f <- memoise::memoise(function(id) fetch(id, session$user), cache = cache)\nx <- f(input$id)', cache),
				[{ line: 4, name: 'f', suggestion: 'arguments to f that include session$user, or a cache per session' }]);
			lint('a memoized closure over the session with its own cache', server('f <- memoise::memoise(function(id) fetch(id, session$user))\nx <- f(input$id)'), []);
			lint('the user passed to a memoized closure', server('f <- memoise::memoise(function(id, u) fetch(id, session$user), cache = cache)\nx <- f(input$id, session$user)', cache), []);
			lint('a helper reading a global the session writes', server('current <<- session$user\nr <- reactive(load()) |> bindCache(1)', 'load <- function() fetch(current)\n'),
				[{ line: 3, name: 'current' }, { line: 4, name: 'bindCache' }]);
			lint('nested helpers', server('current <<- session$user\nr <- reactive(outer()) |> bindCache(1)', 'inner <- function() fetch(current)\nouter <- function() inner()\n'),
				[{ line: 4, name: 'current' }, { line: 5, name: 'bindCache' }]);
			lint('a helper given the session', server('r <- reactive(user_of(session)) |> bindCache(session$user)', 'user_of <- function(s) s$user\n'), []);
			lint('a helper closing over the session', server('who <- function() session$user$name\nr <- reactive(fetch(who())) |> bindCache(1)'), [{ line: 3, suggestion: 'bindCache keys that include session$user$name, or cache = "session"' }]);
			lint('an option the session sets', server('options(lang = input$lang)\nr <- reactive(label(getOption("lang"))) |> bindCache(1)'),
				[{ line: 2, name: 'options' }, { line: 3, name: 'bindCache' }]);
			lint('an environment variable the session sets, read by a memoized function', server('Sys.setenv(TENANT = input$t)\nx <- f(1)', 'f <- memoise::memoise(function(i) fetch(i, Sys.getenv("TENANT")))\n'),
				[{ line: 3, name: 'Sys.setenv' }, { line: 4, name: 'f' }]);
			lint('an option the session does not set', server('r <- reactive(label(getOption("lang"))) |> bindCache(1)'), []);
			lint('a cache made by a helper per session', server('r <- reactive(input$a) |> bindCache(1, cache = make_cache())', 'make_cache <- function() cachem::cache_mem()\n'), []);
			lint('a shared cache returned by a helper', server('r <- reactive(input$a) |> bindCache(1, cache = get_cache())', 'shared <- cachem::cache_mem()\nget_cache <- function() shared\n'), [{ line: 4 }]);
			lint('the cache of the session', server('r <- reactive(input$a) |> bindCache(1, cache = session$cache)'), []);
			lint('an argument left out of the key', server('x <- f(input$id, session$user)', 'f <- memoise::memoise(function(id, u) fetch(id, u), omit_args = "u")\n'),
				[{ line: 3, suggestion: 'arguments to f that include session$user, or a cache per session' }]);
			lint('memoizedCall', server('current <<- input$who\nx <- R.cache::memoizedCall(function(id) fetch(id, current), input$id)'), [{ line: 2, name: 'current' }, { line: 3, name: 'memoizedCall' }]);
			lint('a configured memoiser', server('x <- f(input$id)\ncurrent <<- input$who', 'f <- my_memo(function(id) fetch(id, current))\n'), [{ line: 3, name: 'f' }, { line: 4, name: 'current' }], { memoisers: ['my_memo'] });
		});

		describe('resource paths', () => {
			lint('anywhere', 'addResourcePath("data", "/srv/data")', [{ line: 1, change: ProcessStateChange.ResourcePath }]);
			lint('within a session', server('shiny::addResourcePath("d", tempdir())'), [{ line: 2, change: ProcessStateChange.ResourcePath }]);
		});
	});
}));
