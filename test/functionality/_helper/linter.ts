import type { LintingRule } from '../../../src/linter/linter-format';
import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from '../../../src/linter/linter-rules';
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
	expectedMetadata?: LintingRuleMetadata<Name>,
	config?: Partial<LintingRuleConfig<Name>>
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const pipelineResults = await new PipelineExecutor(DEFAULT_DATAFLOW_PIPELINE, {
			parser:  shell,
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}).allRemainingSteps();

		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const fullConfig = { ...rule.defaultConfig, ...config ?? {} } as unknown as LintingRuleConfig<Name>;
		const ruleSearch = rule.createSearch(fullConfig, pipelineResults);
		const searchResult = runSearch(ruleSearch, pipelineResults);
		const { results, metadata } = rule.processSearchResult(new FlowrSearchElements(searchResult), fullConfig, pipelineResults);

		for(const [type, printer] of Object.entries({
			text: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => `${rule.prettyPrint(result, metadata)} (${result.certainty})`,
			json: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => JSON.stringify({ result, metadata })
		})) {
			console.log(`${type}:\n${results.map(r => `  ${printer(r, metadata)}`).join('\n')}`);
		}

		assert.deepEqual(results, expected, `Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(results)}`);
		if(expectedMetadata !== undefined) {
			assert.deepEqual(metadata, expectedMetadata, `Expected ${ruleName} to have metadata ${JSON.stringify(expectedMetadata)}, but got ${JSON.stringify(metadata)}`);
		}
	});
}
