import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter, controlledSigDb } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { Identifier } from '../../../src/dataflow/environments/identifier';



const urlPrefix = ['https://', 'ftp://', 'ftps://'];

describe('flowR linter', withTreeSitter(parser => {
	describe('network functions', () => {
		/* Testing the nested use the 'url' function in other function calls */
		assertLinter('network function nested', parser, 'foo(url("http://example.com"))',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'base::url', loc: [1, 5, 1, 29] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);
		for(const prefix of urlPrefix){
			/* @ignore-in-wiki */
			assertLinter(`network function with url prefix: ${prefix}`, parser, `read.csv("${prefix}www.example.com")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, prefix.length + 27] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 }
			);

			assertLinter(`network funcion with multiple arguments: ${prefix}`, parser, `download.file("${prefix}foo.org/bar.csv", "local.csv")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'utils::download.file', loc: [1, 1, 1, prefix.length + 45] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 }
			);

		}

		assertLinter('library call', parser, 'library(httr)\nPOST("http://example.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'httr::POST', loc: [2, 1, 2, 26] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
		);
		assertLinter('unloaded library call', parser, 'POST("http://example.com")',
			'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'POST', loc: [1, 1, 1, 26] }],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
		);
		assertLinter('mismatched library call', parser, 'httr2::GET("http://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 }
		);
		assertLinter('namespace call', parser, 'library(httr)\nhttr::GET("http://example.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'httr::GET', loc: [2, 1, 2, 31] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
		);

		assertLinter('do not trigger without url prefix', parser, 'read.csv("www.example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 }
		);
		assertLinter('trigger with custom url prefix', parser, 'read.csv("www.example.com")',
			'network-functions',
			[{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, 27] }],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: [{ name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./ }] }
		);
		assertLinter('do not trigger with custom url prefix', parser, 'read.csv("https://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: [{ name: Identifier.make('read.csv', 'utils'), onlyTriggerWithArgument: /^www\./ }] }
		);

		assertLinter('do not trigger with multiple arguments', parser, 'download.file("data/local.csv", "local.csv")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 }
		);

		assertLinter('not in list test', parser, 'file("data/local.csv")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
		);

		assertLinter('nor in list but prefix in string', parser, 'print("http://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
		);

		assertLinter('do not trigger on known source', parser, 'source("tex.R")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
		);

		assertLinter('trigger on web source', parser, 'source("https://foo.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'base::source', loc: [1, 1, 1, 25] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
		);


		assertLinter('Named argument', parser, 'read.csv(file = "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 1, 1, 46] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);

		assertLinter('Positional argument with custom config', parser, 'test.me(x, "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'test.me', loc: [1, 1, 1, 41] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: [{ name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: { argIdx: 1 } }] }
		);
		assertLinter('Named argument with custom config', parser, 'test.me(foo = "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'test.me', loc: [1, 1, 1, 44] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: [{ name: 'test.me', onlyTriggerWithArgument: /^(https?|ftps?):\/\//, info: { argName: 'foo' } }] }
		);

		assertLinter('Resolve value', parser, 'url <- "http://example.com/data.csv"; read.csv(url)',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'utils::read.csv', loc: [1, 39, 1, 51] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 }
		);

		describe('a call resolved via a loaded package is still flagged', () => {
			// regression: the loaded-package export must still count as a built-in call target
			assertLinter('with a (controlled) package database', parser, 'library(httr)\nGET("http://example.com")',
				'network-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'httr::GET', loc: [2, 1, 2, 25] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ sigDb: controlledSigDb('httr', ['GET', 'POST']) }
			);
			assertLinter('without any package database', parser, 'library(httr)\nGET("http://example.com")',
				'network-functions',
				[{ certainty: LintingResultCertainty.Certain, function: 'GET', loc: [2, 1, 2, 25] }],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ noSigDb: true }
			);
		});
	});
}));
