import { describe } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { assertLinter } from '../_helper/linter';
import { LintingCertainty } from '../../../src/linter/linter-format';
import { NETWORK_FUNCTIONS } from '../../../src/linter/rules/network-functions';

describe('flowR linter', withTreeSitter(parser => {
	describe('network functions', () => {
		/* Testing the validity of all declared network functions */
		for(const entry of NETWORK_FUNCTIONS.info.defaultConfig.functionsToFind) {
			assertLinter('network function: ' + entry, parser, `${entry}()`, 'network-functions',
				[
					{ certainty: LintingCertainty.Definitely, function: entry, range: [1, 1, 1, entry.length + 2] }
				],
				{ totalCalls: 1, totalFunctionDefinitions: 1 },
				{ functionsToFind: [entry] }
			);
		}
	});
	/* Testing the nested use the 'url' function in other function calls */
	assertLinter('network function nested', parser, 'foo(url("http://example.com"))',
		'network-functions',
		[
			{ certainty: LintingCertainty.Definitely, function: 'url', range: [1,5,1,29] }
		],
		{ totalCalls: 1, totalFunctionDefinitions: 1 },
		{ functionsToFind: ['url'] }
	);
}));