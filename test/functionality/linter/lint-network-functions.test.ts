import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { NETWORK_FUNCTIONS } from '../../../src/linter/rules/network-functions';

const urlPrefix = ['https://', 'ftp://', 'ftps://', 'file://'];

describe('flowR linter', withTreeSitter(parser => {
	describe('network functions', () => {
		/* Testing the nested use the 'url' function in other function calls */
		assertLinter('network function nested', parser, 'foo(url("http://example.com"))',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'url', range: [1, 5, 1, 29] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['url'] }
		);
		for(const prefix of urlPrefix){
			/* @ignore-in-wiki */
			assertLinter(`network function with url prefix: ${prefix}`, parser, `read.csv("${prefix}www.example.com")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'read.csv', range: [1, 1, 1, prefix.length + 27] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['read.csv'] }
			);

			assertLinter(`network funcion with multiple arguments: ${prefix}`, parser, `download.file("${prefix}foo.org/bar.csv", "local.csv")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'download.file', range: [1, 1, 1, prefix.length+45] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['download.file'] }
			);

		}
		assertLinter('namespace call', parser, 'httr::GET("http://example.com")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'httr::GET', range: [1, 1, 1, 31] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['GET'] }
		);

		assertLinter('do not trigger without url prefix', parser, 'read.csv("www.example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: ['read.csv'] }
		);

		assertLinter('do not trigger with multiple arguments', parser, 'download.file("data/local.csv", "local.csv")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: ['read.csv'] }
		);

		assertLinter('not in list test', parser, 'file("data/local.csv")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: NETWORK_FUNCTIONS.info.defaultConfig.fns }
		);

		assertLinter('nor in list but prefix in string', parser, 'print("http://example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: NETWORK_FUNCTIONS.info.defaultConfig.fns }
		);

		assertLinter('Named argument', parser, 'read.csv(file = "http://example.com/data.csv")',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'read.csv', range: [1, 1, 1, 46] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['read.csv'] }
		);

		assertLinter('Resolve value', parser, 'url <- "http://example.com/data.csv"; read.csv(url)',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'read.csv', range: [1, 39, 1, 51] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['read.csv'] }
		);
	});
}));