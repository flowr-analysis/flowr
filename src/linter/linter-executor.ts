import type { LintingRuleConfig, LintingRuleMetadata, LintingRuleNames, LintingRuleResult } from './linter-rules';
import { LintingRules } from './linter-rules';
import type { LintingResults, LintingRule } from './linter-format';
import { runSearch } from '../search/flowr-search-executor';
import type { DeepPartial } from 'ts-essentials';
import { deepMergeObject } from '../util/objects';
import type { FlowrAnalysisInput } from '../project/flowr-analyzer';

export async function executeLintingRule<Name extends LintingRuleNames>(ruleName: Name, input: FlowrAnalysisInput, lintingRuleConfig?: DeepPartial<LintingRuleConfig<Name>>): Promise<LintingResults<Name>> {
	try {
		const rule = LintingRules[ruleName] as unknown as LintingRule<LintingRuleResult<Name>, LintingRuleMetadata<Name>, LintingRuleConfig<Name>>;
		const fullConfig = deepMergeObject<LintingRuleConfig<Name>>(rule.info.defaultConfig, lintingRuleConfig);

		const ruleSearch = rule.createSearch(fullConfig);

		const searchStart = Date.now();
		const searchResult = await runSearch(ruleSearch, input);
		const searchTime = Date.now() - searchStart;

		const processStart = Date.now();
		const result = await rule.processSearchResult(searchResult, fullConfig,
			{
				normalize: await input.normalize(),
				dataflow:  await input.dataflow(),
				cfg:       await input.controlflow(),
				config:    input.flowrConfig,
			}
		);
		const processTime = Date.now() - processStart;

		return {
			...result,
			'.meta': {
				...result['.meta'],
				searchTimeMs:  searchTime,
				processTimeMs: processTime
			}
		};
	} catch(e) {
		const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : JSON.stringify(e);
		return {
			error: msg
		};
	}
}
