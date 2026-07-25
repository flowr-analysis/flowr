import { assertQuery } from '../../_helper/query';
import { label } from '../../_helper/label';
import { withTreeSitter } from '../../_helper/shell';
import { describe } from 'vitest';
import type {
	InputSourcesQuery,
	InputSourcesQueryResult
} from '../../../../src/queries/catalog/input-sources-query/input-sources-query-format';
import { InputTraceType, InputType } from '../../../../src/queries/catalog/input-sources-query/simple-input-classifier';
import { SlicingCriterion } from '../../../../src/slicing/criterion/parse';

describe.sequential('Input Source Test', withTreeSitter(parser => {
	function testQuery(name: string, code: string, query: readonly InputSourcesQuery[], expectedOutput: InputSourcesQueryResult['results']) {
		assertQuery(label(name), parser, code, query, d => {
			const nast = d.normalize.idMap;
			for(const [key, value] of Object.entries(expectedOutput)) {
				expectedOutput[key] = value.map(v => ({
					...v,
					id: SlicingCriterion.tryParse(v.id, nast) ?? v.id,
					...(v.declaredAt ? { declaredAt: v.declaredAt.map(d => SlicingCriterion.tryParse(d as SlicingCriterion, nast) ?? d) } : {})
				}));
			}
			return {
				'input-sources': { results: expectedOutput }
			};
		});
	}

	describe('Trivial eval+parse combinations', () => {
		testQuery('Eval-parse simple', "eval(parse(text='x'))", [{ type: 'input-sources', criterion: '1@eval' }], {
			'1@eval': [{
				id:    '1@parse',
				types: [InputType.DerivedConstant], trace: InputTraceType.Pure
			}]
		});
		testQuery('Eval-parse simple with indirect', "x <- 'x'\neval(parse(text=x))", [{ type: 'input-sources', criterion: '2@eval' }], {
			'2@eval': [{
				id:    '2@parse',
				types: [InputType.DerivedConstant], trace: InputTraceType.Pure
			}]
		});
		testQuery('Eval-parse double indirect', "x <- z <-'x'\ny <- x\neval(parse(text=y))", [{ type: 'input-sources', criterion: '3@eval' }], {
			'3@eval': [{
				id:    '3@parse',
				types: [InputType.DerivedConstant], trace: InputTraceType.Pure
			}]
		});
		testQuery('Eval-parse simple but with variable', 'eval(parse(text=x))', [{ type: 'input-sources', criterion: '1@eval' }], {
			'1@eval': [{
				id:    '1@parse',
				types: [InputType.Unknown, InputType.DerivedConstant], trace: InputTraceType.Known
			}]
		});
		testQuery('Eval-parse to param', 'function(x) eval(parse(text=x))', [{ type: 'input-sources', criterion: '1@eval' }], {
			'1@eval': [{
				id:    '1@parse',
				types: [InputType.Parameter, InputType.DerivedConstant], trace: InputTraceType.Known
			}]
		});
		testQuery('Eval-parse to param with indirect', 'function(x) { y <- x\neval(parse(text=y))}', [{ type: 'input-sources', criterion: '2@eval' }], {
			'2@eval': [{
				id:    '2@parse',
				types: [InputType.Parameter, InputType.DerivedConstant], trace: InputTraceType.Known
			}]
		});
	});

	describe('Network access', () => {
		testQuery('curl', 'x <- curl("https://example.com/data.csv")\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Network], trace: InputTraceType.Alias }]
		});
	});

	describe('Reading files', () => {
		testQuery('Read a file', 'x <- read.csv("foo.bar")\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{
				id:    '2@x',
				types: [InputType.File], trace: InputTraceType.Alias
			}]
		});

		testQuery('Read a file from network', 'x <- read.csv("https://example.com/data.csv")\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File, InputType.Network], trace: InputTraceType.Alias }]
		});

		// read with filename from variable (unknown/known)
		testQuery('Read a file with filename constant variable', "fname <- 'foo.bar'\nx <- read.csv(fname)\nfoo(x)", [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@x', types: [InputType.File], trace: InputTraceType.Alias }]
		});

		testQuery('Read a file with unknown filename variable', 'x <- read.csv(y)\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File], trace: InputTraceType.Alias }]
		});
	});

	describe('Randomness', () => {
		testQuery('Randomness source', 'x <- runif(1)\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Random], trace: InputTraceType.Alias }]
		});
	});
	describe('Combined Options', () => {
		testQuery('Read and Random', 'x <- read.csv(y)\ny <- runif(1)\nfoo(x, y)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [
				{ id: '3@x', types: [InputType.File], trace: InputTraceType.Alias },
				{ id: '3@y', types: [InputType.Random], trace: InputTraceType.Alias }
			]
		});
	});
	describe('Control Dependencies', () => {
		testQuery('Control dependency: file vs constant', 'if(runif(1) > 0.5) { x <- read.csv("a") } else { x <- 2 }\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File, InputType.Constant], trace: InputTraceType.Alias, cds: [InputType.Random, InputType.Constant, InputType.DerivedConstant] }]
		});
	});
	describe('Loops and Recursion', () => {
		testQuery('Loop: file read inside for', 'for(i in 1:2) { x <- read.csv("a") }\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File], trace: InputTraceType.Alias, cds: [InputType.DerivedConstant] }]
		});

		testQuery('Loop with conditional overwrite (random control dep)', 'x <- 2\nfor(i in 1:2) { if(runif(1) > 0.5) x <- read.csv("a") }\nfoo(x)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@x', types: [InputType.Constant, InputType.File], trace: InputTraceType.Alias, cds: [InputType.Random, InputType.Constant, InputType.DerivedConstant] }]
		});

		testQuery('Recursive function that may read file', 'f <- function(n) { if(n==0) read.csv("a") else f(n-1) }\ny <- f(1)\nfoo(y)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@y', types: [InputType.Unknown], trace: InputTraceType.Alias }]
		});
	});

	describe('More combinations', () => {
		testQuery('Nested pure constants -> derived constant', 'a <- 1\nb <- 2\nc <- a + b\nfoo(c)', [{ type: 'input-sources', criterion: '4@foo' }], {
			'4@foo': [{ id: '4@c', types: [InputType.DerivedConstant], trace: InputTraceType.Pure }]
		});
		testQuery('Read and Random', 'if(u) x <- read.csv("a") else x <- runif(1)\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File, InputType.Random], trace: InputTraceType.Alias, cds: [InputType.Unknown] }]
		});
	});

	describe('Other categories', () => {
		testQuery('System call source', 'x <- system("echo hi")\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.System], trace: InputTraceType.Alias }]
		});

		testQuery('FFI call source', "x <- .C('foo')\nfoo(x)", [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Ffi], trace: InputTraceType.Alias }]
		});

		testQuery('Language object source', 'x <- substitute(a)\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Lang], trace: InputTraceType.Alias }]
		});

		testQuery('Options / getOption source', "x <- getOption('digits')\nfoo(x)", [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Options], trace: InputTraceType.Alias }]
		});
	});

	describe('User input', () => {
		testQuery('file.choose', 'x <- file.choose()\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.User], trace: InputTraceType.Alias }]
		});

		testQuery('scan with no file arg classified as File and User only', 'x <- scan()\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File, InputType.User], trace: InputTraceType.Alias }]
		});
	});

	describe('Catch Scope Escapes', () => {
		testQuery('Reading from the closure with call', 'x <- 1\nf <- function() { eval(x) }\nf()', [{ type: 'input-sources', criterion: '2@eval' }], {
			'2@eval': [{ id: '2@x', types: [InputType.Scope], trace: InputTraceType.Unknown }]
		});
		testQuery('A parameter takes the type of what the caller passes', 'f <- function(cmd) {\n  foo(cmd)\n}\nf(read.csv("a.csv"))', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@cmd', types: [InputType.File], trace: InputTraceType.Alias }]
		});
		testQuery('Without a call it stays a parameter', 'f <- function(cmd) {\n  foo(cmd)\n}', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@cmd', types: [InputType.Parameter], trace: InputTraceType.Pure }]
		});
	});

	describe('Temporary files', () => {
		testQuery('tempfile()', 'x <- tempfile()\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.TempFile], trace: InputTraceType.Alias }]
		});
		testQuery('tempdir()', 'x <- tempdir()\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.TempFile], trace: InputTraceType.Alias }]
		});
		testQuery('tempfile with arguments', 'x <- tempfile("prefix", tempdir())\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.TempFile], trace: InputTraceType.Alias }]
		});
		testQuery('tempfile alongside random', 'x <- runif(1)\ny <- tempfile()\nfoo(x, y)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [
				{ id: '3@x', types: [InputType.Random], trace: InputTraceType.Alias },
				{ id: '3@y', types: [InputType.TempFile], trace: InputTraceType.Alias }
			]
		});
		testQuery('read.csv from tempfile path is only TempFile', 'path <- tempfile()\nx <- read.csv(path)\nfoo(x)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@x', types: [InputType.TempFile], trace: InputTraceType.Alias }]
		});
		testQuery('read.csv(tempfile()) direct is only TempFile', 'x <- read.csv(tempfile())\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.TempFile], trace: InputTraceType.Alias }]
		});
		testQuery('tempfile and network both tagged when combined', 'x <- read.csv(tempfile())\ny <- read.csv("https://example.com/data.csv")\nfoo(x, y)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [
				{ id: '3@x', types: [InputType.TempFile], trace: InputTraceType.Alias },
				{ id: '3@y', types: [InputType.File, InputType.Network], trace: InputTraceType.Alias }
			]
		});
	});

	describe('Constant values', () => {
		testQuery('Number via variable', 'x <- 42\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: 42 }]
		});
		testQuery('String via variable', "x <- 'hello'\nfoo(x)", [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: 'hello' }]
		});
		testQuery('Boolean TRUE via variable', 'x <- TRUE\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: true }]
		});
		testQuery('Boolean FALSE via variable', 'x <- FALSE\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: false }]
		});
		testQuery('NULL via variable', 'x <- NULL\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: null }]
		});
		testQuery('Double alias propagates value', "x <- 'hello'\ny <- x\nfoo(y)", [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@y', types: [InputType.Constant], trace: InputTraceType.Alias, value: 'hello' }]
		});
		testQuery('No value for derived constant (arithmetic)', 'y <- 1 + 2\nfoo(y)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@y', types: [InputType.DerivedConstant], trace: InputTraceType.Pure }]
		});
		testQuery('No value when two different constants', "if(runif(1) > 0.5) x <- 'a' else x <- 'b'\nfoo(x)", [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, cds: [InputType.Random, InputType.Constant, InputType.DerivedConstant] }]
		});
		testQuery('Same value in both branches propagates', "if(runif(1) > 0.5) x <- 'a' else x <- 'a'\nfoo(x)", [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: 'a', cds: [InputType.Random, InputType.Constant, InputType.DerivedConstant] }]
		});
		testQuery('Number 0 (falsy) via variable', 'x <- 0\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.Constant], trace: InputTraceType.Alias, value: 0 }]
		});
	});

	describe('Namespace-aware matching', () => {
		/* Verify bidirectional Identifier.matches: a namespaced list entry must still match
		 * a plain (non-namespaced) call, and an explicit pkg::fn call must also match. */
		testQuery('Explicit base:: prefix still classified as System',
			'x <- base::system("ls")\nfoo(x)',
			[{ type: 'input-sources', criterion: '2@foo' }], {
				'2@foo': [{ id: '2@x', types: [InputType.System], trace: InputTraceType.Alias }]
			});
		testQuery('Plain var() resolves via namespaced stats::var in PureFunctions -> DerivedConstant',
			'x <- var(c(1, 2, 3))\nfoo(x)',
			[{ type: 'input-sources', criterion: '2@foo' }], {
				'2@foo': [{ id: '2@x', types: [InputType.DerivedConstant], trace: InputTraceType.Pure }]
			});
		testQuery('Explicit stats:: prefix pure function also yields DerivedConstant',
			'x <- stats::var(c(1, 2, 3))\nfoo(x)',
			[{ type: 'input-sources', criterion: '2@foo' }], {
				'2@foo': [{ id: '2@x', types: [InputType.DerivedConstant], trace: InputTraceType.Pure }]
			});
	});

	describe('Batched Criteria (issue #5)', () => {
		testQuery('Two criteria in one query', 'x <- read.csv("a.csv")\ny <- runif(1)\nfoo(x)\nbar(y)', [{ type: 'input-sources', criterion: ['3@foo', '4@bar'] }], {
			'3@foo': [{ id: '3@x', types: [InputType.File], trace: InputTraceType.Alias }],
			'4@bar': [{ id: '4@y', types: [InputType.Random], trace: InputTraceType.Alias }]
		});
		testQuery('Single-element array same as scalar', 'x <- read.csv("a.csv")\nfoo(x)', [{ type: 'input-sources', criterion: ['2@foo'] }], {
			'2@foo': [{ id: '2@x', types: [InputType.File], trace: InputTraceType.Alias }]
		});
	});

	describe('Argument names (issue #2)', () => {
		testQuery('Named arg carries its name', 'foo(x=1, y=read.csv("a.csv"))', [{ type: 'input-sources', criterion: '1@foo' }], {
			'1@foo': [
				{ id: '1@1',        types: [InputType.Constant], trace: InputTraceType.Unknown, name: 'x', value: 1 },
				{ id: '1@read.csv', types: [InputType.File],     trace: InputTraceType.Unknown, name: 'y' }
			]
		});
		testQuery('Positional arg has no name', 'foo(1, read.csv("a.csv"))', [{ type: 'input-sources', criterion: '1@foo' }], {
			'1@foo': [
				{ id: '1@1',        types: [InputType.Constant], trace: InputTraceType.Unknown, value: 1 },
				{ id: '1@read.csv', types: [InputType.File],     trace: InputTraceType.Unknown }
			]
		});
		testQuery('NULL named arg carries name and null value', 'foo(connection=NULL)', [{ type: 'input-sources', criterion: '1@foo' }], {
			'1@foo': [{ id: '1@NULL', types: [InputType.Constant], trace: InputTraceType.Unknown, name: 'connection', value: null }]
		});
	});

	describe('Shiny (issue #2625)', () => {
		testQuery('a read of input$n links to the widget declaring it', 'library(shiny)\nui <- fluidPage(textInput("n", "Name"))\nserver <- function(input, output, session) {\n  foo(input$n)\n}', [{ type: 'input-sources', criterion: '4@foo' }], {
			'4@foo': [{ id: '4@$', types: [InputType.User], trace: InputTraceType.Unknown, name: 'n', declaredAt: ['2@textInput'] }]
		});
		testQuery('input$n is user input', 'library(shiny)\nserver <- function(input, output, session) {\n  foo(input$n)\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@$', types: [InputType.User], trace: InputTraceType.Unknown, name: 'n' }]
		});
		testQuery('input[["n"]] is user input', 'library(shiny)\nserver <- function(input, output, session) {\n  foo(input[["n"]])\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@[[', types: [InputType.User], trace: InputTraceType.Unknown, name: 'n' }]
		});
		testQuery('the input object itself is user input', 'library(shiny)\nserver <- function(input, output) {\n  foo(input)\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@input', types: [InputType.User], trace: InputTraceType.Unknown }]
		});
		testQuery('the parameters are bound by position, so their names do not matter', 'library(shiny)\nshinyApp(fluidPage(), function(inp, out, sess) {\n  foo(inp$n)\n})', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@$', types: [InputType.User], trace: InputTraceType.Unknown, name: 'n' }]
		});
		testQuery('the same for a module server', 'library(shiny)\nmoduleServer("id", function(i, o, s) {\n  foo(i$cmd)\n})', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@$', types: [InputType.User], trace: InputTraceType.Unknown, name: 'cmd' }]
		});
		testQuery('what the browser sends with the session is user input', 'library(shiny)\nserver <- function(input, output, session) {\n  foo(session$clientData)\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@$', types: [InputType.User], trace: InputTraceType.Unknown, name: 'clientData' }]
		});
		testQuery('the rest of the session is not', 'library(shiny)\nserver <- function(input, output, session) {\n  foo(session$userData)\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@$', types: [InputType.Parameter, InputType.Unknown, InputType.DerivedConstant], trace: InputTraceType.Known }]
		});
		testQuery('traces through the reactive wrappers', 'library(shiny)\nserver <- function(input, output, session) {\n  output$txt <- renderText({ foo(isolate(input$n)) })\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@isolate', types: [InputType.User, InputType.DerivedConstant], trace: InputTraceType.Known }]
		});
		testQuery('calling a reactive yields what it computes', 'library(shiny)\nserver <- function(input, output, session) {\n  n <- reactive({ input$n })\n  foo(n())\n}', [{ type: 'input-sources', criterion: '4@foo' }], {
			'4@foo': [{ id: '4@n', types: [InputType.User, InputType.DerivedConstant], trace: InputTraceType.Alias }]
		});
		testQuery('an ordinary input parameter stays a parameter', 'convert <- function(input, mode) {\n  foo(input)\n}', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@input', types: [InputType.Parameter], trace: InputTraceType.Pure }]
		});
		testQuery('without shiny even an input/output pair is no framework object', 'copyIt <- function(input, output) {\n  foo(input)\n}', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@input', types: [InputType.Parameter], trace: InputTraceType.Pure }]
		});
		testQuery('a locally defined input shadows the framework object', 'library(shiny)\nserver <- function(input, output, session) {\n  helper <- function(input) {\n    foo(input)\n  }\n}', [{ type: 'input-sources', criterion: '4@foo' }], {
			'4@foo': [{ id: '4@input', types: [InputType.Parameter], trace: InputTraceType.Pure }]
		});
		testQuery('query string is user input', 'library(shiny)\nserver <- function(input, output, session) {\n  foo(parseQueryString(session$clientData$url_search))\n}', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@parseQueryString', types: [InputType.User], trace: InputTraceType.Unknown }]
		});
		testQuery('input handed to a helper keeps being user input', 'library(shiny)\nhelper <- function(input) {\n  foo(input$cmd)\n}\nsrv <- function(input, output, session) {\n  helper(input)\n}\nsrv(1, 2, 3)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@$', types: [InputType.User, InputType.Unknown, InputType.DerivedConstant], trace: InputTraceType.Known }]
		});
	});

	describe('cohortBuilder (issue #2625)', () => {
		testQuery('get_data yields user-filtered data', 'library(cohortBuilder)\ncoh <- cohort(set_source(as.tblist(x)))\nfoo(get_data(coh))', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@get_data', types: [InputType.User], trace: InputTraceType.Unknown }]
		});
		testQuery('the cohort itself keeps the source of its data', 'library(cohortBuilder)\ncoh <- cohort(set_source(as.tblist(read.csv("a.csv"))))\nfoo(coh)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@coh', types: [InputType.File, InputType.DerivedConstant], trace: InputTraceType.Alias }]
		});
		testQuery('a filter specification does not blur the trace', 'library(cohortBuilder)\ncoh <- cohort(set_source(as.tblist(read.csv("a.csv"))), filter("discrete", dataset = "d"))\nfoo(coh)', [{ type: 'input-sources', criterion: '3@foo' }], {
			'3@foo': [{ id: '3@coh', types: [InputType.File, InputType.DerivedConstant], trace: InputTraceType.Alias }]
		});
		testQuery('a bare filter() is dplyr\'s without cohortBuilder', 'coh <- filter(read.csv("a.csv"), x > 1)\nfoo(coh)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@coh', types: [InputType.Unknown], trace: InputTraceType.Alias }]
		});
		testQuery('the shiny gui is a user entry point', 'library(shinyCohortBuilder)\nfoo(gui(coh))', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@gui', types: [InputType.User], trace: InputTraceType.Unknown }]
		});
	});
}));

