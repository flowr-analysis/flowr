import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { executeLinterQuery } from '../../../src/queries/catalog/linter-query/linter-query-executor';
import type { LintingRuleNames } from '../../../src/linter/linter-rules';

describe('flowR linter', withTreeSitter(parser => {
	describe('active by default', () => {
		// naming-convention is heuristic and marked inactive by default, so a query without an
		// explicit rule list must not run it, while an explicit request still does
		async function runLinter(rules: LintingRuleNames[] | undefined) {
			const analyzer = await new FlowrAnalyzerBuilder()
				.setParser(parser)
				.build();
			analyzer.addRequest('my_Var <- 5\nmyVar <- 6\n');
			const result = await executeLinterQuery({ analyzer }, [{ type: 'linter', rules }]);
			return Object.keys(result.results);
		}

		test('no explicit rules skips naming-convention', async() => {
			const keys = await runLinter(undefined);
			assert.isFalse(keys.includes('naming-convention'), `expected naming-convention to be skipped, got ${keys.join(', ')}`);
		});

		test('explicit rules include naming-convention', async() => {
			const keys = await runLinter(['naming-convention']);
			assert.deepEqual(keys, ['naming-convention']);
		});
	});
}));
