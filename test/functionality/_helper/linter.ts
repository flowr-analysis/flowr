import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from '../../../src/linter/linter-rules';
import { LintingRules } from '../../../src/linter/linter-rules';
import type { TestLabel } from './label';
import { decorateLabelContext } from './label';
import { assert, test } from 'vitest';
import { createDataflowPipeline } from '../../../src/core/steps/pipeline/default-pipelines';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import { deterministicCountingIdGenerator } from '../../../src/r-bridge/lang-4.x/ast/model/processing/decorate';
import { executeLintingRule } from '../../../src/linter/linter-executor';
import type { LintingRule } from '../../../src/linter/linter-format';
import { log } from '../../../src/util/log';
import type { DeepPartial } from 'ts-essentials';
import type { KnownParser } from '../../../src/r-bridge/parser';

export function assertLinter<Name extends LintingRuleNames>(
	name: string | TestLabel,
	parser: KnownParser,
	code: string,
	ruleName: Name,
	expected: LintingRuleResult<Name>[],
	expectedMetadata?: LintingRuleMetadata<Name>,
	config?: DeepPartial<LintingRuleConfig<Name>>
) {
	test(decorateLabelContext(name, ['linter']), async() => {
		const pipelineResults = await createDataflowPipeline(parser, {
			request: requestFromInput(code),
			getId:   deterministicCountingIdGenerator(0)
		}).allRemainingSteps();

		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const results = executeLintingRule(ruleName, pipelineResults, config);

		for(const [type, printer] of Object.entries({
			text: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => `${rule.prettyPrint(result, metadata)} (${result.certainty})`,
			json: (result: LintingRuleResult<Name>, metadata: LintingRuleMetadata<Name>) => JSON.stringify({ result, metadata })
		})) {
			log.info(`${type}:\n${results.results.map(r => `  ${printer(r, results['.meta'])}`).join('\n')}`);
		}

		assert.deepEqual(results.results, expected, `Expected ${ruleName} to return ${JSON.stringify(expected)}, but got ${JSON.stringify(results)}`);
		if(expectedMetadata !== undefined) {
			// eslint-disable-next-line unused-imports/no-unused-vars
			const { searchTimeMs, processTimeMs, ...strippedMeta } = results['.meta'];
			assert.deepEqual(strippedMeta as unknown as LintingRuleMetadata<Name>, expectedMetadata,
				`Expected ${ruleName} to have metadata ${JSON.stringify(expectedMetadata)}, but got ${JSON.stringify(results['.meta'])}`);
		}
	});
}
