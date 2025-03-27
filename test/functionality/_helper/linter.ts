import type { LintingRule } from '../../../src/linter/linter-format';
import type { LintingRuleConfig, LintingRuleNames, LintingRuleResult } from '../../../src/linter/linter-rules';
import { LintingRules } from '../../../src/linter/linter-rules';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import type { RShell } from '../../../src/r-bridge/shell';
import { assert, test } from 'vitest';
import { PipelineExecutor } from '../../../src/core/pipeline-executor';
import { DEFAULT_DATAFLOW_PIPELINE } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { runSearch } from '../../../src/search/flowr-search-executor';
import { FlowrSearchElements } from '../../../src/search/flowr-search';

export function assertLinter<Name extends LintingRuleNames>(
	name: string | TestLabel,
	shell: RShell,
	code: string,
	ruleName: Name,
	expected: LintingRuleResult<Name>[],
	config = LintingRules[ruleName].defaultConfig as unknown as LintingRuleConfig<Name>
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const results = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}).allRemainingSteps();

		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleConfig<Name>>;
		const ruleSearch = rule.createSearch(config);
		const searchResult = runSearch(ruleSearch, results);
		const ruleResults = rule.processSearchResult(new FlowrSearchElements(searchResult), config);

		for(const [type, printer] of Object.entries({
			text: (result: LintingRuleResult<Name>) => `${rule.prettyPrint(result)} (${result.certainty})`,
			json: JSON.stringify
		})) {
			console.log(`${type}:\n${ruleResults.map(r => `  ${printer(r)}`).join('\n')}`);
		}

		assert.deepEqual(ruleResults, expected,
			`Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(ruleResults)}`);
	});
}
