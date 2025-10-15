import { assert, describe, test } from 'vitest';
import { withTreeSitter } from '../_helper/shell';
import type { LintingRuleNames } from '../../../src/linter/linter-rules';
import { LintingRules } from '../../../src/linter/linter-rules';
import type { LintingResult, LintingRule } from '../../../src/linter/linter-format';
import {
	isLintingResultsError,
	LintingPrettyPrintContext,
	LintingRuleCertainty
} from '../../../src/linter/linter-format';
import type { MergeableRecord } from '../../../src/util/objects';
import { Q } from '../../../src/search/flowr-search-builder';
import { LintingRuleTag } from '../../../src/linter/linter-tags';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';

describe('flowR linter', withTreeSitter(parser => {
	test('Error Handling', async() => {
		// Add a new dummy rule that always throws to the ruleset
		// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
		(LintingRules as any)['dummy'] = {
			createSearch:        () => Q.all(),
			processSearchResult: () => {
				throw new Error('Hello World'); 
			},
			prettyPrint: {
				[LintingPrettyPrintContext.Query]: _ => 'Dummy Rule',
				[LintingPrettyPrintContext.Full]:  _ => 'Dummy Rule'
			},
			info: {
				name:          'dummy',
				certainty:     LintingRuleCertainty.Exact,
				description:   'Always Throws',
				tags:          [LintingRuleTag.Experimental],
				defaultConfig: {}
			}
		} as const satisfies LintingRule<LintingResult, MergeableRecord, MergeableRecord>;

		const analyzer = await new FlowrAnalyzerBuilder(requestFromInput('x <- "hi"'))
			.setParser(parser)
			.build();

		const result = await executeLintingRule('dummy' as unknown as LintingRuleNames, analyzer, undefined);

		assert(isLintingResultsError(result), 'Dummy Rule should always return Error');
		assert(result.error === 'Hello World');
	});
}));