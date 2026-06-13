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
					id: SlicingCriterion.tryParse(v.id, nast) ?? v.id
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
			'2@foo': [{ id: '2@x', types: [InputType.File, InputType.Network], trace: InputTraceType.Alias }]
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
				{ id: '3@x', types: [InputType.File, InputType.Network], trace: InputTraceType.Alias },
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

		testQuery('scan also classified as File and Network', 'x <- scan()\nfoo(x)', [{ type: 'input-sources', criterion: '2@foo' }], {
			'2@foo': [{ id: '2@x', types: [InputType.File, InputType.Network, InputType.User], trace: InputTraceType.Alias }]
		});
	});

	describe('Catch Scope Escapes', () => {
		testQuery('Reading from the closure with call', 'x <- 1\nf <- function() { eval(x) }\nf()', [{ type: 'input-sources', criterion: '2@eval' }], {
			'2@eval': [{ id: '2@x', types: [InputType.Scope], trace: InputTraceType.Unknown }]
		});
	});

	describe('Catch Scope Escapes', () => {
		testQuery('Reading from the closure with call', 'x <- 1\nf <- function() { eval(x) }\nf()', [{ type: 'input-sources', criterion: '2@eval' }], {
			'2@eval': [{ id: '2@x', types: [InputType.Scope], trace: InputTraceType.Unknown }]
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
}));

