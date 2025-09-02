import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingResultCertainty } from '../../../src/linter/linter-format';
import { NETWORK_FUNCTIONS } from '../../../src/linter/rules/network-functions';

const urlPrefix = ['https://', 'ftp://', 'ftps://', 'file://'];

describe('flowR linter', withTreeSitter(parser => {
	describe('network functions', () => {
		/* Testing the validity of all declared network functions */
		for(const entry of NETWORK_FUNCTIONS.info.defaultConfig.fns) {
			assertLinter('network function: ' + entry, parser, `${entry}()`, 'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: entry, range: [1, 1, 1, entry.length + 2] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: [entry] }
			);
		}
		/* Testing the nested use the 'url' function in other function calls */
		assertLinter('network function nested', parser, 'foo(url("http://example.com"))',
			'network-functions',
			[
				{ certainty: LintingResultCertainty.Certain, function: 'url', range: [1,5,1,29] }
			],
			{ totalCalls: 1, totalFunctionDefinitions: 1 },
			{ fns: ['url'] }
		);
		for(const prefix of urlPrefix){
			assertLinter(`network function with url prefix: ${prefix}`, parser, `read.csv("${prefix}www.example.com")`,
				'network-functions',
				[
					{ certainty: LintingResultCertainty.Certain, function: 'read.csv', range: [1,1,1,prefix.length + 27] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ fns: ['read.csv'] }
			);
		}
		assertLinter('do not trigger without url prefix', parser, 'read.csv("www.example.com")',
			'network-functions',
			[],
			{ totalCalls: 0, totalFunctionDefinitions: 0 },
			{ fns: ['read.csv'] }
		);
	});
}));